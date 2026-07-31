"""SEO / crawler-facing endpoints (mounted at the root, NOT under /api).

Includes:
  - /sitemap.xml         — dynamically generated sitemap listing all blog posts
  - /robots.txt          — robots directive + sitemap URL
  - /google<token>.html  — GSC HTML file-verification endpoint
  - /{indexnow_key}.txt  — IndexNow key-verification endpoint (Bing requires this file)
  - /api/site-config     — frontend polls this on boot for `google-site-verification`
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, Response

from deps import (
    blog_posts_collection, effective_site_settings,
    INDEXNOW_KEY,
)

router = APIRouter()


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml():
    settings = await effective_site_settings()
    base = settings["site_url"]
    posts = await blog_posts_collection.find({}, {"_id": 0, "slug": 1, "updated_at": 1}).to_list(500)
    urls = [
        f"  <url><loc>{base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>",
        f"  <url><loc>{base}/blog</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>",
    ]
    for p in posts:
        updated = (p.get("updated_at") or "")[:10]
        lastmod = f"<lastmod>{updated}</lastmod>" if updated else ""
        urls.append(
            f'  <url><loc>{base}/blog/{p["slug"]}</loc>'
            f'{lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>'
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=body, media_type="application/xml")


@router.get("/robots.txt", include_in_schema=False)
async def robots_txt():
    settings = await effective_site_settings()
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /admin/*\n"
        "Disallow: /api/\n\n"
        f"Sitemap: {settings['site_url']}/sitemap.xml\n"
    )
    return PlainTextResponse(content=body)


@router.get("/google{token}.html", include_in_schema=False)
async def google_verification_file(token: str):
    settings = await effective_site_settings()
    expected = settings.get("google_site_verification") or ""
    if expected and token == expected:
        return PlainTextResponse(f"google-site-verification: google{token}.html")
    raise HTTPException(status_code=404, detail="Not found")


@router.get("/{indexnow_key}.txt", include_in_schema=False)
async def indexnow_key_file(indexnow_key: str):
    """Serve the IndexNow key-verification file at the exact filename Bing expects.

    Only matches when the requested filename literally equals the configured
    INDEXNOW_KEY, so other `*.txt` paths still 404 correctly.
    """
    if INDEXNOW_KEY and indexnow_key == INDEXNOW_KEY:
        return PlainTextResponse(INDEXNOW_KEY)
    raise HTTPException(status_code=404, detail="Not found")


@router.get("/api/site-config")
async def site_config():
    """Frontend polls this on boot to inject the current google-site-verification meta tag."""
    return await effective_site_settings()
