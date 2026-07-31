"""AussieBack API — bootstrap.

All request handlers live under `routes/*.py`. This file wires the FastAPI app,
CORS, rate limiter, DB indexes, the admin seed, and the APScheduler cron jobs.
"""
from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone
from typing import Optional
import os

from deps import (
    client, limiter, logger, hash_password,
    leads_collection, admins_collection, share_events_collection,
    blog_posts_collection, comments_collection,
    ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD,
    WEEKLY_DIGEST_ENABLED, WEEKLY_DIGEST_TZ,
)
from services.digest import send_weekly_digest
from services.blog import run_autopilot_once
from blog_seed import SEED_BLOG_POSTS

# Route modules
from routes import leads as leads_routes
from routes import admin as admin_routes
from routes import blog_public as blog_public_routes
from routes import admin_blog as admin_blog_routes
from routes import seo as seo_routes

# ---------------- App ----------------
app = FastAPI(title="AussieBack API")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many submissions. Please try again later ({exc.detail})."},
    )


# All API routes are mounted under `/api`.
api_router = APIRouter(prefix="/api")
api_router.include_router(leads_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(blog_public_routes.router)
api_router.include_router(admin_blog_routes.router)
app.include_router(api_router)

# Root-level SEO endpoints (sitemap.xml, robots.txt, google*.html, /api/site-config,
# IndexNow key file). Note: `/api/site-config` intentionally lives in `routes/seo.py`
# alongside the other crawler helpers.
app.include_router(seo_routes.router)


# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Startup / shutdown ----------------
scheduler: Optional[AsyncIOScheduler] = None


@app.on_event("startup")
async def seed_and_indexes():
    global scheduler
    await leads_collection.create_index("id", unique=True)
    await leads_collection.create_index("created_at")
    await leads_collection.create_index("referral_code", unique=True, sparse=True)
    await leads_collection.create_index("referred_by_lead_id")
    await leads_collection.create_index("utm_source")
    await admins_collection.create_index("email", unique=True)
    await share_events_collection.create_index("created_at")
    await share_events_collection.create_index("channel")
    await blog_posts_collection.create_index("slug", unique=True)
    await blog_posts_collection.create_index("category")
    await blog_posts_collection.create_index("tags")
    await comments_collection.create_index("post_slug")
    await comments_collection.create_index("created_at")

    if await blog_posts_collection.count_documents({}) == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        docs = [{**p, "published_at": now_iso, "updated_at": now_iso} for p in SEED_BLOG_POSTS]
        await blog_posts_collection.insert_many(docs)
        logger.info("Seeded %d blog posts", len(docs))

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

    if WEEKLY_DIGEST_ENABLED:
        try:
            scheduler = AsyncIOScheduler(timezone=WEEKLY_DIGEST_TZ)
            scheduler.add_job(
                send_weekly_digest,
                CronTrigger(day_of_week="mon", hour=9, minute=0),
                id="weekly_digest",
                replace_existing=True,
            )
            scheduler.add_job(
                run_autopilot_once,
                CronTrigger(day_of_week="mon", hour=10, minute=0),
                id="blog_autopilot",
                replace_existing=True,
            )
            scheduler.start()
            logger.info(
                "Schedulers started (tz=%s): weekly_digest Mon 09:00, blog_autopilot Mon 10:00",
                WEEKLY_DIGEST_TZ,
            )
        except Exception as e:
            logger.exception("Failed to start scheduler: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    global scheduler
    if scheduler is not None:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass
    client.close()
