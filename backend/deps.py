"""Shared dependencies: config, DB, auth helpers, rate limiter, logger."""
from fastapi import Depends, HTTPException, Request, Header, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import logging
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- Config ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aussieback-dev-secret-change-me")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

ADMIN_SEED_EMAIL = os.environ.get("ADMIN_SEED_EMAIL", "admin@aussieback.com")
ADMIN_SEED_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD", "Admin@123")

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL")
ADMIN_NOTIFICATION_EMAILS = os.environ.get("ADMIN_NOTIFICATION_EMAILS", "")

# CRM webhook (Zapier / Zoho / Hubspot). Iteration 10: HMAC-signed forwarder.
WEBHOOK_URL = os.environ.get("WEBHOOK_URL")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY")
RECAPTCHA_MIN_SCORE = float(os.environ.get("RECAPTCHA_MIN_SCORE", "0.5"))
RECAPTCHA_ACTION = os.environ.get("RECAPTCHA_ACTION", "leads")
RECAPTCHA_SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

LEAD_RATE_LIMIT = os.environ.get("LEAD_RATE_LIMIT", "5/hour")

# Iteration 10 — IndexNow (Bing/Yandex/DuckDuckGo instant index) + optional Google Search Console API ping.
INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "")
INDEXNOW_ENDPOINT = os.environ.get("INDEXNOW_ENDPOINT", "https://api.indexnow.org/indexnow")
GSC_SERVICE_ACCOUNT_JSON = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")

REFERRAL_TIERS = [
    {"threshold": 1, "reward": "Priority WhatsApp support"},
    {"threshold": 3, "reward": "Free premium claim review"},
    {"threshold": 5, "reward": "$50 travel voucher"},
    {"threshold": 10, "reward": "Full concierge claim (we do everything)"},
]

WEEKLY_DIGEST_TZ = os.environ.get("WEEKLY_DIGEST_TZ", "Australia/Sydney")
WEEKLY_DIGEST_ENABLED = os.environ.get("WEEKLY_DIGEST_ENABLED", "true").lower() == "true"

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
SITE_URL = os.environ.get("SITE_URL", "https://refundsuper.com.au").rstrip("/")
GOOGLE_SITE_VERIFICATION = os.environ.get("GOOGLE_SITE_VERIFICATION", "").strip()
COMMENTS_AUTO_APPROVE = os.environ.get("COMMENTS_AUTO_APPROVE", "true").lower() == "true"

# Iteration 12 — trigger Next.js ISR revalidation from the backend
NEXTJS_INTERNAL_URL = os.environ.get("NEXTJS_INTERNAL_URL", "http://localhost:3000").rstrip("/")
REVALIDATE_SECRET = os.environ.get("REVALIDATE_SECRET", "")

# ---------------- DB ----------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
leads_collection = db["leads"]
admins_collection = db["admins"]
share_events_collection = db["share_events"]
blog_posts_collection = db["blog_posts"]
comments_collection = db["comments"]
settings_collection = db["settings"]
autopilot_queue_collection = db["autopilot_queue"]

# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("aussieback")

# ---------------- Auth ----------------
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


# ---------------- Effective site settings (DB overrides env) ----------------
async def effective_site_settings() -> dict:
    doc = await settings_collection.find_one({"_id": "site_config"}) or {}
    return {
        "site_url": (doc.get("site_url") or SITE_URL).rstrip("/"),
        "google_site_verification": doc.get("google_site_verification") or (GOOGLE_SITE_VERIFICATION or None),
    }
