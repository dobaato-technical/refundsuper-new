"""AussieBack backend API tests — covers estimator, lead creation, admin flows."""
import os
import io
import csv
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback to reading frontend .env so tests can be invoked locally
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@aussieback.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Health ----------------
class TestHealth:
    def test_root_ok(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "AussieBack API"


# ---------------- Estimator math ----------------
class TestEstimator:
    def test_working_holiday_balance_5000(self, session):
        r = session.post(f"{API}/estimate", json={
            "visa_type": "working_holiday",
            "input_mode": "balance",
            "super_balance": 5000,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] == 5000.0
        assert d["estimated_refund"] == 1750.0  # 5000 * 0.35

    def test_other_temp_earnings_45000(self, session):
        r = session.post(f"{API}/estimate", json={
            "visa_type": "other_temp",
            "input_mode": "earnings",
            "gross_earnings": 45000,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] == 5400.0  # 45000 * 0.12
        assert d["estimated_refund"] == 3510.0  # 5400 * 0.65

    def test_other_temp_balance(self, session):
        r = session.post(f"{API}/estimate", json={
            "visa_type": "other_temp",
            "input_mode": "balance",
            "super_balance": 10000,
        })
        assert r.status_code == 200
        assert r.json()["estimated_refund"] == 6500.0


# ---------------- Leads ----------------
class TestLeads:
    def test_create_lead_persists(self, session, auth_headers):
        # Send wrong estimated_refund to verify server recomputes
        payload = {
            "visa_type": "working_holiday",
            "input_mode": "balance",
            "super_balance": 5000,
            "gross_earnings": None,
            "estimated_refund": 99999.0,  # server should ignore/recompute
            "first_name": "TEST_Backpacker",
            "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
            "whatsapp_number": "+61400000001",
            "super_fund_name": "AustralianSuper",
            "date_left_australia": "2025-06-01",
        }
        r = session.post(f"{API}/leads", json=payload)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["id"] and len(lead["id"]) >= 10
        assert lead["status"] == "new_estimate"
        assert lead["estimated_refund"] == 1750.0
        assert lead["first_name"] == "TEST_Backpacker"
        # Verify persisted via admin listing
        list_r = session.get(f"{API}/admin/leads", headers=auth_headers, params={"q": lead["email"]})
        assert list_r.status_code == 200
        leads = list_r.json()["leads"]
        assert any(l["id"] == lead["id"] for l in leads)
        pytest.lead_id = lead["id"]
        pytest.lead_email = lead["email"]


# ---------------- Admin auth ----------------
class TestAdminAuth:
    def test_login_success(self, session):
        r = session.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["admin_email"] == ADMIN_EMAIL
        assert d["token_type"] == "bearer"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{API}/admin/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/admin/me")
        assert r.status_code == 401


# ---------------- Admin: leads list, search, filter, status update ----------------
class TestAdminLeads:
    def test_list_leads(self, session, auth_headers):
        r = session.get(f"{API}/admin/leads", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "leads" in d and "count" in d
        assert isinstance(d["leads"], list)

    def test_search_query(self, session, auth_headers):
        # Use email seeded in TestLeads
        email = getattr(pytest, "lead_email", None)
        if not email:
            pytest.skip("No seeded lead")
        r = session.get(f"{API}/admin/leads", headers=auth_headers, params={"q": email})
        assert r.status_code == 200
        leads = r.json()["leads"]
        assert any(l["email"] == email for l in leads)

    def test_status_filter(self, session, auth_headers):
        r = session.get(f"{API}/admin/leads", headers=auth_headers, params={"status": "new_estimate"})
        assert r.status_code == 200
        for l in r.json()["leads"]:
            assert l["status"] == "new_estimate"

    def test_update_status(self, session, auth_headers):
        lead_id = getattr(pytest, "lead_id", None)
        if not lead_id:
            pytest.skip("No seeded lead")
        r = session.patch(f"{API}/admin/leads/{lead_id}/status",
                          headers=auth_headers, json={"status": "contacted"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Verify persisted
        list_r = session.get(f"{API}/admin/leads", headers=auth_headers, params={"q": pytest.lead_email})
        leads = list_r.json()["leads"]
        target = next((l for l in leads if l["id"] == lead_id), None)
        assert target and target["status"] == "contacted"

    def test_update_status_not_found(self, session, auth_headers):
        r = session.patch(f"{API}/admin/leads/{uuid.uuid4()}/status",
                          headers=auth_headers, json={"status": "contacted"})
        assert r.status_code == 404


# ---------------- Admin: stats + export ----------------
class TestAdminStatsExport:
    def test_stats(self, session, auth_headers):
        r = session.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_leads", "status_counts", "pipeline_value", "recovered_value", "conversion_rate"):
            assert k in d
        assert isinstance(d["status_counts"], dict)
        for s in ("new_estimate", "contacted", "documents_received", "submitted_to_ato", "refund_paid"):
            assert s in d["status_counts"]

    def test_export_csv(self, session, auth_headers):
        r = session.get(f"{API}/admin/leads/export", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        assert "aussieback_leads.csv" in r.headers.get("content-disposition", "")
        # Parse CSV
        text = r.text
        assert text  # non-empty
        # Should be parseable
        rows = list(csv.reader(io.StringIO(text)))
        assert len(rows) >= 1
