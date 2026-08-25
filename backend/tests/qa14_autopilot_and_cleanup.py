"""One-off QA14: autopilot queue requeue check + cleanup of TEST_ data."""
import os
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
be = dotenv_values("/app/backend/.env")
BASE = fe["REACT_APP_BACKEND_URL"].rstrip("/")

s = requests.Session()
tok = s.post(f"{BASE}/api/admin/login", json={"email": "admin@aussieback.com", "password": "doWhatYou@321"}).json()["access_token"]
s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})

# --- autopilot queue add / requeue / delete ---
r = s.post(f"{BASE}/api/admin/autopilot/queue", json={"topic": "TEST_QA14 autopilot topic", "keywords": ["test"], "category": "Guide"})
print("queue add:", r.status_code, r.text[:200])
q = s.get(f"{BASE}/api/admin/autopilot").json()
items = q.get("queue", q if isinstance(q, list) else [])
item = next((i for i in items if "TEST_QA14" in str(i.get("topic"))), None)
print("queued item found:", bool(item))
if item:
    iid = item["id"]
    rq = s.post(f"{BASE}/api/admin/autopilot/queue/{iid}/requeue", json={})
    print("requeue:", rq.status_code, rq.text[:200])
    d = s.delete(f"{BASE}/api/admin/autopilot/queue/{iid}")
    print("delete queue item:", d.status_code)

# --- cleanup TEST_ data directly in mongo ---
c = MongoClient(be["MONGO_URL"])
db = c[be["DB_NAME"]]
print("collections:", db.list_collection_names())
res = {}
for coll, flt in [
    ("leads", {"$or": [{"email": {"$regex": "^TEST_qa14", "$options": "i"}}, {"email": "TEST_qa_iter14@example.com"}, {"first_name": {"$regex": "^TEST_QA14"}}]}),
    ("comments", {"author_name": {"$regex": "^TEST_QA14"}}),
    ("blog_posts", {"slug": "test-qa14-temp-post"}),
    ("autopilot_queue", {"topic": {"$regex": "TEST_QA14"}}),
]:
    if coll in db.list_collection_names():
        res[coll] = db[coll].delete_many(flt).deleted_count
print("deleted:", res)

# outbox rows created during this run (event payload referencing TEST_qa14)
if "webhook_outbox" in db.list_collection_names():
    n = db.webhook_outbox.delete_many({"$or": [
        {"payload.data.email": {"$regex": "TEST_qa14", "$options": "i"}},
        {"payload.data.author_name": {"$regex": "TEST_QA14"}},
        {"payload.data.slug": "test-qa14-temp-post"},
    ]}).deleted_count
    print("outbox deleted:", n)
print("remaining TEST_qa14 leads:", db.leads.count_documents({"email": {"$regex": "TEST_qa14", "$options": "i"}}) if "leads" in db.list_collection_names() else "n/a")
