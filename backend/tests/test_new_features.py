"""Tests for AussieBack follow-up features: E.164 phone validation, reCAPTCHA stub, rate-limit."""
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


def _base_payload(phone="+61412345678"):
    return {
        "visa_type": "working_holiday",
        "input_mode": "balance",
        "super_balance": 5000,
        "estimated_refund": 1750.0,
        "first_name": "TEST_Phone",
        "email": f"TEST_{uuid.uuid4().hex[:8]}@example.com",
        "whatsapp_number": phone,
    }


# ---------------- E.164 phone validation ----------------
class TestPhoneValidation:
    def test_invalid_alpha_phone_returns_422(self):
        r = requests.post(f"{API}/leads", json=_base_payload("abc123"))
        assert r.status_code == 422, r.text
        # Ensure the message mentions E.164 or international
        body = r.text.lower()
        assert "e.164" in body or "international" in body

    def test_short_numeric_phone_returns_422(self):
        r = requests.post(f"{API}/leads", json=_base_payload("12345"))
        assert r.status_code == 422, r.text

    def test_valid_e164_returns_200_and_normalized(self):
        # Slightly formatted; server should normalize to +61412345678
        payload = _base_payload("+61 412 345 678")
        r = requests.post(f"{API}/leads", json=payload)
        # Accept 200 or 429 (rate limit may kick in on repeats)
        if r.status_code == 429:
            pytest.skip("Rate-limited on this worker; retry later")
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["whatsapp_number"] == "+61412345678"


# ---------------- reCAPTCHA stub ----------------
class TestRecaptchaStub:
    def test_lead_creation_without_recaptcha_header_succeeds(self):
        # RECAPTCHA_SECRET_KEY is empty in .env => backend stubs verification
        r = requests.post(f"{API}/leads", json=_base_payload("+442071838750"))
        if r.status_code == 429:
            pytest.skip("Rate-limited on this worker")
        assert r.status_code == 200, r.text


# ---------------- Rate limit ----------------
class TestRateLimit:
    def test_rate_limit_eventually_triggers_429(self):
        """slowapi stores counters per worker in memory; hits may hit different workers.
        We accept the test as passing if at least one 429 appears within N attempts."""
        saw_429 = False
        for _ in range(15):
            r = requests.post(f"{API}/leads", json=_base_payload("+61412345678"))
            if r.status_code == 429:
                saw_429 = True
                assert "too many" in r.text.lower() or "rate" in r.text.lower()
                break
            assert r.status_code in (200, 429), r.text
        assert saw_429, "Expected at least one 429 within 15 rapid POSTs — limiter may not be wired"
