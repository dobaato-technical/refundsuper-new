"""External integrations: WhatsApp, email, HMAC-signed CRM webhook, IndexNow, Google Search Console."""
from typing import Optional, List
import hashlib
import hmac
import json
import time
import uuid
import requests
import urllib.parse

from deps import (
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM,
    RESEND_API_KEY, RESEND_FROM_EMAIL, ADMIN_NOTIFICATION_EMAILS,
    WEBHOOK_URL, WEBHOOK_SECRET,
    INDEXNOW_KEY, INDEXNOW_ENDPOINT,
    GSC_SERVICE_ACCOUNT_JSON,
    logger,
)


# -------------------- WhatsApp --------------------
def send_whatsapp(lead: dict):
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM):
        logger.info("[STUB] WhatsApp not configured — would notify %s", lead.get("whatsapp_number"))
        return
    try:
        from twilio.rest import Client
        c = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        body = (
            f"Hi {lead.get('first_name')}, this is AussieBack. We've received your estimate "
            f"of ${lead.get('estimated_refund'):,.0f}. Our team will contact you shortly to "
            f"fast-track your DASP refund. Reply STOP to opt-out."
        )
        to = lead.get("whatsapp_number", "")
        if not to.startswith("whatsapp:"):
            to = f"whatsapp:{to}"
        msg = c.messages.create(body=body, from_=TWILIO_WHATSAPP_FROM, to=to)
        logger.info("WhatsApp sent SID=%s", msg.sid)
    except Exception as e:
        logger.exception("WhatsApp send failed: %s", e)


# -------------------- Email --------------------
def send_emails(lead: dict):
    if not (RESEND_API_KEY and RESEND_FROM_EMAIL):
        logger.info("[STUB] Email not configured — would email %s", lead.get("email"))
        return
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": [lead["email"]],
            "subject": f"Your AussieBack Super refund estimate: ${lead['estimated_refund']:,.0f}",
            "html": f"""
                <h2>Hi {lead['first_name']},</h2>
                <p>Thanks for using AussieBack. Based on what you've told us, your estimated
                Australian Super refund is <strong>${lead['estimated_refund']:,.0f}</strong>.</p>
                <p>Our team will reach out via WhatsApp shortly to help you recover this.</p>
                <p>– The AussieBack Team</p>
            """,
        })
        admin_recipients = [e.strip() for e in ADMIN_NOTIFICATION_EMAILS.split(",") if e.strip()]
        if admin_recipients:
            resend.Emails.send({
                "from": RESEND_FROM_EMAIL,
                "to": admin_recipients,
                "subject": f"New AussieBack lead: {lead['first_name']} (${lead['estimated_refund']:,.0f})",
                "html": f"""
                    <h3>New lead captured</h3>
                    <ul>
                      <li>Name: {lead['first_name']}</li>
                      <li>Email: {lead['email']}</li>
                      <li>WhatsApp: {lead['whatsapp_number']}</li>
                      <li>Visa: {lead['visa_type']}</li>
                      <li>Estimated refund: ${lead['estimated_refund']:,.0f}</li>
                      <li>Super fund: {lead.get('super_fund_name') or 'N/A'}</li>
                      <li>Departure: {lead.get('date_left_australia') or 'N/A'}</li>
                    </ul>
                """,
            })
    except Exception as e:
        logger.exception("Resend email failed: %s", e)


# -------------------- HMAC-signed CRM webhook (Zapier / Zoho / Hubspot) --------------------
def _sign_payload(payload: bytes) -> str:
    """SHA-256 HMAC in hex, prefixed with 'sha256=' to match GitHub/Stripe convention."""
    if not WEBHOOK_SECRET:
        return ""
    digest = hmac.new(WEBHOOK_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def send_webhook(event: str, data: dict, *, previous: Optional[dict] = None) -> None:
    """Forward a generic event to the configured webhook (fire-and-forget).

    Payload shape (JSON):
        {
          "event": "lead.created" | "lead.status_changed" | "comment.created" | "share_event.created",
          "id": "<uuid>",
          "occurred_at": "2026-...Z",
          "data": {...},        # the object itself
          "previous": {...}     # for status changes only — the old subset
        }

    Signature: sha256=<hex> HMAC over the raw body, sent as `X-AussieBack-Signature`.
    """
    if not WEBHOOK_URL:
        logger.info("[STUB] Webhook not configured — would forward event=%s id=%s", event, data.get("id"))
        return
    envelope = {
        "event": event,
        "id": str(uuid.uuid4()),
        "occurred_at": _now_iso(),
        "data": data,
    }
    if previous is not None:
        envelope["previous"] = previous
    body = json.dumps(envelope, default=str).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AussieBack-Webhook/1.0",
        "X-AussieBack-Event": event,
    }
    sig = _sign_payload(body)
    if sig:
        headers["X-AussieBack-Signature"] = sig
    try:
        resp = requests.post(WEBHOOK_URL, data=body, headers=headers, timeout=(3, 10))
        logger.info("Webhook POST event=%s status=%s", event, resp.status_code)
    except Exception as e:
        logger.exception("Webhook POST failed (event=%s): %s", event, e)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def dispatch_lead_integrations(lead: dict):
    """Fired once when a lead is created."""
    send_whatsapp(lead)
    send_emails(lead)
    send_webhook("lead.created", lead)


