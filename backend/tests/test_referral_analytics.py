"""Iteration 4 backend tests: referral tracking, share-events, admin analytics.

Note: /api/leads is rate-limited at 5/hour per IP. Restart backend before running
this suite to reset slowapi counters. We use at most 3 lead creations here.
"""
import os
import re
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

REFERRAL_ALPHABET_RE = re.compile(r"^[A-HJ-NP-Z2-9]{8}$")  # excludes 0/O/1/I


def _lead_payload(first_name="TEST_Ref", phone="+61412345678", referred_by=None):
    p = {
        "visa_type": "working_holiday",
        "input_mode": "balance",
        "super_balance": 5000,
        "estimated_refund": 1750.0,
        "first_name": first_name,
        "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
        "whatsapp_number": phone,
    }
    if referred_by is not None:
        p["referred_by_code"] = referred_by
    return p


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Referral code generation ----------------
class TestReferralCodes:
    """Two lead creations up front — stored on the class for later tests."""

    lead_a = None
    lead_b = None

    def test_first_lead_gets_valid_referral_code(self):
        r = requests.post(f"{API}/leads", json=_lead_payload("TEST_Alice"))
        if r.status_code == 429:
            pytest.skip("Rate-limited; restart backend before test run")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert "referral_code" in lead and lead["referral_code"]
        assert REFERRAL_ALPHABET_RE.match(lead["referral_code"]), f"Bad code: {lead['referral_code']}"
        assert lead["referred_by_code"] is None
        assert lead["referred_by_lead_id"] is None
        TestReferralCodes.lead_a = lead

    def test_second_lead_has_different_code(self):
        r = requests.post(f"{API}/leads", json=_lead_payload("TEST_Bob"))
        if r.status_code == 429:
            pytest.skip("Rate-limited on second creation")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert REFERRAL_ALPHABET_RE.match(lead["referral_code"])
        assert lead["referral_code"] != TestReferralCodes.lead_a["referral_code"]
        TestReferralCodes.lead_b = lead


# ---------------- Referral linking ----------------
class TestReferralLinking:
    def test_valid_referred_by_code_resolves_lead_id(self):
        assert TestReferralCodes.lead_a is not None, "Prereq lead_a missing"
        referrer = TestReferralCodes.lead_a
        # Use lowercase to also verify uppercasing on server
        r = requests.post(
            f"{API}/leads",
            json=_lead_payload("TEST_Charlie", referred_by=referrer["referral_code"].lower()),
        )
        if r.status_code == 429:
            pytest.skip("Rate-limited")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["referred_by_code"] == referrer["referral_code"]  # upper
        assert lead["referred_by_lead_id"] == referrer["id"]

    def test_unknown_referred_by_code_passes_through(self):
        # Use a code that can't exist due to banned chars (contains 0)
        r = requests.post(f"{API}/leads", json=_lead_payload("TEST_Dan", referred_by="ZZZZ0000"))
        if r.status_code == 429:
            pytest.skip("Rate-limited")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["referred_by_code"] == "ZZZZ0000"
        assert lead["referred_by_lead_id"] is None


# ---------------- Share events ----------------
class TestShareEvents:
    def test_valid_share_event_returns_ok(self):
        body = {
            "channel": "download",
            "referral_code": "ABC12345",
            "lead_id": str(uuid.uuid4()),
            "aspect": "feed",
        }
        r = requests.post(f"{API}/share-events", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0

    def test_story_channel_accepted(self):
        r = requests.post(f"{API}/share-events", json={"channel": "story_download", "aspect": "story"})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_invalid_channel_returns_422(self):
        r = requests.post(f"{API}/share-events", json={"channel": "invalid_ch"})
        assert r.status_code == 422, r.text


# ---------------- Admin analytics ----------------
class TestAdminAnalytics:
    def test_analytics_requires_auth(self):
        r = requests.get(f"{API}/admin/analytics")
        assert r.status_code == 401, r.text

    def test_analytics_returns_shape(self, auth_headers):
        r = requests.get(f"{API}/admin/analytics", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "share_events" in data
        by_ch = data["share_events"]["by_channel"]
        for ch in ["download", "native", "copy", "story_download"]:
            assert ch in by_ch and isinstance(by_ch[ch], int)
        assert isinstance(data["share_events"]["total"], int)
        # Total should equal sum of channels
        assert data["share_events"]["total"] == sum(by_ch.values())

        refs = data["referrals"]
        assert "referred_leads_total" in refs
        assert "all_leads_total" in refs
        assert isinstance(refs["top_referrers"], list)
        # If any top referrers, verify shape
        for tr in refs["top_referrers"]:
            for k in ["lead_id", "first_name", "email", "referral_code", "referred_count", "total_estimated"]:
                assert k in tr, f"missing {k} in {tr}"


# ---------------- Regression: admin & pipeline ----------------
class TestRegression:
    def test_estimate_math(self):
        r = requests.post(
            f"{API}/estimate",
            json={"visa_type": "working_holiday", "input_mode": "balance", "super_balance": 10000},
        )
        assert r.status_code == 200
        data = r.json()
        # 65% tax => keep 35%
        assert data["estimated_refund"] == 3500.0
        assert data["tax_rate"] == 0.65

    def test_admin_leads_list(self, auth_headers):
        r = requests.get(f"{API}/admin/leads", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "leads" in data and "count" in data

    def test_admin_stats(self, auth_headers):
        r = requests.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 200
        for k in ["total_leads", "status_counts", "pipeline_value", "recovered_value", "conversion_rate"]:
            assert k in r.json()

    def test_admin_export_csv(self, auth_headers):
        r = requests.get(f"{API}/admin/leads/export", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_status_update_and_persistence(self, auth_headers):
        # find any lead
        r = requests.get(f"{API}/admin/leads", headers=auth_headers)
        leads = r.json()["leads"]
        if not leads:
            pytest.skip("No leads to update")
        target = leads[0]
        orig_status = target["status"]
        new_status = "contacted" if orig_status != "contacted" else "new_estimate"
        p = requests.patch(
            f"{API}/admin/leads/{target['id']}/status",
            json={"status": new_status},
            headers=auth_headers,
        )
        assert p.status_code == 200
        # Verify persisted
        r2 = requests.get(f"{API}/admin/leads", headers=auth_headers)
        updated = [x for x in r2.json()["leads"] if x["id"] == target["id"]][0]
        assert updated["status"] == new_status
        # revert
        requests.patch(
            f"{API}/admin/leads/{target['id']}/status",
            json={"status": orig_status},
            headers=auth_headers,
        )
