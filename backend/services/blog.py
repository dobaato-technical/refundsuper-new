"""Blog services: slug, Claude-powered article draft generator, autopilot runner, search-engine ping."""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
import json
import re
import uuid

from deps import (
    autopilot_queue_collection, blog_posts_collection, settings_collection,
    EMERGENT_LLM_KEY, logger, effective_site_settings,
    NEXTJS_INTERNAL_URL, REVALIDATE_SECRET,
)
from integrations import ping_search_engines_for_slug

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    s = _SLUG_RE.sub("-", (text or "").lower()).strip("-")
    return s[:140] or f"post-{uuid.uuid4().hex[:8]}"


async def autopilot_config() -> dict:
    doc = await settings_collection.find_one({"_id": "autopilot"}) or {}
    return {"enabled": bool(doc.get("enabled", False))}


async def generate_article_draft(topic: str, keywords: List[str], category: Optional[str]) -> dict:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="EMERGENT_LLM_KEY not configured")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(status_code=503, detail="emergentintegrations not installed")
    system = (
        "You are an SEO-savvy travel-finance editor at refundmysuper. refundmysuper is the trusted portal for former Australian residents from India, China and beyond claiming their DASP superannuation refund. "
        "Write article drafts about Australian Super refunds (DASP) for backpackers, "
        "working holiday makers and international students who have left Australia. "
        "Always respond with ONLY a JSON object (no code fences, no prose) with keys: "
        "title (max 90 chars, keyword-first), meta_description (140-160 chars), excerpt "
        "(1-2 sentences), category, tags (array of 3-6 lowercase strings), keywords "
        "(array of 3-8 SEO phrases), reading_time_minutes (int 3-8), content (markdown, "
        "500-900 words, must use H2 sections, bullet lists, a table or blockquote, and "
        "end with a call to action linking to '/#estimator')."
    )
    user_text = (
        f"Draft an SEO article for refundmysuper.\n\n"
        f"Topic: {topic}\n"
        f"Target keywords: {', '.join(keywords) if keywords else '(pick from topic)'}\n"
        f"Preferred category: {category or 'auto-select from Guide, By Visa, By Country, Tips, Case Study'}\n\n"
        "Respond with ONLY the JSON object."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"blog-draft-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    raw = await chat.send_message(UserMessage(text=user_text))
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise HTTPException(status_code=502, detail="LLM did not return JSON")
        data = json.loads(match.group(0))
    try:
        return {
            "slug": slugify(data.get("title") or topic),
            "title": data["title"],
            "meta_description": data["meta_description"],
            "excerpt": data["excerpt"],
            "category": data.get("category") or category or "Guide",
            "tags": data.get("tags", []),
            "keywords": data.get("keywords", keywords),
            "reading_time_minutes": int(data.get("reading_time_minutes", 5)),
            "content": data["content"],
            "hero_image": None,
            "author": "refundmysuper Team",
        }
    except (KeyError, TypeError, ValueError) as e:
        logger.warning("LLM draft parse missing keys: %s | payload=%s", e, data)
        raise HTTPException(status_code=502, detail="LLM draft missing required fields — try again")


async def notify_search_engines_for_slug(slug: str) -> dict:
    """Fire IndexNow + GSC ping for a freshly-published blog post."""
    settings = await effective_site_settings()
    result = ping_search_engines_for_slug(settings["site_url"], [slug])
    return result


def _revalidate_nextjs(paths: list[str]) -> Optional[dict]:
    """Poke Next.js to purge the ISR cache for the given paths.

    Called after a publish so the article shows up on the live site within
    seconds instead of waiting for the 60-second revalidate window.
    """
    if not REVALIDATE_SECRET or not NEXTJS_INTERNAL_URL:
        logger.info("[REVALIDATE] disabled — set REVALIDATE_SECRET + NEXTJS_INTERNAL_URL")
        return None
    import requests
    try:
        r = requests.post(
            f"{NEXTJS_INTERNAL_URL}/api/revalidate",
            json={"paths": paths},
            headers={"x-revalidate-secret": REVALIDATE_SECRET, "Content-Type": "application/json"},
            timeout=(2, 5),
        )
        logger.info("[REVALIDATE] status=%s paths=%s", r.status_code, paths)
        if r.status_code == 200:
            return r.json()
        return {"error": r.status_code}
    except Exception as e:
        logger.exception("[REVALIDATE] failed: %s", e)
        return {"error": str(e)}


async def revalidate_for_slug(slug: str) -> Optional[dict]:
    return _revalidate_nextjs(["/", "/blog", f"/blog/{slug}"])


async def run_autopilot_once() -> dict:
    cfg = await autopilot_config()
    if not cfg["enabled"]:
        logger.info("[AUTOPILOT] disabled — skipping run")
        return {"skipped": True, "reason": "disabled"}
    item = await autopilot_queue_collection.find_one_and_update(
        {"status": "queued"},
        {"$set": {"status": "processing", "started_at": datetime.now(timezone.utc).isoformat()}},
        sort=[("created_at", 1)],
    )
    if not item:
        logger.info("[AUTOPILOT] queue empty — nothing to publish")
        return {"skipped": True, "reason": "empty_queue"}
    try:
        draft = await generate_article_draft(item["topic"], item.get("keywords", []), item.get("category"))
        if item.get("hero_image"):
            draft["hero_image"] = item["hero_image"]
        now = datetime.now(timezone.utc).isoformat()
        post_doc = {**draft, "published_at": now, "updated_at": now}
        await blog_posts_collection.update_one(
            {"slug": draft["slug"]}, {"$set": post_doc}, upsert=True
        )
        await autopilot_queue_collection.update_one(
            {"id": item["id"]},
            {"$set": {"status": "published", "published_slug": draft["slug"], "finished_at": now}},
        )
        # Fresh article → poke search engines + Next.js ISR cache
        try:
            await notify_search_engines_for_slug(draft["slug"])
        except Exception as e:
            logger.exception("[AUTOPILOT] search-engine ping failed: %s", e)
        try:
            await revalidate_for_slug(draft["slug"])
        except Exception as e:
            logger.exception("[AUTOPILOT] Next.js revalidate failed: %s", e)
        logger.info("[AUTOPILOT] published /blog/%s from topic %r", draft["slug"], item["topic"])
        return {"ok": True, "slug": draft["slug"], "topic": item["topic"]}
    except Exception as e:
        logger.exception("[AUTOPILOT] failed to publish %r: %s", item.get("topic"), e)
        await autopilot_queue_collection.update_one(
            {"id": item["id"]},
            {"$set": {"status": "failed", "error": str(e)[:400], "finished_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": False, "error": str(e)}
