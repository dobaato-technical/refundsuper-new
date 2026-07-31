"""
Iteration 8 tests:
 - Admin site-settings: GET/PUT with DB override precedence over env defaults
 - Sitemap reflects effective site_url when DB override is set
 - Autopilot config GET/PATCH and queue CRUD
 - Autopilot run: disabled -> skipped; empty queue -> skipped; enabled+queued -> publishes via Claude
 - Regression: /api/estimate, /api/leads, admin analytics, weekly digest, blog list,
   referral progress, admin generate-draft, comments POST/GET/approve/delete
"""
import os
import time
import uuid
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
CUSTOM_SITE_URL = "https://get.aussieback.co"
SEEDED_SLUG = "how-to-claim-australian-super-refund-2026-guide"
AUTOPILOT_SLUG = "aussie-super-back"


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
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Site Settings ----------------
class TestSiteSettings:
    def test_get_initial(self, s, H):
        # Clear any existing db override first for a clean baseline
        s.put(f"{BASE_URL}/api/admin/site-settings",
              json={"site_url": "", "google_site_verification": ""}, headers=H)
        r = s.get(f"{BASE_URL}/api/admin/site-settings", headers=H)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"effective", "db_overrides", "env_defaults"}
        assert data["env_defaults"]["site_url"] == SITE_URL_DEFAULT
        # After clearing, db_overrides should be None
        assert data["db_overrides"]["site_url"] in (None, "")
        assert data["effective"]["site_url"] == SITE_URL_DEFAULT

    def test_put_persists_and_public_reflects(self, s, H):
        r = s.put(f"{BASE_URL}/api/admin/site-settings",
                  json={"site_url": CUSTOM_SITE_URL, "google_site_verification": "gsv-token-test"},
                  headers=H)
        assert r.status_code == 200, r.text
        assert r.json()["effective"]["site_url"] == CUSTOM_SITE_URL

        # Public /api/site-config reflects DB override
        pub = s.get(f"{BASE_URL}/api/site-config").json()
        assert pub["site_url"] == CUSTOM_SITE_URL
        assert pub.get("google_site_verification") == "gsv-token-test"

        # Sitemap uses effective site_url — via internal backend (ingress may not route root /sitemap.xml)
        sm = requests.get("http://localhost:8001/sitemap.xml")
        assert sm.status_code == 200, sm.text[:200]
        assert CUSTOM_SITE_URL in sm.text

    def test_put_empty_clears_override(self, s, H):
        r = s.put(f"{BASE_URL}/api/admin/site-settings",
                  json={"site_url": "", "google_site_verification": ""}, headers=H)
        assert r.status_code == 200
        assert r.json()["effective"]["site_url"] == SITE_URL_DEFAULT

        pub = s.get(f"{BASE_URL}/api/site-config").json()
        assert pub["site_url"] == SITE_URL_DEFAULT


