"""Public blog + comments: /blog/posts, /blog/posts/{slug}, /blog/posts/{slug}/comments."""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from deps import (
    blog_posts_collection, comments_collection,
    limiter, COMMENTS_AUTO_APPROVE,
)
from models import BlogPost, CommentCreate
from integrations import send_webhook

router = APIRouter()

BLOG_LIST_PROJECTION = {
    "_id": 0, "slug": 1, "title": 1, "meta_description": 1, "excerpt": 1,
    "category": 1, "tags": 1, "hero_image": 1, "author": 1,
    "reading_time_minutes": 1, "published_at": 1,
}


@router.get("/blog/posts")
async def list_blog_posts(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 20,
):
    q: dict = {}
    if category:
        q["category"] = category
    if tag:
        q["tags"] = tag
    docs = await blog_posts_collection.find(q, BLOG_LIST_PROJECTION).sort("published_at", -1).to_list(limit)
    categories_cursor = blog_posts_collection.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ])
    categories: List[dict] = []
    async for row in categories_cursor:
        categories.append({"name": row["_id"], "count": row["count"]})
    return {"posts": docs, "count": len(docs), "categories": categories}


@router.get("/blog/posts/{slug}", response_model=BlogPost)
async def get_blog_post(slug: str):
    doc = await blog_posts_collection.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return BlogPost(**doc)


@router.get("/blog/posts/{slug}/comments")
async def list_comments(slug: str):
    post = await blog_posts_collection.find_one({"slug": slug}, {"_id": 0, "slug": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    docs = await comments_collection.find(
        {"post_slug": slug, "approved": True},
        {"_id": 0, "author_email": 0},
    ).sort("created_at", 1).to_list(500)
    return {"comments": docs, "count": len(docs)}


@router.post("/blog/posts/{slug}/comments")
@limiter.limit("10/hour")
async def create_comment(request: Request, slug: str, payload: CommentCreate, background_tasks: BackgroundTasks):
    post = await blog_posts_collection.find_one({"slug": slug}, {"_id": 0, "slug": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if payload.parent_id:
        parent = await comments_collection.find_one(
            {"id": payload.parent_id, "post_slug": slug}, {"_id": 0, "id": 1}
        )
        if not parent:
            raise HTTPException(status_code=400, detail="Parent comment not found")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "post_slug": slug,
        "author_name": payload.author_name.strip(),
        "author_email": payload.author_email,
        "body": payload.body.strip(),
        "parent_id": payload.parent_id,
        "approved": COMMENTS_AUTO_APPROVE,
        "created_at": now,
    }
    await comments_collection.insert_one({**doc})
    # Webhook: comment created (redacted for privacy — no author_email)
    background_tasks.add_task(
        send_webhook,
        "comment.created",
        {k: v for k, v in doc.items() if k != "author_email"},
    )
    return {
        "ok": True,
        "comment": {k: v for k, v in doc.items() if k != "author_email"},
        "pending_moderation": not COMMENTS_AUTO_APPROVE,
    }
