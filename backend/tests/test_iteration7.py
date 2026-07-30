"""
Iteration 7 tests: SEO plumbing (site-config, sitemap, robots, google verify),
threaded comments (public + admin moderation), Claude auto-article draft, admin
blog CRUD, plus quick regression on iter5/6 endpoints.
"""
import os
import time
import pytest
import requests

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v.strip().strip('"').strip("'"))
_load_frontend_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@aussieback.com"
ADMIN_PASSWORD = "Admin@123"
SITE_URL_DEFAULT = "https://aussieback.com"
SEEDED_SLUG = "how-to-claim-australian-super-refund-2026-guide"
CUSTOM_SLUG = "aussie-super-back"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/admin/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- SEO endpoints ----------------
class TestSEO:
    def test_site_config(self, s):
        r = s.get(f"{BASE_URL}/api/site-config")
        assert r.status_code == 200
        data = r.json()
        assert data["site_url"] == SITE_URL_DEFAULT
        assert data["google_site_verification"] is None  # empty env => null

    def test_sitemap_xml(self, s):
        r = s.get(f"{BASE_URL}/sitemap.xml")
        assert r.status_code == 200
        assert "application/xml" in r.headers.get("content-type", "")
        body = r.text
        assert SITE_URL_DEFAULT in body
        assert "<urlset" in body
        # Should include the seeded slug
        assert SEEDED_SLUG in body
        # count of <url> entries — 2 static + at least 6 seeded
        assert body.count("<url>") >= 8

    def test_robots_txt(self, s):
        r = s.get(f"{BASE_URL}/robots.txt")
        assert r.status_code == 200
        assert "text/plain" in r.headers.get("content-type", "")
        assert "Disallow: /admin" in r.text
        assert f"Sitemap: {SITE_URL_DEFAULT}/sitemap.xml" in r.text

    def test_google_verify_404_when_empty(self, s):
        r = s.get(f"{BASE_URL}/googleFAKETOKEN.html")
        # Backend returns 404 when GOOGLE_SITE_VERIFICATION is empty. If the
        # ingress does not route /google*.html to the backend (SPA catch-all
        # answers 200 with index.html), verify at least that it does NOT look
        # like a valid Google verification file.
        if r.status_code == 200:
            assert "google-site-verification" not in r.text.lower(), \
                "SPA is returning a valid-looking google-site-verification body"
            pytest.xfail("Ingress routes /google*.html to frontend SPA, not to "
                         "backend — backend endpoint unreachable via public URL.")
        else:
            assert r.status_code == 404