# -------------------- IndexNow (Bing/Yandex/DuckDuckGo instant re-crawl) --------------------
def ping_indexnow(urls: List[str], host: str) -> Optional[dict]:
    """POST a list of URLs to the IndexNow endpoint.

    Requires `INDEXNOW_KEY` env var (a random 8–128 char hex string) and a
    key-verification file served at `https://<host>/<INDEXNOW_KEY>.txt`.
    The backend exposes `GET /{key}.txt` via `routes.seo` so this works out of the box.

    Returns None (no-op) when INDEXNOW_KEY is unset.
    """
    if not INDEXNOW_KEY or not urls:
        if not INDEXNOW_KEY:
            logger.info("[STUB] IndexNow not configured — would ping %d urls", len(urls))
        return None
    parsed_host = urllib.parse.urlparse(host).netloc or host
    payload = {
        "host": parsed_host,
        "key": INDEXNOW_KEY,
        "keyLocation": f"{host.rstrip('/')}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }
    try:
        r = requests.post(
            INDEXNOW_ENDPOINT,
            json=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=(3, 10),
        )
        logger.info("IndexNow ping status=%s urls=%d host=%s", r.status_code, len(urls), parsed_host)
        return {"status": r.status_code, "urls": len(urls)}
    except Exception as e:
        logger.exception("IndexNow ping failed: %s", e)
        return {"error": str(e), "urls": len(urls)}


# -------------------- Google Search Console API (optional, OAuth service account) --------------------
def ping_gsc_sitemap(sitemap_url: str, site_property: str) -> Optional[dict]:
    """Force a sitemap re-submission via the Search Console API.

    Requires `GSC_SERVICE_ACCOUNT_JSON` env var containing the entire service-
    account JSON string. The service account email must be added as an owner
    for `site_property` in the Search Console UI. `site_property` should look
    like "https://aussieback.com/" (with trailing slash) or "sc-domain:aussieback.com".

    Returns None (no-op) when unconfigured.
    """
    if not GSC_SERVICE_ACCOUNT_JSON:
        logger.info("[STUB] GSC_SERVICE_ACCOUNT_JSON not configured — skipping GSC ping")
        return None
    try:
        # Lazy imports so the base install stays lean when GSC is unused.
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        logger.warning("google-api-python-client / google-auth not installed — cannot ping GSC")
        return {"error": "missing_google_client"}
    try:
        info = json.loads(GSC_SERVICE_ACCOUNT_JSON)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/webmasters"]
        )
        service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
        # `submit` on `sitemaps` triggers Google to re-fetch immediately.
        service.sitemaps().submit(siteUrl=site_property, feedpath=sitemap_url).execute()
        logger.info("GSC sitemap re-submitted: %s (property=%s)", sitemap_url, site_property)
        return {"ok": True, "sitemap": sitemap_url}
    except Exception as e:
        logger.exception("GSC ping failed: %s", e)
        return {"error": str(e)}


def ping_search_engines_for_slug(site_url: str, slugs: List[str]) -> dict:
    """Convenience: build blog URLs from slugs and ping IndexNow + GSC in one call.

    site_url is expected to be the canonical origin (e.g. "https://aussieback.com").
    """
    urls = [f"{site_url.rstrip('/')}/blog/{s}" for s in slugs if s]
    # Always include /blog itself so listing pages get re-crawled too.
    urls.append(f"{site_url.rstrip('/')}/blog")
    urls.append(f"{site_url.rstrip('/')}/sitemap.xml")
    indexnow_result = ping_indexnow(urls, site_url)
    gsc_result = ping_gsc_sitemap(
        f"{site_url.rstrip('/')}/sitemap.xml",
        f"{site_url.rstrip('/')}/",
    )
    return {"indexnow": indexnow_result, "gsc": gsc_result, "urls": urls}