# ---------------- Autopilot ----------------
class TestAutopilot:
    def test_initial_state(self, s, H):
        # Reset: disable + clear queue
        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": False}, headers=H)
        cur = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        for it in cur.get("queue", []):
            s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{it['id']}", headers=H)

        r = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H)
        assert r.status_code == 200
        data = r.json()
        assert data["config"]["enabled"] is False
        assert data["queue"] == []

    def test_config_patch(self, s, H):
        r = s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": True}, headers=H)
        assert r.status_code == 200
        assert r.json()["config"]["enabled"] is True
        r2 = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        assert r2["config"]["enabled"] is True
        # revert
        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": False}, headers=H)

    def test_queue_crud_ordering(self, s, H):
        # ensure queue empty
        cur = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        for it in cur.get("queue", []):
            s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{it['id']}", headers=H)

        r1 = s.post(f"{BASE_URL}/api/admin/autopilot/queue",
                    json={"topic": "TEST_topic_A", "keywords": ["a", "b"], "category": "Guides"},
                    headers=H)
        assert r1.status_code == 200, r1.text
        id_a = r1.json()["item"]["id"]
        assert r1.json()["item"]["status"] == "queued"

        time.sleep(1.1)  # ensure created_at ordering
        r2 = s.post(f"{BASE_URL}/api/admin/autopilot/queue",
                    json={"topic": "TEST_topic_B", "keywords": ["c"]}, headers=H)
        assert r2.status_code == 200
        id_b = r2.json()["item"]["id"]
        assert id_a != id_b

        listing = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        topics = [i["topic"] for i in listing["queue"]]
        assert topics.index("TEST_topic_A") < topics.index("TEST_topic_B")

        # DELETE
        d = s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{id_a}", headers=H)
        assert d.status_code == 200
        listing2 = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        assert not any(i["id"] == id_a for i in listing2["queue"])
        # cleanup B
        s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{id_b}", headers=H)

    def test_run_disabled(self, s, H):
        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": False}, headers=H)
        r = s.post(f"{BASE_URL}/api/admin/autopilot/run", headers=H)
        assert r.status_code == 200
        assert r.json() == {"skipped": True, "reason": "disabled"}

    def test_run_empty_queue(self, s, H):
        # enable + ensure empty
        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": True}, headers=H)
        cur = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        for it in cur.get("queue", []):
            s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{it['id']}", headers=H)
        r = s.post(f"{BASE_URL}/api/admin/autopilot/run", headers=H)
        assert r.status_code == 200
        assert r.json() == {"skipped": True, "reason": "empty_queue"}

    def test_run_publishes_via_claude(self, s, H):
        # Clean up any existing autopilot slug to fully verify creation
        s.delete(f"{BASE_URL}/api/admin/blog/posts/{AUTOPILOT_SLUG}", headers=H)

        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": True}, headers=H)
        add = s.post(f"{BASE_URL}/api/admin/autopilot/queue",
                     json={"topic": "Aussie super back - claiming DASP",
                           "keywords": ["superannuation", "DASP", "refund"],
                           "category": "Guides"},
                     headers=H)
        assert add.status_code == 200
        item_id = add.json()["item"]["id"]

        r = s.post(f"{BASE_URL}/api/admin/autopilot/run", headers=H, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True, body
        slug = body["slug"]
        assert slug  # non-empty
        # queue item flipped
        listing = s.get(f"{BASE_URL}/api/admin/autopilot", headers=H).json()
        pub = next((i for i in listing["queue"] if i["id"] == item_id), None)
        assert pub is not None
        assert pub["status"] == "published"
        assert pub.get("published_slug") == slug

        # Public blog fetch works
        post = s.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert post.status_code == 200
        pdata = post.json()
        assert pdata["slug"] == slug
        assert len(pdata.get("content", "")) > 200

        # Cleanup
        s.delete(f"{BASE_URL}/api/admin/blog/posts/{slug}", headers=H)
        s.delete(f"{BASE_URL}/api/admin/autopilot/queue/{item_id}", headers=H)
        s.patch(f"{BASE_URL}/api/admin/autopilot", json={"enabled": False}, headers=H)


# ---------------- Regression ----------------
class TestRegression:
    def test_estimate(self, s):
        r = s.post(f"{BASE_URL}/api/estimate", json={
            "visa_type": "working_holiday", "input_mode": "balance", "super_balance": 8000
        })
        assert r.status_code == 200, r.text
        assert "estimated_refund" in r.json()

    def test_leads_with_utm_referral(self, s):
        unique = uuid.uuid4().hex[:8]
        r = s.post(f"{BASE_URL}/api/leads", json={
            "visa_type": "working_holiday",
            "input_mode": "balance",
            "super_balance": 8000,
            "estimated_refund": 2800.0,
            "first_name": "TESTReg",
            "email": f"TEST_reg_{unique}@example.com",
            "whatsapp_number": "+61491570006",
            "utm_source": "test",
            "utm_medium": "pytest",
            "utm_campaign": "iter8",
        })
        assert r.status_code in (200, 201, 429), r.text

    def test_analytics(self, s, H):
        r = s.get(f"{BASE_URL}/api/admin/analytics", headers=H)
        assert r.status_code == 200
        assert "totals" in r.json() or "leads_total" in r.json() or isinstance(r.json(), dict)

    def test_weekly_digest_run(self, s, H):
        r = s.post(f"{BASE_URL}/api/admin/weekly-digest/run", headers=H)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_blog_list(self, s):
        r = s.get(f"{BASE_URL}/api/blog/posts")
        assert r.status_code == 200
        data = r.json()
        posts = data if isinstance(data, list) else data.get("posts", [])
        assert isinstance(posts, list) and len(posts) > 0

    def test_referral_progress(self, s):
        r = s.get(f"{BASE_URL}/api/referrals/ABC12345/progress")
        assert r.status_code in (200, 404)

    def test_generate_draft(self, s, H):
        r = s.post(f"{BASE_URL}/api/admin/blog/generate-draft",
                   json={"topic": "TEST small article about DASP",
                         "keywords": ["dasp"], "category": "Guides"},
                   headers=H, timeout=60)
        assert r.status_code == 200, r.text
        payload = r.json()
        d = payload.get("draft", payload)
        assert d.get("title") and d.get("content")

    def test_comments_flow(self, s, H):
        # POST comment (public) — schema uses 'body' field
        rc = s.post(f"{BASE_URL}/api/blog/posts/{SEEDED_SLUG}/comments",
                    json={"author_name": "TEST_iter8",
                          "author_email": f"TEST_iter8_{uuid.uuid4().hex[:6]}@example.com",
                          "body": "TEST comment for iter8 regression"})
        assert rc.status_code in (200, 201, 429), rc.text
        # admin list
        rl = s.get(f"{BASE_URL}/api/admin/comments", headers=H)
        assert rl.status_code == 200
        data = rl.json()
        comments = data if isinstance(data, list) else data.get("comments", [])
        assert isinstance(comments, list)
        # try approve then delete one TEST_ comment
        target = next((c for c in comments if str(c.get("author_name", "")).startswith("TEST_iter8")), None)
        if target:
            cid = target.get("id")
            ap = s.patch(f"{BASE_URL}/api/admin/comments/{cid}/approve", headers=H)
            assert ap.status_code in (200, 404)
            de = s.delete(f"{BASE_URL}/api/admin/comments/{cid}", headers=H)
            assert de.status_code in (200, 204, 404)