# ---------------- Public comments ----------------
class TestComments:
    def test_post_comment_auto_approved(self, s):
        payload = {
            "author_name": "TEST_Reviewer",
            "author_email": "TEST_reviewer@example.com",
            "body": "Great article, thanks!",
        }
        r = s.post(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["pending_moderation"] is False
        assert data["comment"]["author_name"] == "TEST_Reviewer"
        assert "author_email" not in data["comment"]  # never leaks
        pytest.parent_comment_id = data["comment"]["id"]

    def test_post_comment_missing_field_422(self, s):
        r = s.post(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments",
                   json={"author_name": "x", "body": "hi"})
        assert r.status_code == 422

    def test_post_comment_unknown_slug_404(self, s):
        r = s.post(f"{BASE_URL}/api/blog/posts/does-not-exist/comments",
                   json={"author_name": "x", "author_email": "x@y.com", "body": "hello"})
        assert r.status_code == 404

    def test_post_threaded_reply(self, s):
        parent_id = getattr(pytest, "parent_comment_id", None)
        assert parent_id, "parent comment id missing"
        r = s.post(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments",
                   json={"author_name": "TEST_Replier",
                         "author_email": "TEST_replier@example.com",
                         "body": "Reply body here",
                         "parent_id": parent_id})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["comment"]["parent_id"] == parent_id

    def test_get_comments_public(self, s):
        r = s.get(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 2
        # Never leaks email
        for c in data["comments"]:
            assert "author_email" not in c
        # ASC sort
        ts = [c["created_at"] for c in data["comments"]]
        assert ts == sorted(ts)


# ---------------- Admin comment moderation ----------------
class TestAdminComments:
    def test_list_all(self, s, auth_headers):
        r = s.get(f"{BASE_URL}/api/admin/comments", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 2

    def test_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/comments")
        assert r.status_code == 401

    def test_approve_and_delete(self, s, auth_headers):
        # Create a new comment
        cr = s.post(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments",
                    json={"author_name": "TEST_ModTarget",
                          "author_email": "TEST_mod@example.com",
                          "body": "moderate me"})
        assert cr.status_code == 200
        cid = cr.json()["comment"]["id"]

        pr = s.patch(f"{BASE_URL}/api/admin/comments/{cid}/approve",
                     headers=auth_headers)
        assert pr.status_code == 200
        assert pr.json()["ok"] is True

        dr = s.delete(f"{BASE_URL}/api/admin/comments/{cid}",
                      headers=auth_headers)
        assert dr.status_code == 200
        assert dr.json()["ok"] is True

        # Deleting again -> 404
        dr2 = s.delete(f"{BASE_URL}/api/admin/comments/{cid}",
                       headers=auth_headers)
        assert dr2.status_code == 404


# ---------------- Claude draft + publish + delete ----------------
class TestBlogStudio:
    def test_generate_draft(self, s, auth_headers):
        payload = {
            "topic": "How French backpackers can reclaim Australian super in 2026",
            "keywords": ["DASP", "French backpackers", "super refund"],
            "category": "By Country",
        }
        r = s.post(f"{BASE_URL}/api/admin/blog/generate-draft",
                   json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        draft = body["draft"]
        for k in ["slug", "title", "meta_description", "excerpt", "category",
                  "tags", "keywords", "reading_time_minutes", "content", "author"]:
            assert draft.get(k) is not None, f"missing {k}"
        assert len(draft["content"]) > 500
        assert isinstance(draft["tags"], list)

    def test_publish_update_delete(self, s, auth_headers):
        upsert = {
            "slug": CUSTOM_SLUG,
            "title": "Aussie Super Back — the complete refund guide",
            "meta_description": "Everything backpackers need to reclaim their Australian super refund fast.",
            "excerpt": "Reclaim your Australian super refund fast — the AussieBack complete guide.",
            "category": "Guide",
            "tags": ["dasp", "refund"],
            "keywords": ["australian super refund"],
            "hero_image": None,
            "author": "AussieBack Team",
            "reading_time_minutes": 5,
            "content": "## Intro\n\nThis is the guide body. " + ("x " * 60),
        }
        # First publish -> created
        r1 = s.post(f"{BASE_URL}/api/admin/blog/posts",
                    json=upsert, headers=auth_headers)
        assert r1.status_code == 200, r1.text
        data1 = r1.json()
        assert data1["created"] is True
        assert data1["slug"] == CUSTOM_SLUG

        # Public GET reflects it
        g = s.get(f"{BASE_URL}/api/blog/posts/{CUSTOM_SLUG}")
        assert g.status_code == 200
        assert g.json()["title"] == upsert["title"]

        # Re-publish -> created=False (update)
        upsert2 = {**upsert, "title": "Aussie Super Back — updated"}
        r2 = s.post(f"{BASE_URL}/api/admin/blog/posts",
                    json=upsert2, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["created"] is False
        g2 = s.get(f"{BASE_URL}/api/blog/posts/{CUSTOM_SLUG}")
        assert g2.json()["title"] == "Aussie Super Back — updated"

        # Delete
        d = s.delete(f"{BASE_URL}/api/admin/blog/posts/{CUSTOM_SLUG}",
                     headers=auth_headers)
        assert d.status_code == 200
        # Now 404
        g3 = s.get(f"{BASE_URL}/api/blog/posts/{CUSTOM_SLUG}")
        assert g3.status_code == 404


# ---------------- Regression from previous iterations ----------------
class TestRegression:
    def test_estimate(self, s):
        r = s.post(f"{BASE_URL}/api/estimate",
                   json={"visa_type": "working_holiday",
                         "input_mode": "balance",
                         "super_balance": 10000})
        assert r.status_code == 200
        assert r.json()["estimated_refund"] == 3500.0  # 10000 * 0.35

    def test_blog_list(self, s):
        r = s.get(f"{BASE_URL}/api/blog/posts")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 6
        assert len(data["categories"]) >= 1

    def test_admin_analytics(self, s, auth_headers):
        r = s.get(f"{BASE_URL}/api/admin/analytics", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        assert "share_events" in j and "referrals" in j

    def test_weekly_digest_run(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/admin/weekly-digest/run", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True
