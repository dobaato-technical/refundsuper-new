from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks, Query, Request, Header
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import phonenumbers
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse
import secrets
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------- Config ----------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'aussieback-dev-secret-change-me')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '720'))

ADMIN_SEED_EMAIL = os.environ.get('ADMIN_SEED_EMAIL', 'admin@aussieback.com')
ADMIN_SEED_PASSWORD = os.environ.get('ADMIN_SEED_PASSWORD', 'Admin@123')

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM')

RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
RESEND_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL')
ADMIN_NOTIFICATION_EMAILS = os.environ.get('ADMIN_NOTIFICATION_EMAILS', '')

WEBHOOK_URL = os.environ.get('WEBHOOK_URL')

RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY')
RECAPTCHA_MIN_SCORE = float(os.environ.get('RECAPTCHA_MIN_SCORE', '0.5'))
RECAPTCHA_ACTION = os.environ.get('RECAPTCHA_ACTION', 'leads')
RECAPTCHA_SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

LEAD_RATE_LIMIT = os.environ.get('LEAD_RATE_LIMIT', '5/hour')

# ---------------- DB ----------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
leads_collection = db['leads']
admins_collection = db['admins']
share_events_collection = db['share_events']

# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("aussieback")

# ---------------- Auth helpers ----------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False

def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

async def get_current_admin(token: str = Depends(oauth2_scheme)) -> dict:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise cred_exc
    except JWTError:
        raise cred_exc
    admin = await admins_collection.find_one({"email": email}, {"_id": 0, "hashed_password": 0})
    if not admin:
        raise cred_exc
    return admin

# ---------------- Models ----------------
VisaType = Literal["working_holiday", "other_temp"]
LeadStatus = Literal["new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"]

