"""Weekly digest email (Monday 09:00 Sydney)."""
from datetime import datetime, timezone, timedelta

from deps import (
    leads_collection, share_events_collection,
    RESEND_API_KEY, RESEND_FROM_EMAIL, ADMIN_NOTIFICATION_EMAILS,
    logger,
)


async def build_weekly_digest() -> dict:
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    new_leads_count = await leads_collection.count_documents({"created_at": {"$gte": week_ago}})
    pipeline_row = leads_collection.aggregate([
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_refund"}}},
    ])
    new_pipeline = 0.0
    async for r in pipeline_row:
        new_pipeline = float(r.get("total", 0))

    channels = ["download", "native", "copy", "story_download"]
    channel_counts = {}
    for ch in channels:
        channel_counts[ch] = await share_events_collection.count_documents(
            {"channel": ch, "created_at": {"$gte": week_ago}}
        )
    top_channel = max(channel_counts.items(), key=lambda kv: kv[1]) if channel_counts else ("-", 0)

    top_cursor = leads_collection.aggregate([
        {"$match": {"referred_by_lead_id": {"$ne": None}, "created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$referred_by_lead_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 3},
    ])
    top_referrers = []
    async for row in top_cursor:
        ref = await leads_collection.find_one(
            {"id": row["_id"]},
            {"_id": 0, "first_name": 1, "email": 1, "referral_code": 1},
        )
        if ref:
            top_referrers.append({**ref, "referred_count": row["count"]})

    return {
        "since": week_ago,
        "new_leads_count": new_leads_count,
        "new_pipeline_value": round(new_pipeline, 2),
        "share_events_by_channel": channel_counts,
        "top_channel": {"channel": top_channel[0], "count": top_channel[1]},
        "top_referrers": top_referrers,
    }


def _digest_to_html(d: dict) -> str:
    rows = "".join(
        f"<li><strong>{r['first_name']}</strong> ({r.get('email', '')}) — "
        f"code <code>{r.get('referral_code', '')}</code> — "
        f"{r['referred_count']} new referrals</li>"
        for r in d["top_referrers"]
    ) or "<li>No referred leads this week.</li>"
    return f"""
    <h2>refundmysuper — weekly digest</h2>
    <p>Since {d['since'][:10]}</p>
    <ul>
      <li><strong>{d['new_leads_count']}</strong> new leads</li>
      <li><strong>${d['new_pipeline_value']:,.0f}</strong> new pipeline value</li>
      <li>Top share channel: <strong>{d['top_channel']['channel']}</strong>
          ({d['top_channel']['count']} events)</li>
    </ul>
    <h3>Top referrers this week</h3>
    <ol>{rows}</ol>
    <p style="color:#4A5D68;font-size:12px;">This digest was generated automatically. Configure ADMIN_NOTIFICATION_EMAILS + RESEND_API_KEY to deliver it.</p>
    """


async def send_weekly_digest() -> dict:
    digest = await build_weekly_digest()
    html = _digest_to_html(digest)
    admin_recipients = [e.strip() for e in ADMIN_NOTIFICATION_EMAILS.split(",") if e.strip()]
    if RESEND_API_KEY and RESEND_FROM_EMAIL and admin_recipients:
        try:
            import resend
            resend.api_key = RESEND_API_KEY
            resend.Emails.send({
                "from": RESEND_FROM_EMAIL,
                "to": admin_recipients,
                "subject": f"refundmysuper weekly digest — {digest['new_leads_count']} new leads",
                "html": html,
            })
            logger.info("Weekly digest sent to %s", admin_recipients)
        except Exception as e:
            logger.exception("Weekly digest send failed: %s", e)
    else:
        logger.info(
            "[STUB] Weekly digest not sent — RESEND / ADMIN_NOTIFICATION_EMAILS not configured. "
            "%d new leads · $%s pipeline · top channel=%s",
            digest["new_leads_count"],
            f"{digest['new_pipeline_value']:,.0f}",
            digest["top_channel"]["channel"],
        )
    return digest
