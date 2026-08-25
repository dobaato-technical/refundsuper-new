"""Iteration 15 regression: SEO endpoints via public origin, brand strings, core flows."""
import os
import re
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
INDEXNOW_KEY = backend_env.get("INDEXNOW_KEY", "647f5986a2933034e28889e98ce979f3")

ADMIN_EMAIL = "admin@aussieback.com"
ADMIN_PASSWORD = "doWhatYou@321"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post(f"{BASE_URL}/api/admin/login",
                    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- SEO endpoints (NEW: Next.js rewrites) ----------------
class TestSeoEndpoints:
    def test_sitemap_public(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        assert r.status_code == 200, r.text[:300]
        assert "<urlset" in r.text
        assert "refundsuper.com.au" in r.text
        assert "aussieback.com" not in r.text
        # every loc should be canonical
        locs = re.findall(r"<loc>(.*?)</loc>", r.text)
        assert len(locs) >= 5
        assert all(l.startswith("https://refundsuper.com.au") for l in locs), locs

    def test_indexnow_key_public(self, client):
        r = client.get(f"{BASE_URL}/{INDEXNOW_KEY}.txt")
        assert r.status_code == 200, r.text[:200]
        assert r.text.strip() == INDEXNOW_KEY

    def test_indexnow_wrong_key_404(self, client):
        r = client.get(f"{BASE_URL}/{'a' * 32}.txt")
        assert r.status_code == 404

    def test_robots_backend_internal(self):
        # public /robots.txt is intercepted by the preview edge - verify origin
        r = requests.get("http://localhost:8001/robots.txt", timeout=15)
        assert r.status_code == 200
        assert "Disallow: /admin" in r.text
        assert "https://refundsuper.com.au/sitemap.xml" in r.text

    def test_site_config(self, client):
        r = client.get(f"{BASE_URL}/api/site-config")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)


# ---------------- Admin auth / password rotation ----------------
class TestAdminAuth:
    def test_login_ok(self, client):
        r = client.post(f"{BASE_URL}/api/admin/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["admin_email"] == ADMIN_EMAIL
        assert d["token_type"].lower() == "bearer"
        assert len(d["access_token"].split(".")) == 3

    def test_old_password_rejected(self, client):
        r = client.post(f"{BASE_URL}/api/admin/login",
                        json={"email": ADMIN_EMAIL, "password": "Admin@123"})
        assert r.status_code == 401

    def test_protected_requires_token(self, client):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in (401, 403)


# ---------------- Estimator + lead capture ----------------
class TestEstimatorAndLeads:
    created = []

    def test_estimate_balance(self, client):
        r = client.post(f"{BASE_URL}/api/estimate", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 8000})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["estimated_refund"] > 0
        assert d["estimated_refund"] < 8000

    def test_estimate_earnings(self, client):
        r = client.post(f"{BASE_URL}/api/estimate", json={
            "visa_type": "other_temp", "input_mode": "earnings", "gross_earnings": 40000})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["estimated_refund"] > 0

    def test_estimate_validation(self, client):
        r = client.post(f"{BASE_URL}/api/estimate", json={"visa_type": "bogus"})
        assert r.status_code == 422

    def test_lead_create_and_persist(self, client, auth):
        email = f"TEST_qa15_{uuid.uuid4().hex[:8]}@example.com"
        r = client.post(f"{BASE_URL}/api/leads", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 8000,
            "estimated_refund": 5000, "first_name": "TEST_QA15", "email": email,
            "whatsapp_number": "+61491570006", "utm_source": "qa15"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("referral_code")
        TestEstimatorAndLeads.created.append(email)

        lr = requests.get(f"{BASE_URL}/api/admin/leads", headers=auth)
        assert lr.status_code == 200
        payload = lr.json()
        rows = payload if isinstance(payload, list) else payload.get("leads", [])
        assert any(x.get("email") == email for x in rows), "lead not persisted"
        assert all("_id" not in x for x in rows), "raw mongo _id leaked"

    def test_lead_bad_phone_rejected(self, client):
        r = client.post(f"{BASE_URL}/api/leads", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 8000,
            "estimated_refund": 5000, "first_name": "TEST_QA15", "email": "TEST_bad@example.com",
            "whatsapp_number": "0491570006"})
        assert r.status_code == 422


# ---------------- Blog public + brand strings ----------------
class TestBlogPublic:
    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/blog/posts")
        assert r.status_code == 200
        payload = r.json()
        posts = payload if isinstance(payload, list) else payload.get("posts", [])
        assert len(posts) >= 1
        assert all("_id" not in p for p in posts)
        for p in posts:
            if "author" in p:
                assert p["author"] == "refundmysuper Team", p
        return posts

    def test_detail_and_ssr(self, client):
        slug = "how-to-claim-australian-super-refund-2026-guide"
        r = client.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert r.status_code == 200
        assert r.json()["author"] == "refundmysuper Team"

        html = requests.get(f"{BASE_URL}/blog/{slug}", timeout=60).text
        assert "<h1" in html
        assert "application/ld+json" in html

    def test_blog_list_ssr(self):
        html = requests.get(f"{BASE_URL}/blog", timeout=60).text
        assert "<h1" in html

    def test_unknown_slug_404(self, client):
        r = client.get(f"{BASE_URL}/api/blog/posts/no-such-slug-qa15")
        assert r.status_code == 404


# ---------------- Admin dashboard / outbox ----------------
class TestAdminDashboard:
    def test_stats(self, auth):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_analytics(self, auth):
        for path in ["/api/admin/analytics", "/api/admin/referrers", "/api/admin/utm"]:
            r = requests.get(f"{BASE_URL}{path}", headers=auth)
            assert r.status_code in (200, 404), f"{path} -> {r.status_code} {r.text[:200]}"

    def test_outbox_list(self, auth):
        r = requests.get(f"{BASE_URL}/api/admin/outbox", headers=auth)
        assert r.status_code == 200
        payload = r.json()
        rows = payload if isinstance(payload, list) else payload.get("items", payload.get("outbox", []))
        assert isinstance(rows, list)
        assert all("_id" not in x for x in rows)

    def test_comments_list(self, auth):
        r = requests.get(f"{BASE_URL}/api/admin/blog/comments", headers=auth)
        assert r.status_code in (200, 404)


# ---------------- Cleanup ----------------
@pytest.fixture(scope="session", autouse=True)
def cleanup(auth):
    yield
    try:
        r = requests.get(f"{BASE_URL}/api/admin/leads", headers=auth, timeout=30)
        payload = r.json()
        rows = payload if isinstance(payload, list) else payload.get("leads", [])
        for lead in rows:
            if str(lead.get("email", "")).startswith("TEST_qa15") or \
               str(lead.get("first_name", "")) == "TEST_QA15":
                lid = lead.get("id") or lead.get("lead_id")
                if lid:
                    requests.delete(f"{BASE_URL}/api/admin/leads/{lid}", headers=auth, timeout=30)
    except Exception as exc:  # noqa: BLE001
        print(f"cleanup skipped: {exc}")
