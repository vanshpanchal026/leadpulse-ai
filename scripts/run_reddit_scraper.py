import os
import json
import time
import urllib.request
import urllib.parse
import csv
from pathlib import Path

# Load APIFY_TOKEN from .env or environment
ENV_FILE = Path(__file__).resolve().parent.parent / '.env'
if ENV_FILE.exists():
    with open(ENV_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip())

API_TOKEN = os.environ.get('APIFY_TOKEN')
if not API_TOKEN:
    raise ValueError('Missing APIFY_TOKEN in environment or .env file.')
ACTOR_ID = "oAuCIx3ItNrs2okjQ" # trudax/reddit-scraper-lite

subreddits = [
    "forhire",
    "smallbusiness",
    "Entrepreneur",
    "automation",
    "n8n",
    "webdev",
    "SaaS",
    "Shopify"
]

keywords = [
    "whatsapp",
    "chatbot",
    "automation",
    "automate",
    "ai agent"
]

start_urls = []
for sub in subreddits:
    for kw in keywords:
        q_enc = urllib.parse.quote(kw)
        u = f"https://www.reddit.com/r/{sub}/search/?q={q_enc}&sort=new&restrict_sr=1"
        start_urls.append({
            "url": u,
            "userData": {
                "subreddit": sub,
                "keyword": kw
            }
        })

print(f"Total start URLs: {len(start_urls)}")

input_data = {
    "startUrls": start_urls,
    "skipComments": True,
    "includeMediaLinks": True,
    "maxPostCount": 6,
    "maxItems": 240,
    "sort": "new",
    "proxy": {
        "useApifyProxy": True
    }
}

print("Starting actor run on Apify...")
req = urllib.request.Request(
    f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs",
    data=json.dumps(input_data).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }
)

with urllib.request.urlopen(req) as resp:
    run_data = json.loads(resp.read().decode("utf-8"))["data"]

run_id = run_data["id"]
dataset_id = run_data["defaultDatasetId"]
print(f"Run started! Run ID: {run_id}, Dataset ID: {dataset_id}")

# Poll run status
status = run_data["status"]
while status in ["READY", "RUNNING"]:
    time.sleep(10)
    status_req = urllib.request.Request(
        f"https://api.apify.com/v2/actor-runs/{run_id}",
        headers={"Authorization": f"Bearer {API_TOKEN}"}
    )
    with urllib.request.urlopen(status_req) as s_resp:
        status_info = json.loads(s_resp.read().decode("utf-8"))["data"]
        status = status_info["status"]
        print(f"Current status: {status} (usage: ${status_info.get('usageTotalUsd', 0):.4f})")

print(f"Run finished with status: {status}")
print(f"Total Usage: ${status_info.get('usageTotalUsd', 0):.4f}")

# Fetch dataset items
print("Fetching dataset items...")
items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?clean=true"
items_req = urllib.request.Request(
    items_url,
    headers={"Authorization": f"Bearer {API_TOKEN}"}
)
with urllib.request.urlopen(items_req) as i_resp:
    items = json.loads(i_resp.read().decode("utf-8"))

print(f"Total scraped items: {len(items)}")

output_csv = Path(__file__).resolve().parent.parent / "data" / "reddit_results.csv"
output_csv.parent.mkdir(parents=True, exist_ok=True)

processed_rows = []
for item in items:
    sub = item.get("parsedCommunityName") or item.get("communityName") or ""
    if sub.startswith("r/"):
        sub = sub[2:]
    
    title = (item.get("title") or "").strip()
    body = (item.get("body") or "").strip()
    full_text = f"{title} {body}".lower()
    
    # Identify matched keyword
    matched = []
    for kw in keywords:
        if kw.lower() in full_text:
            matched.append(kw)
    keyword_matched = ", ".join(matched) if matched else "unspecified"
    
    url = item.get("url") or ""
    score = item.get("upVotes") if item.get("upVotes") is not None else item.get("score", 0)
    created_date = item.get("createdAt") or ""
    
    processed_rows.append({
        "subreddit": sub,
        "keyword_matched": keyword_matched,
        "title": title,
        "body_text": body,
        "url": url,
        "score": score,
        "created_date": created_date
    })

with open(output_csv, "w", newline="", encoding="utf-8") as f:
    fieldnames = ["subreddit", "keyword_matched", "title", "body_text", "url", "score", "created_date"]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(processed_rows)

print(f"Successfully saved {len(processed_rows)} rows to {output_csv}")
