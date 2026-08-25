"""Iteration 14 regression tests — post Suspense-wrap + serverApi env-guard + password rotation."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text()
    email = re.search(r"(?im)^\s*[-*]?\s*Email:\s*`?([^`\s]+)", content).group(1)
    pwd = re.search(r"(?im)^\s*[-*]?\s*Password:\s*`?([^`\s]+)", content).group(1)
    return email, pwd


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(client):
    email, pwd = _creds()
    r = client.post(f"{BASE_URL}/api/admin/login", json={"email": email, "password": pwd})
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert data["admin_email"] == email
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20
    return data["access_token"]


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ---------- auth ----------
class TestAuth:
    def test_login_new_password(self, token):
        assert token

    def test_old_password_rejected(self, client):
        email, _ = _creds()
        r = client.post(f"{BASE_URL}/api/admin/login", json={"email": email, "password": "Admin@123"})
        assert r.status_code == 401

    def test_me(self, auth):
        r = auth.get(f"{BASE_URL}/api/admin/me")
        assert r.status_code == 200
        assert r.json()["email"] == _creds()[0]

    def test_admin_route_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in (401, 403)


# ---------- public: estimate / leads ----------
class TestEstimateAndLeads:
    created = []

    def test_estimate(self, client):
        r = client.post(f"{BASE_URL}/api/estimate", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 8000,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["balance"] == 8000
        assert d["tax_rate"] == 0.65
        assert d["estimated_refund"] == pytest.approx(8000 * 0.35)

    def test_estimate_invalid(self, client):
        r = client.post(f"{BASE_URL}/api/estimate", json={"visa_type": "417", "input_mode": "balance"})
        assert r.status_code == 422

    def test_create_lead_and_referral(self, client):
        payload = {
            "visa_type": "working_holiday",
            "input_mode": "balance",
            "super_balance": 8000,
            "estimated_refund": 2800.0,
            "first_name": "TEST_QA14",
            "email": "TEST_qa_iter14@example.com",
            "whatsapp_number": "+61491570006",
            "super_fund_name": "TEST Fund",
            "date_left_australia": "2025-01-01",
        }
        r = client.post(f"{BASE_URL}/api/leads", json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert "_id" not in d
        assert d["email"] == payload["email"]
        assert d.get("referral_code")
        TestEstimateAndLeads.created.append((d["id"], d["referral_code"]))

        rr = client.get(f"{BASE_URL}/api/referrals/{d['referral_code']}")
        assert rr.status_code == 200
        prog = client.get(f"{BASE_URL}/api/referrals/{d['referral_code']}/progress")
        assert prog.status_code == 200

    def test_lead_visible_in_admin(self, auth):
        r = auth.get(f"{BASE_URL}/api/admin/leads", params={"limit": 50})
        assert r.status_code == 200
        body = r.json()
        rows = body if isinstance(body, list) else body.get("leads", [])
        assert any("TEST_qa_iter14@example.com" == x.get("email") for x in rows)


# ---------- blog ----------
class TestBlog:
    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/blog/posts", params={"limit": 5})
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert len(posts) > 0
        assert all("_id" not in p for p in posts)

    def test_detail_and_404(self, client):
        slug = client.get(f"{BASE_URL}/api/blog/posts", params={"limit": 1}).json()["posts"][0]["slug"]
        r = client.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert r.status_code == 200
        assert r.json()["slug"] == slug
        assert client.get(f"{BASE_URL}/api/blog/posts/no-such-slug-xyz").status_code == 404

    def test_comments_post_and_read(self, client):
        slug = client.get(f"{BASE_URL}/api/blog/posts", params={"limit": 1}).json()["posts"][0]["slug"]
        r = client.post(f"{BASE_URL}/api/blog/posts/{slug}/comments", json={
            "author_name": "TEST_QA14", "author_email": "TEST_qa14@example.com",
            "body": "TEST_QA14 automated regression comment for iteration 14.",
        })
        assert r.status_code in (200, 201), r.text
        g = client.get(f"{BASE_URL}/api/blog/posts/{slug}/comments")
        assert g.status_code == 200
        items = g.json() if isinstance(g.json(), list) else g.json().get("comments", [])
        assert any("TEST_QA14" in (c.get("author_name") or "") for c in items)


# ---------- admin dashboards ----------
class TestAdminEndpoints:
    @pytest.mark.parametrize("path", [
        "/api/admin/stats", "/api/admin/analytics", "/api/admin/outbox",
        "/api/admin/comments", "/api/admin/site-settings", "/api/admin/autopilot",
    ])
    def test_get_ok(self, auth, path):
        r = auth.get(f"{BASE_URL}{path}")
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_stats_shape(self, auth):
        d = auth.get(f"{BASE_URL}/api/admin/stats").json()
        assert isinstance(d, dict) and len(d) > 0

    def test_export(self, auth):
        r = auth.get(f"{BASE_URL}/api/admin/leads/export")
        assert r.status_code == 200
        assert "," in r.text

    def test_outbox_process_now(self, auth):
        r = auth.post(f"{BASE_URL}/api/admin/outbox/process-now", json={})
        assert r.status_code == 200, r.text

    def test_site_config_public(self, client):
        r = client.get(f"{BASE_URL}/api/site-config")
        assert r.status_code == 200


# ---------- seo files ----------
class TestSeo:
    @pytest.mark.parametrize("path,needle", [("/sitemap.xml", "<urlset"), ("/robots.txt", "Sitemap")])
    def test_seo(self, client, path, needle):
        r = client.get(f"{BASE_URL}{path}")
        assert r.status_code == 200
        assert needle in r.text


# ---------- blog create (IndexNow + revalidate) ----------
class TestBlogCreate:
    slug = "test-qa14-temp-post"

    def test_create_and_delete(self, auth, client):
        r = auth.post(f"{BASE_URL}/api/admin/blog/posts", json={
            "slug": self.slug,
            "title": "TEST_QA14 Temp Post",
            "meta_description": "TEST temp post for iteration 14 regression.",
            "category": "Guide",
            "tags": ["test"],
            "content": "## Hello\n\nTEST body content for QA regression run in iteration fourteen, long enough to pass validation.",
            "excerpt": "TEST excerpt for iteration14",
            "author": "QA",
            "reading_time_minutes": 1,
        })
        assert r.status_code in (200, 201), r.text
        g = client.get(f"{BASE_URL}/api/blog/posts/{self.slug}")
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_QA14 Temp Post"

        d = auth.delete(f"{BASE_URL}/api/admin/blog/posts/{self.slug}")
        assert d.status_code in (200, 204), d.text
        assert client.get(f"{BASE_URL}/api/blog/posts/{self.slug}").status_code == 404
