"""Iteration 6 - Blog + SEO backend regression tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://aussie-super-back.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

REQUIRED_LIST_FIELDS = {"slug", "title", "meta_description", "excerpt", "category",
                       "tags", "hero_image", "author", "reading_time_minutes", "published_at"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------- Blog API -------------
class TestBlogAPI:
    def test_list_blog_posts_returns_six(self, session):
        r = session.get(f"{API}/blog/posts")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "posts" in data and "categories" in data
        assert data["count"] == 6, f"Expected 6 seeded posts, got {data['count']}"
        assert len(data["posts"]) == 6
        for p in data["posts"]:
            missing = REQUIRED_LIST_FIELDS - set(p.keys())
            assert not missing, f"Post {p.get('slug')} missing fields: {missing}"
        # Categories with counts
        assert isinstance(data["categories"], list) and len(data["categories"]) >= 1
        for c in data["categories"]:
            assert "name" in c and "count" in c

    def test_filter_by_category_by_visa(self, session):
        r = session.get(f"{API}/blog/posts", params={"category": "By Visa"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 2, f"Expected 2 posts in 'By Visa', got {data['count']}"
        for p in data["posts"]:
            assert p["category"] == "By Visa"

    def test_filter_by_tag_dasp(self, session):
        r = session.get(f"{API}/blog/posts", params={"tag": "DASP"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1
        for p in data["posts"]:
            assert "DASP" in p["tags"]

    def test_get_blog_post_by_slug(self, session):
        slug = "how-to-claim-australian-super-refund-2026-guide"
        r = session.get(f"{API}/blog/posts/{slug}")
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["slug"] == slug
        assert "content" in p and len(p["content"]) > 100
        assert "keywords" in p and isinstance(p["keywords"], list)

    def test_unknown_slug_returns_404(self, session):
        r = session.get(f"{API}/blog/posts/does-not-exist-xyz")
        assert r.status_code == 404


# ------------- Regression: iteration-5 -------------
class TestRegression:
    def test_estimate_endpoint(self, session):
        payload = {"visa_type": "working_holiday", "input_mode": "earnings", "gross_earnings_aud": 50000}
        r = session.post(f"{API}/estimate", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(k in data for k in ("estimated_refund_aud", "estimated_refund", "refund"))

    def test_leads_with_utm_and_referral(self, session):
        payload = {
            "email": "TEST_reg@example.com",
            "first_name": "Regression",
            "whatsapp_number": "+61400123456",
            "visa_type": "other_temp",
            "input_mode": "earnings",
            "gross_earnings_aud": 40000,
            "estimated_refund": 3120,
            "utm_source": "test-suite",
            "utm_medium": "pytest",
            "utm_campaign": "iter6",
            "ref": "TESTREF01",
        }
        r = session.post(f"{API}/leads", json=payload)
        assert r.status_code in (200, 201, 429), r.text

    def test_admin_analytics_requires_auth(self, session):
        r = session.get(f"{API}/admin/analytics")
        assert r.status_code in (401, 403)

    def test_admin_analytics_with_login(self, session):
        login = session.post(f"{API}/admin/login",
                             json={"email": "admin@aussieback.com", "password": "Admin@123"})
        if login.status_code != 200:
            pytest.skip(f"Admin login failed: {login.status_code} {login.text}")
        token = login.json().get("access_token") or login.json().get("token")
        assert token
        r = session.get(f"{API}/admin/analytics",
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "utm_sources" in data

    def test_referral_progress_endpoint(self, session):
        r = session.get(f"{API}/referrals/TESTCODE/progress")
        # Should return 200 or 404, not 500
        assert r.status_code in (200, 404), r.text


# ------------- SEO fundamentals -------------
class TestSEOStaticAssets:
    def test_robots_txt(self, session):
        r = session.get(f"{BASE_URL}/robots.txt")
        assert r.status_code == 200, r.text
        body = r.text
        assert "Disallow: /admin" in body
        assert "Allow:" in body or "User-agent" in body

    def test_sitemap_xml(self, session):
        r = session.get(f"{BASE_URL}/sitemap.xml")
        assert r.status_code == 200, r.text
        body = r.text
        assert "<urlset" in body
        # Should reference at least some blog posts
        assert "/blog" in body

    def test_index_html_seo_tags(self, session):
        r = session.get(f"{BASE_URL}/")
        assert r.status_code == 200
        html = r.text.lower()
        assert "<title>" in html
        assert 'name="description"' in html
        assert "og:title" in html
        assert "og:description" in html
        assert "og:image" in html
        assert "twitter:card" in html
        assert 'rel="canonical"' in html
        assert "application/ld+json" in html
