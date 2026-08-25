"""Iteration 15: publish -> ISR revalidate + IndexNow background task; then cleanup."""
import os
import requests
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")

tok = requests.post(f"{BASE}/api/admin/login", json={
    "email": "admin@aussieback.com", "password": "doWhatYou@321"}, timeout=30).json()["access_token"]
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

slug = "test-qa15-temp-post"
payload = {
    "title": "TEST_QA15 temp post",
    "slug": slug,
    "excerpt": "TEST_QA15 temp excerpt for publish pipeline verification.",
    "content": "TEST_QA15 body content. " * 20,
    "category": "By Country",
    "keywords": ["test"],
    "meta_description": "TEST_QA15 meta description for publish pipeline verification.",
}
r = requests.post(f"{BASE}/api/admin/blog/posts", json=payload, headers=H, timeout=60)
print("publish:", r.status_code, r.text[:300])

if r.status_code in (200, 201):
    g = requests.get(f"{BASE}/api/blog/posts/{slug}", timeout=30)
    print("public GET:", g.status_code, g.json().get("author") if g.status_code == 200 else g.text[:200])
    ping = requests.post(f"{BASE}/api/admin/blog/ping-search-engines?slug=" + slug, headers=H, timeout=60)
    print("manual ping:", ping.status_code, ping.text[:300])
    d = requests.delete(f"{BASE}/api/admin/blog/posts/{slug}", headers=H, timeout=30)
    print("delete:", d.status_code, d.text[:200])
    print("post-delete GET:", requests.get(f"{BASE}/api/blog/posts/{slug}", timeout=30).status_code)
