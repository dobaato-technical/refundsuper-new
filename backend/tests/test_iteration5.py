"""Iteration 5: referral progress, UTM passthrough, weekly digest, admin analytics utm_sources."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@aussieback.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _lead_payload(**over):
    p = {
        "visa_type": "working_holiday",
        "input_mode": "balance",
        "super_balance": 5000,
        "estimated_refund": 1750.0,
        "first_name": f"TEST_I5_{uuid.uuid4().hex[:5]}",
        "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
        "whatsapp_number": "+61412345678",
    }
    p.update(over)
    return p


@pytest.fixture(scope="module")
def seeded_lead():
    r = requests.post(f"{API}/leads", json=_lead_payload())
    if r.status_code == 429:
        pytest.skip("rate limited")
    assert r.status_code == 200, r.text
    return r.json()


# ---------- GET /api/referrals/{code} ----------
class TestReferralLookup:
    def test_existing_code_returns_first_name(self, seeded_lead):
        code = seeded_lead["referral_code"]
        r = requests.get(f"{API}/referrals/{code}")
        assert r.status_code == 200
        body = r.json()
        assert body["referral_code"] == code
        assert body["first_name"] == seeded_lead["first_name"]

    def test_case_insensitive(self, seeded_lead):
        code = seeded_lead["referral_code"].lower()
        r = requests.get(f"{API}/referrals/{code}")
        assert r.status_code == 200
        assert r.json()["referral_code"] == seeded_lead["referral_code"]

    def test_unknown_code_404(self):
        r = requests.get(f"{API}/referrals/ZZZZ0000")
        assert r.status_code == 404

    def test_whitespace_code_404(self):
        # URL-encoded space; server strips -> empty -> 404
        r = requests.get(f"{API}/referrals/%20%20")
        assert r.status_code == 404


# ---------- GET /api/referrals/{code}/progress ----------
class TestReferralProgress:
    def test_progress_shape(self, seeded_lead):
        code = seeded_lead["referral_code"]
        r = requests.get(f"{API}/referrals/{code}/progress")
        assert r.status_code == 200
        body = r.json()
        assert body["referral_code"] == code
        assert "referred_count" in body
        assert isinstance(body["tiers"], list) and len(body["tiers"]) == 4
        thresholds = [t["threshold"] for t in body["tiers"]]
        assert thresholds == [1, 3, 5, 10]
        assert "unlocked_tiers" in body
        assert "next_tier" in body
        assert "remaining_to_next" in body

    def test_progress_next_tier_when_zero(self, seeded_lead):
        code = seeded_lead["referral_code"]
        r = requests.get(f"{API}/referrals/{code}/progress")
        body = r.json()
        if body["referred_count"] == 0:
            assert body["next_tier"] is not None
            assert body["next_tier"]["threshold"] == 1
            assert body["remaining_to_next"] == 1

    def test_unknown_code_404(self):
        r = requests.get(f"{API}/referrals/NOPE9999/progress")
        assert r.status_code == 404


# ---------- UTM passthrough ----------
class TestUtmPassthrough:
    def test_utm_persisted_and_echoed(self):
        payload = _lead_payload(
            utm_source="tiktok",
            utm_medium="paid",
            utm_campaign="summer26",
        )
        r = requests.post(f"{API}/leads", json=payload)
        if r.status_code == 429:
            pytest.skip("rate limited")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["utm_source"] == "tiktok"
        assert lead["utm_medium"] == "paid"
        assert lead["utm_campaign"] == "summer26"


# ---------- Admin analytics utm_sources ----------
class TestAdminAnalyticsUtm:
    def test_utm_sources_present(self, admin_headers):
        r = requests.get(f"{API}/admin/analytics", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert "utm_sources" in body
        assert isinstance(body["utm_sources"], list)
        # tiktok row should exist because TestUtmPassthrough ran
        sources = {row["source"]: row for row in body["utm_sources"]}
        if "tiktok" in sources:
            assert sources["tiktok"]["leads"] >= 1
            assert "pipeline" in sources["tiktok"]
        # sorted desc by leads
        leads_list = [row["leads"] for row in body["utm_sources"]]
        assert leads_list == sorted(leads_list, reverse=True)


# ---------- Weekly digest ----------
class TestWeeklyDigest:
    def test_requires_auth(self):
        r = requests.post(f"{API}/admin/weekly-digest/run")
        assert r.status_code in (401, 403)

    def test_run_returns_digest(self, admin_headers):
        r = requests.post(f"{API}/admin/weekly-digest/run", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        d = body["digest"]
        for key in ("since", "new_leads_count", "new_pipeline_value",
                    "share_events_by_channel", "top_channel", "top_referrers"):
            assert key in d, f"missing {key}"
        assert "channel" in d["top_channel"] and "count" in d["top_channel"]