class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Step 1
    visa_type: VisaType
    input_mode: Literal["balance", "earnings"]
    super_balance: Optional[float] = None  # if input_mode == balance
    gross_earnings: Optional[float] = None  # if input_mode == earnings
    estimated_refund: float
    # Step 2
    first_name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    whatsapp_number: str = Field(..., min_length=4, max_length=40)
    # Step 3 (optional, may be added in follow-up call but we ask in same submit)
    super_fund_name: Optional[str] = None
    date_left_australia: Optional[str] = None  # ISO date string
    # Referral
    referred_by_code: Optional[str] = Field(default=None, max_length=32)

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_e164(cls, v: str) -> str:
        v = (v or "").strip()
        try:
            parsed = phonenumbers.parse(v, None)
        except phonenumbers.NumberParseException as e:
            raise ValueError("WhatsApp number must be in international E.164 format (e.g. +44 7700 900123)") from e
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("WhatsApp number is not a valid international phone number")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    visa_type: str
    input_mode: str
    super_balance: Optional[float] = None
    gross_earnings: Optional[float] = None
    estimated_refund: float
    first_name: str
    email: str
    whatsapp_number: str
    super_fund_name: Optional[str] = None
    date_left_australia: Optional[str] = None
    status: LeadStatus
    created_at: str
    updated_at: str
    referral_code: Optional[str] = None
    referred_by_code: Optional[str] = None
    referred_by_lead_id: Optional[str] = None

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResp(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_email: str

class StatusUpdate(BaseModel):
    status: LeadStatus

ShareChannel = Literal["download", "native", "copy", "story_download"]

class ShareEventCreate(BaseModel):
    channel: ShareChannel
    referral_code: Optional[str] = Field(default=None, max_length=32)
    lead_id: Optional[str] = Field(default=None, max_length=64)
    aspect: Optional[Literal["feed", "story"]] = None

# ---------------- Calculator ----------------
SUPER_RATE = 0.12  # 12% Super Guarantee
TAX_RATES = {
    "working_holiday": 0.65,  # 65% tax => keep 35%
    "other_temp": 0.35,        # 35% tax => keep 65%
}

def compute_refund(visa_type: str, input_mode: str, super_balance: Optional[float], gross_earnings: Optional[float]) -> dict:
    if input_mode == "balance":
        balance = float(super_balance or 0)
    else:
        balance = float(gross_earnings or 0) * SUPER_RATE
    tax_rate = TAX_RATES.get(visa_type, 0.5)
    refund = balance * (1 - tax_rate)
    return {
        "balance": round(balance, 2),
        "tax_rate": tax_rate,
        "estimated_refund": round(refund, 2),
    }

# ---------------- Integrations (stub-capable) ----------------
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

def send_emails(lead: dict):
    if not (RESEND_API_KEY and RESEND_FROM_EMAIL):
        logger.info("[STUB] Email not configured — would email %s", lead.get("email"))
        return
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        # Lead confirmation
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
        # Admin notification
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

def post_webhook(lead: dict):
    if not WEBHOOK_URL:
        logger.info("[STUB] Webhook not configured — would forward lead %s", lead.get("id"))
        return
    try:
        resp = requests.post(WEBHOOK_URL, json=lead, timeout=(3, 10))
        logger.info("Webhook POST status=%s", resp.status_code)
    except Exception as e:
        logger.exception("Webhook POST failed: %s", e)

def dispatch_lead_integrations(lead: dict):
    send_whatsapp(lead)
    send_emails(lead)
    post_webhook(lead)

# ---------------- reCAPTCHA v3 verification (stub-capable) ----------------
def verify_recaptcha(
    request: Request,
    x_recaptcha_token: Optional[str] = Header(default=None, alias="X-Recaptcha-Token"),
) -> None:
    if not RECAPTCHA_SECRET_KEY:
        logger.info("[STUB] reCAPTCHA not configured — skipping verification")
        return
    if not x_recaptcha_token:
        raise HTTPException(status_code=400, detail="Missing X-Recaptcha-Token header")
    remote_ip = request.client.host if request.client else None
    payload = {"secret": RECAPTCHA_SECRET_KEY, "response": x_recaptcha_token}
    if remote_ip:
        payload["remoteip"] = remote_ip
    try:
        r = requests.post(RECAPTCHA_SITEVERIFY_URL, data=payload, timeout=(3, 8))
        r.raise_for_status()
        result = r.json()
    except Exception as e:
        logger.exception("reCAPTCHA verification error: %s", e)
        raise HTTPException(status_code=503, detail="reCAPTCHA verification unavailable")
    if not result.get("success"):
        raise HTTPException(status_code=403, detail={"reason": "recaptcha_failed", "errors": result.get("error-codes", [])})
    if result.get("action") and result.get("action") != RECAPTCHA_ACTION:
        raise HTTPException(status_code=403, detail="reCAPTCHA action mismatch")
    if float(result.get("score", 0.0)) < RECAPTCHA_MIN_SCORE:
        raise HTTPException(status_code=403, detail="reCAPTCHA score too low")

# ---------------- Rate limiter ----------------
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# ---------------- Referral codes ----------------
_REFERRAL_ALPHABET = string.ascii_uppercase + string.digits  # base36 minus lowercase, easier to read
REFERRAL_CODE_LEN = 8

def _generate_referral_code() -> str:
    # Avoid ambiguous chars 0/O/1/I for readability
    banned = {"0", "O", "1", "I"}
    alphabet = "".join(ch for ch in _REFERRAL_ALPHABET if ch not in banned)
    return "".join(secrets.choice(alphabet) for _ in range(REFERRAL_CODE_LEN))

async def _new_unique_referral_code(max_attempts: int = 8) -> str:
    for _ in range(max_attempts):
        code = _generate_referral_code()
        if not await leads_collection.find_one({"referral_code": code}, {"_id": 1}):
            return code
    # Extremely unlikely: fall back to a fresh code (accept the very small collision risk on next insert)
    return _generate_referral_code()

# ---------------- App & Router ----------------
app = FastAPI(title="AussieBack API")
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many submissions. Please try again later ({exc.detail})."},
    )

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"service": "AussieBack API", "status": "ok"}

# --- Public estimator (optional preview endpoint) ---
class EstimateRequest(BaseModel):
    visa_type: VisaType
    input_mode: Literal["balance", "earnings"]
    super_balance: Optional[float] = None
    gross_earnings: Optional[float] = None

