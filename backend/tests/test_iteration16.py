"""Iteration 16 — backend brand sweep verification (AussieBack -> refundmysuper)."""
import os
import re
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "admin@aussieback.com"
ADMIN_PASSWORD = "doWhatYou@321"
TEST_SLUG = "aussie-super-back"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok and len(tok.split(".")) == 3
    return tok


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- CRITICAL: default author on new blog post ---
class TestDefaultAuthor:
    def test_publish_without_author_defaults_to_refundmysuper(self, auth):
        payload = {
            "slug": TEST_SLUG,
            "title": "TEST_ Aussie Super Back Brand Check",
            "meta_description": "TEST_ meta description for brand default author verification run.",
            "excerpt": "TEST_ excerpt for brand default author verification run in iteration sixteen.",
            "category": "Guides",
            "content": "TEST_ body content. " * 20,
        }
        r = requests.post(f"{API}/admin/blog/posts", json=payload, headers=auth, timeout=60)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:400]}"
        body = r.json()
        assert "_id" not in str(body), "MongoDB _id leaked in response"
        try:
            g = requests.get(f"{API}/blog/posts/{TEST_SLUG}", timeout=30)
            assert g.status_code == 200, g.text[:300]
            post = g.json()
            assert "_id" not in post
            assert post["author"] == "refundmysuper Team", f"author={post['author']!r}"
        finally:
            d = requests.delete(f"{API}/admin/blog/posts/{TEST_SLUG}", headers=auth, timeout=30)
            assert d.status_code in (200, 204, 404)
            assert requests.get(f"{API}/blog/posts/{TEST_SLUG}", timeout=30).status_code == 404


# --- MINOR: seeded blog content clean ---
class TestSeededBlogBrand:
    def test_blog_list_no_aussieback(self):
        r = requests.get(f"{API}/blog/posts?limit=100", timeout=30)
        assert r.status_code == 200
        assert "aussieback" not in r.text.lower().replace("aussieback-case-study-japanese-student-6180", "")

    def test_each_post_detail_no_aussieback(self):
        r = requests.get(f"{API}/blog/posts?limit=100", timeout=30)
        data = r.json()
        posts = data if isinstance(data, list) else data.get("posts", data.get("items", []))
        assert len(posts) > 0
        offenders = {}
        for p in posts:
            slug = p["slug"]
            d = requests.get(f"{API}/blog/posts/{slug}", timeout=30)
            assert d.status_code == 200, slug
            post = d.json()
            hay = " ".join(str(post.get(k, "")) for k in
                           ("title", "excerpt", "meta_description", "content", "author"))
            hay += " " + " ".join(post.get("keywords", []) or []) + " " + " ".join(post.get("tags", []) or [])
            hits = len(re.findall("aussieback", hay, re.I))
            if hits:
                offenders[slug] = hits
        assert not offenders, f"AussieBack still present: {offenders}"

    def test_keyword_tag_arrays_clean(self):
        r = requests.get(f"{API}/blog/posts?limit=100", timeout=30)
        data = r.json()
        posts = data if isinstance(data, list) else data.get("posts", data.get("items", []))
        bad = []
        for p in posts:
            for arr in (p.get("keywords") or [], p.get("tags") or []):
                for t in arr:
                    if t.strip().lower() == "aussieback":
                        bad.append((p["slug"], t))
        assert not bad, bad


# --- MINOR: health + openapi ---
class TestServiceIdentity:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["service"] == "refundmysuper API"
        assert d["status"] == "ok"

    def test_openapi_title(self):
        # /openapi.json is not exposed through the ingress (only /api/* routes to the
        # backend), so assert against the backend origin.
        r = requests.get("http://localhost:8001/openapi.json", timeout=30)
        assert r.status_code == 200, r.status_code
        assert r.json()["info"]["title"] == "refundmysuper API"


# --- MINOR: CSV export filename ---
class TestCsvExport:
    def test_export_filename(self, auth):
        r = requests.get(f"{API}/admin/leads/export", headers=auth, timeout=60)
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert cd == "attachment; filename=refundmysuper_leads.csv", cd

    def test_export_requires_auth(self):
        r = requests.get(f"{API}/admin/leads/export", timeout=30)
        assert r.status_code in (401, 403)


# --- MINOR: SSR HTML clean ---
class TestSsrHtml:
    @pytest.mark.parametrize("path", [
        "/blog",
        "/blog/aussieback-case-study-japanese-student-6180",
        "/blog/how-to-claim-australian-super-refund-2026-guide",
        "/blog/working-holiday-visa-super-refund-guide",
        "/blog/student-visa-500-super-refund",
        "/blog/uk-backpackers-claim-super-from-london",
        "/blog/5-dasp-refund-mistakes-that-cost-you-thousands",
    ])
    def test_ssr_no_aussieback(self, path):
        r = requests.get(f"{BASE}{path}", timeout=60)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        # The legacy slug is intentionally retained this iteration (URL migration deferred).
        text = r.text.replace("aussieback-case-study-japanese-student-6180", "LEGACY_SLUG")
        hits = len(re.findall("aussieback", text, re.I))
        assert hits == 0, f"{path} has {hits} AussieBack occurrences"

    def test_blog_ssr_h1(self):
        r = requests.get(f"{BASE}/blog", timeout=60)
        assert "<h1" in r.text.lower()


# --- outbound copy: lead submit triggers Resend/WhatsApp templates ---
class TestOutboundCopy:
    def test_lead_flow_and_digest(self, auth):
        est = requests.post(f"{API}/estimate", json={
            "visa_type": "working_holiday", "input_mode": "earnings", "gross_earnings": 30000,
        }, timeout=30)
        assert est.status_code == 200, est.text[:300]
        estimated = est.json()["estimated_refund"]
        lead = requests.post(f"{API}/leads", json={
            "visa_type": "working_holiday", "input_mode": "earnings", "gross_earnings": 30000,
            "estimated_refund": estimated, "first_name": "TESTQA16",
            "email": "testqa16.brand@example.com", "whatsapp_number": "+61400000123",
            "utm_source": "qa16",
        }, timeout=60)
        assert lead.status_code in (200, 201), f"{lead.status_code}: {lead.text[:400]}"
        lid = lead.json().get("id") or lead.json().get("lead_id")
        time.sleep(3)
        dg = requests.post(f"{API}/admin/weekly-digest/run", headers=auth, timeout=90)
        assert dg.status_code == 200, f"{dg.status_code}: {dg.text[:400]}"
        assert "aussieback" not in dg.text.lower()
        # cleanup — there is no admin DELETE endpoint for leads, so the test lead and
        # its outbox row must be removed directly from MongoDB.
        assert lid, "lead response did not include an id"
        _cleanup_lead("testqa16.brand@example.com")


def _cleanup_lead(email: str):
    import asyncio
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv("/app/backend/.env")

    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        await db.leads.delete_many({"email": email})
        await db.webhook_outbox.delete_many({"body": {"$regex": email}})
        assert await db.leads.count_documents({"email": email}) == 0

    asyncio.run(_run())
