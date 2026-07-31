"""Iteration 10: Router-split regression + HMAC-signed webhook + IndexNow/GSC ping."""
import os
import hmac
import hashlib
import json
import uuid
import time
import socket
import threading
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
INTERNAL = "http://localhost:8001"

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

REAL_SLUG = "working-holiday-visa-super-refund-guide"


# ---------- Fixtures ----------
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


def _valid_lead_payload():
    return {
        "visa_type": "working_holiday",
        "input_mode": "balance",
        "super_balance": 12000.0,
        "estimated_refund": 4200.0,
        "first_name": "TEST_Iter10",
        "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
        "whatsapp_number": "+61491570006",  # valid AU test number
    }


# ---------- Regression: core endpoints ----------
class TestRegression:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200

    def test_estimate(self):
        r = requests.post(f"{API}/estimate", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 10000
        }, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "estimated_refund" in data

    def test_blog_list(self):
        r = requests.get(f"{API}/blog/posts", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["posts"]) >= 1

    def test_blog_post_get_real_slug(self):
        r = requests.get(f"{API}/blog/posts/{REAL_SLUG}", timeout=10)
        assert r.status_code == 200
        assert "Working Holiday" in r.json()["title"]

    def test_blog_post_missing_slug_from_review_404(self):
        # Review request mentions aussie-super-back which doesn't exist — verify 404
        r = requests.get(f"{API}/blog/posts/aussie-super-back", timeout=10)
        assert r.status_code == 404

    def test_comments_list(self):
        r = requests.get(f"{API}/blog/posts/{REAL_SLUG}/comments", timeout=10)
        assert r.status_code == 200

    def test_referrals_404(self):
        r = requests.get(f"{API}/referrals/NOPE1234", timeout=10)
        assert r.status_code == 404

    def test_admin_login_success(self, admin_token):
        assert admin_token

    def test_admin_login_fail(self):
        r = requests.post(f"{API}/admin/login", json={"email": "admin@aussieback.com", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_admin_leads(self, auth_headers):
        r = requests.get(f"{API}/admin/leads", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "leads" in r.json()

    def test_admin_stats(self, auth_headers):
        r = requests.get(f"{API}/admin/stats", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "total_leads" in r.json()

    def test_admin_analytics(self, auth_headers):
        r = requests.get(f"{API}/admin/analytics", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "share_events" in r.json()

    def test_admin_leads_export(self, auth_headers):
        r = requests.get(f"{API}/admin/leads/export", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_admin_comments_list(self, auth_headers):
        r = requests.get(f"{API}/admin/comments", headers=auth_headers, timeout=10)
        assert r.status_code == 200

    def test_admin_site_settings_get(self, auth_headers):
        r = requests.get(f"{API}/admin/site-settings", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "effective" in r.json()

    def test_admin_autopilot_get(self, auth_headers):
        r = requests.get(f"{API}/admin/autopilot", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "config" in r.json()

    def test_share_event(self):
        r = requests.post(f"{API}/share-events", json={"channel": "copy"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_admin_auth_guard(self):
        for path in ["/admin/leads", "/admin/stats", "/admin/autopilot", "/admin/comments", "/admin/site-settings"]:
            r = requests.get(f"{API}{path}", timeout=10)
            assert r.status_code in (401, 403), f"{path} returned {r.status_code}"

    def test_ping_search_engines_no_keys(self, auth_headers):
        r = requests.post(f"{API}/admin/blog/ping-search-engines?slug={REAL_SLUG}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        # Both should be None (no keys configured)
        assert body["result"]["indexnow"] is None
        assert body["result"]["gsc"] is None
        assert isinstance(body["result"]["urls"], list) and len(body["result"]["urls"]) >= 1


# ---------- Regression: root-level SEO (internal only — ingress won't route these) ----------
class TestRootSEO:
    def test_sitemap(self):
        r = requests.get(f"{INTERNAL}/sitemap.xml", timeout=10)
        assert r.status_code == 200
        assert "<urlset" in r.text

    def test_robots(self):
        r = requests.get(f"{INTERNAL}/robots.txt", timeout=10)
        assert r.status_code == 200
        assert "Sitemap:" in r.text

    def test_indexnow_key_file_404_when_unset(self):
        # No INDEXNOW_KEY configured → any random .txt should 404
        r = requests.get(f"{INTERNAL}/random-not-configured-abc123.txt", timeout=10)
        assert r.status_code == 404


# ---------- Lead flow (rate-limited 5/hour so run once) ----------
class TestLeadFlow:
    def test_create_lead(self, mongo_db):
        r = requests.post(f"{API}/leads", json=_valid_lead_payload(), timeout=10)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert "id" in data
        # Cleanup
        mongo_db["leads"].delete_one({"id": data["id"]})


# ---------- Unchanged-status idempotency ----------
class TestStatusUnchanged:
    def test_status_same_returns_unchanged(self, auth_headers, mongo_db):
        # Insert a test lead directly to bypass rate limit
        lead_id = str(uuid.uuid4())
        mongo_db["leads"].insert_one({
            "id": lead_id, "visa_type": "working_holiday", "input_mode": "balance",
            "super_balance": 10000, "estimated_refund": 3500,
            "first_name": "TEST_UNCH", "email": "unchanged@test.com", "whatsapp_number": "+61491570006",
            "status": "contacted", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        })
        try:
            r = requests.patch(f"{API}/admin/leads/{lead_id}/status", headers=auth_headers, json={"status": "contacted"}, timeout=10)
            assert r.status_code == 200
            body = r.json()
            assert body.get("unchanged") is True
            # Change status now
            r2 = requests.patch(f"{API}/admin/leads/{lead_id}/status", headers=auth_headers, json={"status": "documents_received"}, timeout=10)
            assert r2.status_code == 200
            assert r2.json().get("unchanged") is not True
        finally:
            mongo_db["leads"].delete_one({"id": lead_id})


# ---------- HMAC signature format (unit test of _sign_payload) ----------
class TestHMACSigning:
    def test_sign_format(self):
        # Reproduce sha256=<hex> convention
        secret = "test"
        body = b'{"event":"lead.created"}'
        expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        # 64 hex chars after 'sha256='
        assert expected.startswith("sha256=")
        assert len(expected) == len("sha256=") + 64
        # Verify against integrations._sign_payload with WEBHOOK_SECRET set
        import importlib, sys
        # Force reload with env override
        os.environ["WEBHOOK_SECRET"] = secret
        sys.path.insert(0, "/app/backend")
        # Reload deps + integrations to pick up new env
        if "deps" in sys.modules:
            importlib.reload(sys.modules["deps"])
        import integrations
        importlib.reload(integrations)
        sig = integrations._sign_payload(body)
        assert sig == expected


# ---------- Live webhook capture (spawn local server, reconfigure backend, submit events) ----------
class CaptureHandler(BaseHTTPRequestHandler):
    captured = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        CaptureHandler.captured.append({
            "event": self.headers.get("X-AussieBack-Event"),
            "signature": self.headers.get("X-AussieBack-Signature"),
            "body": body,
        })
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args, **kwargs):
        pass


@pytest.fixture(scope="module")
def webhook_capture():
    """Start local HTTP capture, patch .env, restart backend, yield captured events."""
    CaptureHandler.captured = []
    # Find free port
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    server = HTTPServer(("127.0.0.1", port), CaptureHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()

    env_path = "/app/backend/.env"
    with open(env_path) as f:
        original = f.read()
    secret = "iter10-test-secret"
    with open(env_path, "w") as f:
        f.write(original.rstrip() + f'\nWEBHOOK_URL="http://127.0.0.1:{port}"\nWEBHOOK_SECRET="{secret}"\n')
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    # Wait for backend
    for _ in range(30):
        try:
            r = requests.get(f"{API}/", timeout=2)
            if r.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)

    yield {"port": port, "secret": secret, "captured": CaptureHandler.captured}

    # Restore .env & restart
    with open(env_path, "w") as f:
        f.write(original)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    for _ in range(30):
        try:
            if requests.get(f"{API}/", timeout=2).status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)
    server.shutdown()


class TestWebhookLive:
    def test_all_four_events_signed(self, webhook_capture, auth_headers, mongo_db):
        secret = webhook_capture["secret"]
        captured = webhook_capture["captured"]

        # Re-fetch token since backend restarted (JWT still valid but do a fresh login)
        r = requests.post(f"{API}/admin/login", json={"email": "admin@aussieback.com", "password": "Admin@123"}, timeout=10)
        assert r.status_code == 200
        hdrs = {"Authorization": f"Bearer {r.json()['access_token']}"}

        # 1. lead.created
        lead_r = requests.post(f"{API}/leads", json=_valid_lead_payload(), timeout=10)
        assert lead_r.status_code in (200, 201), lead_r.text
        lead_id = lead_r.json()["id"]

        # 2. lead.status_changed
        st = requests.patch(f"{API}/admin/leads/{lead_id}/status", headers=hdrs, json={"status": "contacted"}, timeout=10)
        assert st.status_code == 200

        # 3. comment.created
        c = requests.post(f"{API}/blog/posts/{REAL_SLUG}/comments", json={
            "author_name": "TEST_WH", "author_email": "wh@test.com", "body": "TEST webhook capture body"
        }, timeout=10)
        assert c.status_code in (200, 201)

        # 4. share_event.created
        s = requests.post(f"{API}/share-events", json={"channel": "copy"}, timeout=10)
        assert s.status_code == 200

        # Give background tasks a moment
        time.sleep(3)

        events_seen = {c["event"] for c in captured}
        print(f"[TEST] Captured events: {events_seen}")
        assert "lead.created" in events_seen
        assert "lead.status_changed" in events_seen
        assert "comment.created" in events_seen
        assert "share_event.created" in events_seen

        # Verify HMAC signature format + validity on all captured
        for item in captured:
            sig = item["signature"]
            assert sig is not None, f"Missing signature for {item['event']}"
            assert sig.startswith("sha256="), f"Bad prefix: {sig}"
            assert len(sig) == len("sha256=") + 64, f"Bad hex length: {sig}"
            expected = "sha256=" + hmac.new(secret.encode(), item["body"], hashlib.sha256).hexdigest()
            assert hmac.compare_digest(sig, expected), f"Signature mismatch for {item['event']}"

        # Verify status_changed contains previous
        sc = next(c for c in captured if c["event"] == "lead.status_changed")
        env = json.loads(sc["body"])
        assert env.get("previous", {}).get("status") == "new_estimate"

        # Cleanup
        mongo_db["leads"].delete_one({"id": lead_id})
        mongo_db["comments"].delete_many({"author_name": "TEST_WH"})

    def test_unchanged_status_no_webhook(self, webhook_capture, mongo_db):
        # Fresh token
        r = requests.post(f"{API}/admin/login", json={"email": "admin@aussieback.com", "password": "Admin@123"}, timeout=10)
        hdrs = {"Authorization": f"Bearer {r.json()['access_token']}"}
        lead_id = str(uuid.uuid4())
        mongo_db["leads"].insert_one({
            "id": lead_id, "visa_type": "working_holiday", "input_mode": "balance",
            "super_balance": 5000, "estimated_refund": 1000, "first_name": "TEST_NW",
            "email": "nw@test.com", "whatsapp_number": "+61491570006",
            "status": "contacted", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        })
        try:
            before = len([c for c in webhook_capture["captured"] if c["event"] == "lead.status_changed"])
            r = requests.patch(f"{API}/admin/leads/{lead_id}/status", headers=hdrs, json={"status": "contacted"}, timeout=10)
            assert r.status_code == 200
            assert r.json().get("unchanged") is True
            time.sleep(2)
            after = len([c for c in webhook_capture["captured"] if c["event"] == "lead.status_changed"])
            assert after == before, "Webhook should NOT fire for unchanged status"
        finally:
            mongo_db["leads"].delete_one({"id": lead_id})
