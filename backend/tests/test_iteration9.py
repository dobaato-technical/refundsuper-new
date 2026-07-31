"""Iteration 9 tests: SSR migration + Autopilot Requeue + Comments delete-confirm backend endpoints."""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"email": "admin@aussieback.com", "password": "Admin@123"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# ---------- SSR checks (public HTML must contain H1) ----------
class TestSSR:
    def test_home_ssr_h1(self):
        html = requests.get(f"{BASE_URL}/", timeout=15).text
        assert "Left Australia" in html, "Landing hero H1 not present in raw HTML"

    def test_blog_list_ssr(self):
        html = requests.get(f"{BASE_URL}/blog", timeout=15).text
        assert "<h1" in html
        # Should contain at least one article title from seeded blog posts
        assert "Super Refund" in html or "Working Holiday" in html

    def test_blog_post_ssr(self):
        slug = "working-holiday-visa-super-refund-guide"
        html = requests.get(f"{BASE_URL}/blog/{slug}", timeout=15).text
        assert "<h1" in html
        assert "Working Holiday Visa 417/462" in html


# ---------- Public blog API ----------
class TestBlogAPI:
    def test_list_posts(self):
        r = requests.get(f"{API}/blog/posts", timeout=10)
        assert r.status_code == 200
        data = r.json()
        posts = data if isinstance(data, list) else data.get("posts", data.get("items", []))
        assert len(posts) >= 6

    def test_get_post(self):
        r = requests.get(f"{API}/blog/posts/working-holiday-visa-super-refund-guide", timeout=10)
        assert r.status_code == 200
        assert "Working Holiday" in r.json().get("title", "")

    def test_missing_post_404(self):
        r = requests.get(f"{API}/blog/posts/does-not-exist-xyz", timeout=10)
        assert r.status_code == 404


# ---------- Lead flow + rate limit ----------
class TestLead:
    def test_lead_submit(self):
        payload = {
            "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
            "first_name": "Test",
            "visa_type": "working_holiday",
            "input_mode": "balance",
            "know_balance": True,
            "balance": 12000,
            "estimated_refund": 4200,
            "super_fund": "AustralianSuper",
            "date_left_au": "2024-06-01",
            "whatsapp_number": "+61400000000",
        }
        r = requests.post(f"{API}/leads", json=payload, timeout=10)
        assert r.status_code in (200, 201), r.text


# ---------- Comments delete flow ----------
class TestCommentsAdmin:
    def test_delete_comment_flow(self, auth_headers, mongo_db):
        # Grab any published post
        posts = requests.get(f"{API}/blog/posts", timeout=10).json()
        posts = posts if isinstance(posts, list) else posts.get("posts", posts.get("items", []))
        post = posts[0]
        # Post a comment
        comment_body = {
            "post_slug": post["slug"],
            "author_name": "TEST_Author",
            "author_email": "test_author@example.com",
            "body": "TEST comment for deletion",
        }
        r = requests.post(f"{API}/blog/posts/{post['slug']}/comments", json=comment_body, timeout=10)
        assert r.status_code in (200, 201, 202), r.text
        # Fetch admin comments list to find our comment id
        rc = requests.get(f"{API}/admin/comments", headers=auth_headers, timeout=10)
        assert rc.status_code == 200
        comments = rc.json() if isinstance(rc.json(), list) else rc.json().get("comments", [])
        target = next((c for c in comments if c.get("author_name") == "TEST_Author"), None)
        assert target is not None, "Could not find our test comment"
        cid = target.get("id") or target.get("_id")
        # Delete
        rd = requests.delete(f"{API}/admin/comments/{cid}", headers=auth_headers, timeout=10)
        assert rd.status_code in (200, 204), rd.text
        # Verify gone
        rc2 = requests.get(f"{API}/admin/comments", headers=auth_headers, timeout=10)
        comments2 = rc2.json() if isinstance(rc2.json(), list) else rc2.json().get("comments", [])
        assert not any((c.get("id") == cid or c.get("_id") == cid) for c in comments2)


# ---------- Autopilot Requeue (NEW) ----------
class TestAutopilotRequeue:
    def _create_queue_item(self, auth_headers):
        r = requests.post(
            f"{API}/admin/autopilot/queue",
            headers=auth_headers,
            json={"topic": f"TEST topic {uuid.uuid4().hex[:6]}", "keywords": ["test"], "category": "guide"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        return r.json()["item"]["id"]

    def test_requeue_on_queued_returns_400(self, auth_headers):
        item_id = self._create_queue_item(auth_headers)
        try:
            r = requests.post(f"{API}/admin/autopilot/queue/{item_id}/requeue", headers=auth_headers, timeout=10)
            assert r.status_code == 400
            assert "failed" in r.text.lower()
        finally:
            requests.delete(f"{API}/admin/autopilot/queue/{item_id}", headers=auth_headers)

    def test_requeue_nonexistent_returns_404(self, auth_headers):
        r = requests.post(f"{API}/admin/autopilot/queue/does-not-exist-xyz/requeue", headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_requeue_failed_item_success(self, auth_headers, mongo_db):
        item_id = self._create_queue_item(auth_headers)
        try:
            # Force failed status via DB
            res = mongo_db["autopilot_queue"].update_one(
                {"id": item_id},
                {"$set": {"status": "failed", "error": "TEST induced failure"}},
            )
            assert res.modified_count == 1
            # Requeue
            r = requests.post(f"{API}/admin/autopilot/queue/{item_id}/requeue", headers=auth_headers, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True
            # Verify status flipped
            doc = mongo_db["autopilot_queue"].find_one({"id": item_id})
            assert doc["status"] == "queued"
            assert "error" not in doc or not doc.get("error")
        finally:
            requests.delete(f"{API}/admin/autopilot/queue/{item_id}", headers=auth_headers)


# ---------- Auth guard ----------
class TestAdminAuth:
    def test_unauthenticated_admin_endpoints(self):
        for path in ["/admin/comments", "/admin/autopilot", "/admin/leads"]:
            r = requests.get(f"{API}{path}", timeout=10)
            assert r.status_code in (401, 403), f"{path} returned {r.status_code}"