@api_router.post("/estimate")
async def estimate(payload: EstimateRequest):
    result = compute_refund(payload.visa_type, payload.input_mode, payload.super_balance, payload.gross_earnings)
    return result

# --- Lead creation ---
@api_router.post("/leads", response_model=Lead)
@limiter.limit(LEAD_RATE_LIMIT)
async def create_lead(
    request: Request,
    payload: LeadCreate,
    background_tasks: BackgroundTasks,
    _rc: None = Depends(verify_recaptcha),
):
    # Recompute on server to ensure trustworthy figure
    calc = compute_refund(payload.visa_type, payload.input_mode, payload.super_balance, payload.gross_earnings)
    now = datetime.now(timezone.utc).isoformat()
    # Referral code + inbound attribution
    referral_code = await _new_unique_referral_code()
    referred_by_code = (payload.referred_by_code or "").strip().upper() or None
    referred_by_lead_id: Optional[str] = None
    if referred_by_code:
        referrer = await leads_collection.find_one(
            {"referral_code": referred_by_code}, {"id": 1, "_id": 0}
        )
        if referrer:
            referred_by_lead_id = referrer["id"]
        else:
            # Unknown code — keep the raw code for audit but don't error
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
    }
    await leads_collection.insert_one({**doc})
    # Schedule outbound integrations
    background_tasks.add_task(dispatch_lead_integrations, doc)
    return Lead(**doc)

# --- Admin auth ---
@api_router.post("/admin/login", response_model=TokenResp)
async def admin_login(payload: AdminLogin):
    admin = await admins_collection.find_one({"email": payload.email})
    if not admin or not verify_password(payload.password, admin.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": admin["email"]})
    return TokenResp(access_token=token, admin_email=admin["email"])

@api_router.get("/admin/me")
async def admin_me(current: dict = Depends(get_current_admin)):
    return {"email": current["email"]}

# --- Admin: list leads ---
@api_router.get("/admin/leads")
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

# --- Admin: update lead status ---
@api_router.patch("/admin/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, payload: StatusUpdate, current: dict = Depends(get_current_admin)):
    res = await leads_collection.update_one(
        {"id": lead_id},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}

# --- Admin: stats ---
@api_router.get("/admin/stats")
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

# --- Admin: export CSV ---
@api_router.get("/admin/leads/export")
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
        headers={"Content-Disposition": "attachment; filename=aussieback_leads.csv"},
    )

# --- Share events (public) ---
@api_router.post("/share-events")
@limiter.limit("60/hour")
async def create_share_event(request: Request, payload: ShareEventCreate):
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
    return {"ok": True, "id": doc["id"]}

# --- Admin: analytics ---
@api_router.get("/admin/analytics")
async def admin_analytics(current: dict = Depends(get_current_admin)):
    channels = ["download", "native", "copy", "story_download"]
    channel_counts: dict = {}
    for ch in channels:
        channel_counts[ch] = await share_events_collection.count_documents({"channel": ch})
    total_shares = sum(channel_counts.values())

    # Top referrers: aggregate referred leads count grouped by referred_by_lead_id
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

    return {
        "share_events": {
            "by_channel": channel_counts,
            "total": total_shares,
        },
        "referrals": {
            "referred_leads_total": referred_leads_total,
            "all_leads_total": all_leads_total,
            "top_referrers": top,
        },
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Startup ----------------
@app.on_event("startup")
async def seed_admin_and_indexes():
    await leads_collection.create_index("id", unique=True)
    await leads_collection.create_index("created_at")
    await leads_collection.create_index("referral_code", unique=True, sparse=True)
    await leads_collection.create_index("referred_by_lead_id")
    await admins_collection.create_index("email", unique=True)
    await share_events_collection.create_index("created_at")
    await share_events_collection.create_index("channel")
    existing = await admins_collection.find_one({"email": ADMIN_SEED_EMAIL})
    if not existing:
        await admins_collection.insert_one({
            "email": ADMIN_SEED_EMAIL,
            "hashed_password": hash_password(ADMIN_SEED_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin %s", ADMIN_SEED_EMAIL)
    else:
        logger.info("Admin already exists: %s", ADMIN_SEED_EMAIL)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
