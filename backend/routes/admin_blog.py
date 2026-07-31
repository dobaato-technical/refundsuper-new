"""Admin blog operations: comments moderation, Claude drafts, publish, autopilot queue, site settings."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional
import uuid

from deps import (
    blog_posts_collection, comments_collection, settings_collection,
    autopilot_queue_collection,
    get_current_admin, SITE_URL, GOOGLE_SITE_VERIFICATION,
    effective_site_settings, logger,
)
from models import (
    BlogPostDraftRequest, BlogPostUpsert, SiteSettingsUpdate,
    AutopilotItemCreate, AutopilotConfigUpdate,
)
from services.blog import (
    slugify, generate_article_draft, run_autopilot_once, notify_search_engines_for_slug,
    autopilot_config, revalidate_for_slug,
)

router = APIRouter()


# ---------- Comment moderation ----------
@router.get("/admin/comments")
async def admin_list_comments(current: dict = Depends(get_current_admin), approved: Optional[bool] = None):
    q: dict = {}
    if approved is not None:
        q["approved"] = approved
    docs = await comments_collection.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"comments": docs, "count": len(docs)}


@router.patch("/admin/comments/{comment_id}/approve")
async def admin_approve_comment(comment_id: str, current: dict = Depends(get_current_admin)):
    res = await comments_collection.update_one({"id": comment_id}, {"$set": {"approved": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.delete("/admin/comments/{comment_id}")
async def admin_delete_comment(comment_id: str, current: dict = Depends(get_current_admin)):
    res = await comments_collection.delete_one({"id": comment_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Claude draft + publish ----------
@router.post("/admin/blog/generate-draft")
async def admin_generate_draft(payload: BlogPostDraftRequest, current: dict = Depends(get_current_admin)):
    draft = await generate_article_draft(payload.topic, payload.keywords, payload.category)
    return {"ok": True, "draft": draft}


@router.post("/admin/blog/posts")
async def admin_publish_post(
    payload: BlogPostUpsert,
    background_tasks: BackgroundTasks,
    current: dict = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc).isoformat()
    slug = slugify(payload.slug)
    existing = await blog_posts_collection.find_one({"slug": slug}, {"_id": 1})
    doc = {**payload.model_dump(), "slug": slug, "updated_at": now}
    if existing:
        await blog_posts_collection.update_one({"slug": slug}, {"$set": doc})
    else:
        doc["published_at"] = now
        await blog_posts_collection.insert_one(doc)
    # Fresh publish → poke IndexNow + GSC in the background so we don't block the request
    background_tasks.add_task(_ping_search_engines, slug)
    return {"ok": True, "slug": slug, "created": not existing}


async def _ping_search_engines(slug: str):
    try:
        await notify_search_engines_for_slug(slug)
    except Exception as e:
        logger.exception("[SEO PING] failed for slug=%s: %s", slug, e)
    try:
        await revalidate_for_slug(slug)
    except Exception as e:
        logger.exception("[REVALIDATE] failed for slug=%s: %s", slug, e)


@router.delete("/admin/blog/posts/{slug}")
async def admin_delete_post(slug: str, current: dict = Depends(get_current_admin)):
    res = await blog_posts_collection.delete_one({"slug": slug})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/admin/blog/ping-search-engines")
async def admin_manual_ping(current: dict = Depends(get_current_admin), slug: Optional[str] = None):
    """Manually re-fire IndexNow + GSC for a single slug (or all posts when slug is omitted)."""
    if slug:
        result = await notify_search_engines_for_slug(slug)
        return {"ok": True, "slug": slug, "result": result}
    from integrations import ping_search_engines_for_slug
    settings = await effective_site_settings()
    slugs_docs = await blog_posts_collection.find({}, {"_id": 0, "slug": 1}).to_list(500)
    slugs = [d["slug"] for d in slugs_docs]
    return {"ok": True, "count": len(slugs), "result": ping_search_engines_for_slug(settings["site_url"], slugs)}


# ---------- Site settings ----------
@router.get("/admin/site-settings")
async def admin_get_site_settings(current: dict = Depends(get_current_admin)):
    doc = await settings_collection.find_one({"_id": "site_config"}) or {}
    effective = await effective_site_settings()
    return {
        "effective": effective,
        "db_overrides": {
            "site_url": doc.get("site_url"),
            "google_site_verification": doc.get("google_site_verification"),
        },
        "env_defaults": {
            "site_url": SITE_URL,
            "google_site_verification": GOOGLE_SITE_VERIFICATION or None,
        },
    }


@router.put("/admin/site-settings")
async def admin_update_site_settings(payload: SiteSettingsUpdate, current: dict = Depends(get_current_admin)):
    updates: dict = {}
    if payload.site_url is not None:
        updates["site_url"] = payload.site_url.strip().rstrip("/") or None
    if payload.google_site_verification is not None:
        updates["google_site_verification"] = payload.google_site_verification.strip() or None
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await settings_collection.update_one(
        {"_id": "site_config"}, {"$set": updates}, upsert=True
    )
    return {"ok": True, "effective": await effective_site_settings()}


# ---------- Autopilot queue ----------
@router.get("/admin/autopilot")
async def admin_autopilot_get(current: dict = Depends(get_current_admin)):
    cfg = await autopilot_config()
    queue = await autopilot_queue_collection.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"config": cfg, "queue": queue, "queue_length": len(queue)}


@router.patch("/admin/autopilot")
async def admin_autopilot_config_update(payload: AutopilotConfigUpdate, current: dict = Depends(get_current_admin)):
    await settings_collection.update_one(
        {"_id": "autopilot"},
        {"$set": {"enabled": payload.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "config": await autopilot_config()}


@router.post("/admin/autopilot/queue")
async def admin_autopilot_add(payload: AutopilotItemCreate, current: dict = Depends(get_current_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "topic": payload.topic.strip(),
        "keywords": payload.keywords,
        "category": payload.category,
        "hero_image": payload.hero_image,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await autopilot_queue_collection.insert_one({**doc})
    return {"ok": True, "item": doc}


@router.delete("/admin/autopilot/queue/{item_id}")
async def admin_autopilot_remove(item_id: str, current: dict = Depends(get_current_admin)):
    res = await autopilot_queue_collection.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/admin/autopilot/queue/{item_id}/requeue")
async def admin_autopilot_requeue(item_id: str, current: dict = Depends(get_current_admin)):
    item = await autopilot_queue_collection.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    if item.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Only failed items can be requeued")
    await autopilot_queue_collection.update_one(
        {"id": item_id},
        {"$set": {"status": "queued"},
         "$unset": {"error": "", "finished_at": "", "started_at": ""}},
    )
    return {"ok": True, "item_id": item_id}


@router.post("/admin/autopilot/run")
async def admin_autopilot_run(current: dict = Depends(get_current_admin)):
    return await run_autopilot_once()
