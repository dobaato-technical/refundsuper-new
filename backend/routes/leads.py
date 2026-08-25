"""Public endpoints: /estimate, /leads, /referrals/*, /share-events."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from deps import (
    leads_collection, share_events_collection,
    limiter, verify_recaptcha, LEAD_RATE_LIMIT, REFERRAL_TIERS, logger,
)
from models import EstimateRequest, LeadCreate, Lead, ShareEventCreate
from services.calculator import compute_refund
from services.referrals import new_unique_referral_code
from integrations import dispatch_lead_integrations

router = APIRouter()


@router.get("/")
async def root():
    return {"service": "refundmysuper API", "status": "ok"}


@router.post("/estimate")
async def estimate(payload: EstimateRequest):
    return compute_refund(payload.visa_type, payload.input_mode, payload.super_balance, payload.gross_earnings)


@router.post("/leads", response_model=Lead)
@limiter.limit(LEAD_RATE_LIMIT)
async def create_lead(
    request: Request,
    payload: LeadCreate,
    background_tasks: BackgroundTasks,
    _rc: None = Depends(verify_recaptcha),
):
    calc = compute_refund(payload.visa_type, payload.input_mode, payload.super_balance, payload.gross_earnings)
    now = datetime.now(timezone.utc).isoformat()
    referral_code = await new_unique_referral_code()
    referred_by_code = (payload.referred_by_code or "").strip().upper() or None
    referred_by_lead_id: Optional[str] = None
    if referred_by_code:
        referrer = await leads_collection.find_one(
            {"referral_code": referred_by_code}, {"id": 1, "_id": 0}
        )
        if referrer:
            referred_by_lead_id = referrer["id"]
        else:
            logger.info("Referral code not found: %s", referred_by_code)

    doc = {
        "id": str(uuid.uuid4()),
        "visa_type": payload.visa_type,
        "input_mode": payload.input_mode,
        "super_balance": payload.super_balance,
        "gross_earnings": payload.gross_earnings,
        "estimated_refund": calc["estimated_refund"],
        "first_name": payload.first_name,
        "email": payload.email,
        "whatsapp_number": payload.whatsapp_number,
        "super_fund_name": payload.super_fund_name,
        "date_left_australia": payload.date_left_australia,
        "status": "new_estimate",
        "created_at": now,
        "updated_at": now,
        "referral_code": referral_code,
        "referred_by_code": referred_by_code,
        "referred_by_lead_id": referred_by_lead_id,
        "utm_source": (payload.utm_source or None),
        "utm_medium": (payload.utm_medium or None),
        "utm_campaign": (payload.utm_campaign or None),
    }
    await leads_collection.insert_one({**doc})
    background_tasks.add_task(dispatch_lead_integrations, doc)
    return Lead(**doc)


@router.get("/referrals/{code}")
async def get_referrer_public(code: str):
    code_up = (code or "").strip().upper()
    if not code_up:
        raise HTTPException(status_code=404, detail="Not found")
    doc = await leads_collection.find_one(
        {"referral_code": code_up},
        {"_id": 0, "first_name": 1, "referral_code": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"referral_code": doc["referral_code"], "first_name": doc.get("first_name", "")}


@router.get("/referrals/{code}/progress")
@limiter.limit("60/hour")
async def get_referral_progress(request: Request, code: str):
    code_up = (code or "").strip().upper()
    ref = await leads_collection.find_one(
        {"referral_code": code_up},
        {"_id": 0, "id": 1, "referral_code": 1, "first_name": 1},
    )
    if not ref:
        raise HTTPException(status_code=404, detail="Not found")
    referred_count = await leads_collection.count_documents({"referred_by_lead_id": ref["id"]})
    next_tier = next((t for t in REFERRAL_TIERS if t["threshold"] > referred_count), None)
    unlocked = [t for t in REFERRAL_TIERS if t["threshold"] <= referred_count]
    return {
        "referral_code": ref["referral_code"],
        "referred_count": referred_count,
        "tiers": REFERRAL_TIERS,
        "unlocked_tiers": unlocked,
        "next_tier": next_tier,
        "remaining_to_next": (next_tier["threshold"] - referred_count) if next_tier else 0,
    }


@router.post("/share-events")
@limiter.limit("60/hour")
async def create_share_event(request: Request, payload: ShareEventCreate, background_tasks: BackgroundTasks):
    doc = {
        "id": str(uuid.uuid4()),
        "channel": payload.channel,
        "referral_code": (payload.referral_code or "").strip().upper() or None,
        "lead_id": payload.lead_id,
        "aspect": payload.aspect,
        "user_agent": request.headers.get("user-agent", "")[:300],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await share_events_collection.insert_one({**doc})
    # Fire-and-forget webhook forward
    from integrations import send_webhook
    background_tasks.add_task(send_webhook, "share_event.created", doc)
    return {"ok": True, "id": doc["id"]}
