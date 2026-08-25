"""Admin auth + lead pipeline management: login, list, status, stats, analytics, CSV export, digest run."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional
import csv
import io

from deps import (
    leads_collection, admins_collection, share_events_collection,
    get_current_admin, verify_password, create_access_token, logger,
)
from models import AdminLogin, TokenResp, StatusUpdate, LeadStatus
from services.digest import send_weekly_digest
from integrations import send_webhook

router = APIRouter()


@router.post("/admin/login", response_model=TokenResp)
async def admin_login(payload: AdminLogin):
    admin = await admins_collection.find_one({"email": payload.email})
    if not admin or not verify_password(payload.password, admin.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": admin["email"]})
    return TokenResp(access_token=token, admin_email=admin["email"])


@router.get("/admin/me")
async def admin_me(current: dict = Depends(get_current_admin)):
    return {"email": current["email"]}


@router.get("/admin/leads")
async def list_leads(
    current: dict = Depends(get_current_admin),
    q: Optional[str] = None,
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    limit: int = 200,
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if q:
        query["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"whatsapp_number": {"$regex": q, "$options": "i"}},
            {"super_fund_name": {"$regex": q, "$options": "i"}},
        ]
    docs = await leads_collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"leads": docs, "count": len(docs)}


@router.patch("/admin/leads/{lead_id}/status")
async def update_lead_status(
    lead_id: str,
    payload: StatusUpdate,
    background_tasks: BackgroundTasks,
    current: dict = Depends(get_current_admin),
):
    lead = await leads_collection.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    old_status = lead.get("status")
    new_status = payload.status
    if old_status == new_status:
        return {"ok": True, "unchanged": True}
    await leads_collection.update_one(
        {"id": lead_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    updated = {**lead, "status": new_status}
    background_tasks.add_task(
        send_webhook,
        "lead.status_changed",
        updated,
        previous={"status": old_status},
    )
    return {"ok": True}


@router.get("/admin/stats")
async def admin_stats(current: dict = Depends(get_current_admin)):
    pipeline_stages = ["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"]
    counts = {}
    for s in pipeline_stages:
        counts[s] = await leads_collection.count_documents({"status": s})
    total = sum(counts.values())
    pipeline_value_cursor = leads_collection.aggregate([
        {"$match": {"status": {"$ne": "refund_paid"}}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_refund"}}},
    ])
    pipeline_value = 0.0
    async for row in pipeline_value_cursor:
        pipeline_value = float(row.get("total", 0))
    paid_cursor = leads_collection.aggregate([
        {"$match": {"status": "refund_paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_refund"}}},
    ])
    recovered = 0.0
    async for row in paid_cursor:
        recovered = float(row.get("total", 0))
    converted = counts.get("refund_paid", 0)
    conversion_rate = (converted / total * 100.0) if total else 0.0
    return {
        "total_leads": total,
        "status_counts": counts,
        "pipeline_value": round(pipeline_value, 2),
        "recovered_value": round(recovered, 2),
        "conversion_rate": round(conversion_rate, 1),
    }


@router.get("/admin/leads/export")
async def export_leads(current: dict = Depends(get_current_admin)):
    docs = await leads_collection.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    if docs:
        writer = csv.DictWriter(buf, fieldnames=list(docs[0].keys()))
        writer.writeheader()
        for d in docs:
            writer.writerow(d)
    else:
        buf.write("no_leads\n")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=refundmysuper_leads.csv"},
    )


@router.get("/admin/analytics")
async def admin_analytics(current: dict = Depends(get_current_admin)):
    channels = ["download", "native", "copy", "story_download"]
    channel_counts: dict = {}
    for ch in channels:
        channel_counts[ch] = await share_events_collection.count_documents({"channel": ch})
    total_shares = sum(channel_counts.values())

    top_referrers_cursor = leads_collection.aggregate([
        {"$match": {"referred_by_lead_id": {"$ne": None}}},
        {"$group": {
            "_id": "$referred_by_lead_id",
            "referred_count": {"$sum": 1},
            "total_estimated": {"$sum": "$estimated_refund"},
        }},
        {"$sort": {"referred_count": -1}},
        {"$limit": 10},
    ])
    top: List[dict] = []
    async for row in top_referrers_cursor:
        ref = await leads_collection.find_one(
            {"id": row["_id"]},
            {"_id": 0, "id": 1, "first_name": 1, "email": 1, "referral_code": 1},
        )
        if not ref:
            continue
        top.append({
            "lead_id": ref["id"],
            "first_name": ref.get("first_name"),
            "email": ref.get("email"),
            "referral_code": ref.get("referral_code"),
            "referred_count": row["referred_count"],
            "total_estimated": round(float(row["total_estimated"]), 2),
        })

    referred_leads_total = await leads_collection.count_documents({"referred_by_lead_id": {"$ne": None}})
    all_leads_total = await leads_collection.count_documents({})

    utm_cursor = leads_collection.aggregate([
        {"$match": {"utm_source": {"$ne": None}}},
        {"$group": {
            "_id": "$utm_source",
            "leads": {"$sum": 1},
            "pipeline": {"$sum": "$estimated_refund"},
        }},
        {"$sort": {"leads": -1}},
        {"$limit": 10},
    ])
    utm_sources: List[dict] = []
    async for row in utm_cursor:
        utm_sources.append({
            "source": row["_id"] or "unknown",
            "leads": row["leads"],
            "pipeline": round(float(row["pipeline"]), 2),
        })

    return {
        "share_events": {"by_channel": channel_counts, "total": total_shares},
        "referrals": {
            "referred_leads_total": referred_leads_total,
            "all_leads_total": all_leads_total,
            "top_referrers": top,
        },
        "utm_sources": utm_sources,
    }


@router.post("/admin/weekly-digest/run")
async def run_weekly_digest_now(current: dict = Depends(get_current_admin)):
    digest = await send_weekly_digest()
    return {"ok": True, "digest": digest}
