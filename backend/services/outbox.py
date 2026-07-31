"""Durable webhook outbox with exponential-backoff retries.

Design:
  - Every outbound event is inserted into `webhook_outbox` with `status="pending"`.
  - An APScheduler job (see `server.py`) polls every minute for pending rows whose
    `next_attempt_at <= now`, POSTs them, and updates the row.
  - Retries use exponential backoff (2, 4, 8, 16, 32 min, capped at 30) up to
    MAX_ATTEMPTS. On the final failure the row is marked `status="dead"`.
  - Success rows are kept for observability (visible in admin/outbox).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import asyncio
import json
import uuid

import requests
from pymongo import MongoClient

from deps import (
    logger, MONGO_URL, DB_NAME,
    WEBHOOK_URL, WEBHOOK_SECRET,
    db,
)

# Async motor collection (used by the retry loop which lives inside APScheduler).
webhook_outbox_collection = db["webhook_outbox"]

# Sync pymongo handle — enqueue is called from FastAPI BackgroundTasks (which
# may run inside a threadpool for sync callables); this avoids the async-loop
# dance completely.
_sync_client = MongoClient(MONGO_URL)
_sync_outbox = _sync_client[DB_NAME]["webhook_outbox"]

MAX_ATTEMPTS = 8
# Delays (in minutes) per attempt index 1..MAX_ATTEMPTS. Attempt 1 fires
# immediately; delays[i] is the wait BEFORE attempt i+1.
BACKOFF_MINUTES = [0, 2, 4, 8, 16, 30, 30, 30]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sign(body: bytes) -> Optional[str]:
    if not WEBHOOK_SECRET:
        return None
    import hmac, hashlib
    return "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()


def enqueue(event: str, data: dict, *, previous: Optional[dict] = None) -> Optional[str]:
    """Insert an event into the outbox (sync — safe for FastAPI BackgroundTasks).

    Returns the outbox row id, or None if webhooks are disabled globally.
    """
    if not WEBHOOK_URL:
        logger.info("[OUTBOX] webhook disabled — dropping event=%s", event)
        return None
    envelope = {
        "event": event,
        "id": str(uuid.uuid4()),
        "occurred_at": _now().isoformat(),
        "data": data,
    }
    if previous is not None:
        envelope["previous"] = previous
    body = json.dumps(envelope, default=str)
    row = {
        "id": str(uuid.uuid4()),
        "event": event,
        "url": WEBHOOK_URL,
        "body": body,
        "signature": _sign(body.encode("utf-8")),
        "status": "pending",
        "attempts": 0,
        "last_error": None,
        "next_attempt_at": _now().isoformat(),
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }
    _sync_outbox.insert_one({**row})
    logger.info("[OUTBOX] enqueued id=%s event=%s", row["id"], event)
    return row["id"]


def _post_sync(url: str, body: str, signature: Optional[str], event: str) -> tuple[bool, str]:
    """Blocking HTTP POST — called via asyncio.to_thread so we don't block the event loop."""
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AussieBack-Webhook/1.1",
        "X-AussieBack-Event": event,
    }
    if signature:
        headers["X-AussieBack-Signature"] = signature
    try:
        resp = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=(3, 15))
        ok = 200 <= resp.status_code < 300
        detail = f"status={resp.status_code}"
        if not ok:
            snippet = (resp.text or "")[:200].replace("\n", " ")
            detail = f"status={resp.status_code} body={snippet}"
        return ok, detail
    except requests.RequestException as e:
        return False, f"network:{type(e).__name__}:{str(e)[:180]}"


async def _attempt_once(row: dict) -> bool:
    """Attempt one delivery. Returns True on success."""
    attempts = row.get("attempts", 0) + 1
    ok, detail = await asyncio.to_thread(
        _post_sync, row["url"], row["body"], row.get("signature"), row["event"]
    )
    now = _now()
    if ok:
        await webhook_outbox_collection.update_one(
            {"id": row["id"]},
            {"$set": {
                "status": "success",
                "attempts": attempts,
                "last_error": None,
                "delivered_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }},
        )
        logger.info("[OUTBOX] delivered id=%s event=%s attempts=%d %s", row["id"], row["event"], attempts, detail)
        return True

    is_dead = attempts >= MAX_ATTEMPTS
    if is_dead:
        await webhook_outbox_collection.update_one(
            {"id": row["id"]},
            {"$set": {
                "status": "dead",
                "attempts": attempts,
                "last_error": detail,
                "updated_at": now.isoformat(),
            }},
        )
        logger.warning("[OUTBOX] DEAD id=%s event=%s attempts=%d %s", row["id"], row["event"], attempts, detail)
    else:
        # Attempt-index 1 already fired; delay before attempt-2 is BACKOFF_MINUTES[1] etc.
        delay_min = BACKOFF_MINUTES[min(attempts, len(BACKOFF_MINUTES) - 1)]
        next_at = now + timedelta(minutes=delay_min)
        await webhook_outbox_collection.update_one(
            {"id": row["id"]},
            {"$set": {
                "attempts": attempts,
                "last_error": detail,
                "next_attempt_at": next_at.isoformat(),
                "updated_at": now.isoformat(),
            }},
        )
        logger.info(
            "[OUTBOX] retry-scheduled id=%s event=%s attempts=%d next_in=%dm %s",
            row["id"], row["event"], attempts, delay_min, detail,
        )
    return False


async def process_outbox(limit: int = 25) -> dict:
    """Cron-friendly poller — process up to `limit` due pending rows."""
    now_iso = _now().isoformat()
    rows = await webhook_outbox_collection.find(
        {"status": "pending", "next_attempt_at": {"$lte": now_iso}},
        {"_id": 0},
    ).sort("next_attempt_at", 1).to_list(limit)
    if not rows:
        return {"processed": 0, "success": 0, "failed": 0}
    success = 0
    for row in rows:
        try:
            ok = await _attempt_once(row)
            if ok:
                success += 1
        except Exception as e:
            logger.exception("[OUTBOX] unexpected error id=%s: %s", row.get("id"), e)
    return {"processed": len(rows), "success": success, "failed": len(rows) - success}


async def force_retry(row_id: str) -> bool:
    """Admin action: reset a dead/failed row to pending and retry immediately."""
    now_iso = _now().isoformat()
    res = await webhook_outbox_collection.update_one(
        {"id": row_id},
        {"$set": {"status": "pending", "next_attempt_at": now_iso, "updated_at": now_iso}},
    )
    return res.matched_count > 0
