"""Admin observability + control for the webhook outbox."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from deps import get_current_admin
from services.outbox import (
    webhook_outbox_collection, force_retry, process_outbox, MAX_ATTEMPTS,
)

router = APIRouter()


@router.get("/admin/outbox")
async def admin_outbox_list(
    current: dict = Depends(get_current_admin),
    status: Optional[str] = Query(None, description="pending | success | dead"),
    limit: int = 100,
):
    q: dict = {}
    if status:
        q["status"] = status
    rows = await webhook_outbox_collection.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    counts = {}
    for s in ("pending", "success", "dead"):
        counts[s] = await webhook_outbox_collection.count_documents({"status": s})
    return {"outbox": rows, "counts": counts, "max_attempts": MAX_ATTEMPTS}


@router.post("/admin/outbox/{row_id}/retry")
async def admin_outbox_retry(row_id: str, current: dict = Depends(get_current_admin)):
    ok = await force_retry(row_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "row_id": row_id}


@router.post("/admin/outbox/process-now")
async def admin_outbox_process_now(current: dict = Depends(get_current_admin)):
    """Force the retry loop to run once immediately (handy for tests / manual flushes)."""
    result = await process_outbox()
    return {"ok": True, **result}


@router.delete("/admin/outbox/{row_id}")
async def admin_outbox_delete(row_id: str, current: dict = Depends(get_current_admin)):
    res = await webhook_outbox_collection.delete_one({"id": row_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
