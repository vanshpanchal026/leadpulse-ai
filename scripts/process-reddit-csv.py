#!/usr/bin/env python3
"""
Real Data Ingestion Engine (Sprint 3)
Evaluates scraped Reddit posts using Gemini API and persists qualified leads to data/leads.json.
"""

import os
import sys
import json
import time
import csv
import re
from pathlib import Path
from dotenv import load_dotenv

# Ensure UTF-8 console output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    print("❌ Error: GEMINI_API_KEY is not set in environment or .env file.")
    sys.exit(1)

MODEL_NAME = "gemini-2.5-flash"
for arg in sys.argv:
    if arg.startswith("--model="):
        MODEL_NAME = arg.split("=")[1]

SYSTEM_PROMPT = """
You are an expert lead qualification consultant helping Vansh evaluate small business pain.
Vansh's services focus on capturing missed customer inquiries, 24/7 after-hours WhatsApp lead capture, frictionless calendar booking, and operational workflow automation.
Target clients: Real businesses with inquiry volume (approx. 10-20 staff or strong transaction flow, e.g. clinics, real estate agencies, salons, contractors, local services, e-commerce stores).

STRICT RULES:
1. NEVER fabricate past clients (e.g. NEVER say "I recently built this for someone else" or make up testimonials).
2. Offer direct technical perspective and concrete solution blueprints.
3. RULES FOR recommended_first_message (STRICT ANTI-SPAM):
   - Write as an individual peer typing a casual reply from a laptop or phone — NEVER as an agency or business.
   - BANNED WORDS/PHRASES (Strict zero-tolerance):
     * "We help...", "We specialize in..."
     * "Would you be open to a quick/brief chat?"
     * "Our team", "Our clients", "Reach out anytime"
     * "Game-changer", "Streamline", "Leverage", "Tailored solution"
     * Placeholder tags like "[Name]" or "[Company]"
   - TONE & STRUCTURE:
     * 2 to 3 sentences maximum.
     * Start with a direct observation or question about their specific setup (e.g. "Are you running this off the standard WhatsApp app or using webhooks?").
     * Share a direct technical tip or blueprint on how to solve the friction without pitching a service.
     * Casual sign-off or leave it open-ended without asking for a meeting/call.
4. Only flag "is_potential_lead: true" if the poster represents a genuine operational business experiencing customer communication, scheduling, or lead drop-off friction that automation/WhatsApp/calendar can solve.
5. REJECT: Other freelancers, web developers advertising services, students, dropshippers with no sales, or early-stage theoretical idea validation without real operational load.

Return strictly valid JSON matching this schema:
{
  "is_potential_lead": boolean,
  "business_type": string,
  "identified_problem": string,
  "recommended_first_message": string,
  "confidence_score": number
}
where confidence_score is an integer from 1 to 10 (10 = immediate high-intent fit for Vansh's automation services).
"""

def call_gemini_with_retry(post_data, max_retries=3):
    import urllib.request
    import urllib.error

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}"
    
    user_content = f"""{SYSTEM_PROMPT}

Candidate Post Details:
- Subreddit: r/{post_data.get('subreddit', '')}
- Matched Keyword: {post_data.get('keyword_matched', 'N/A')}
- Post Title: {post_data.get('title', '')}
- Source URL: {post_data.get('url', 'N/A')}
- Post Content:
{post_data.get('body_text', '') or post_data.get('title', '')}
"""
    
    payload = {
        "contents": [{
            "parts": [{"text": user_content}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                text = res["candidates"][0]["content"]["parts"][0]["text"]
                clean_text = text.replace("```json", "").replace("```", "").strip()
                return json.loads(clean_text)
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8", errors="ignore")
            if err.code == 429 and attempt < max_retries:
                match = re.search(r'retry in ([0-9.]+)s', err_body, re.I)
                wait_sec = int(float(match.group(1))) + 2 if match else (15 * attempt)
                print(f"\n⏳ Rate limit reached. Pausing {wait_sec}s before attempt {attempt+1}/{max_retries}...")
                time.sleep(wait_sec)
            else:
                raise Exception(f"HTTP {err.code}: {err_body}")

BANNED_PHRASES = [
    'we help', 'we specialize', 'our team', 'our agency', 'our clients', 'we offer',
    'reach out anytime', 'feel free to reach out', 'would you be open to a quick chat',
    'would you be open to a brief chat', 'would you be open to a quick call',
    'would you be open to a call', 'would you be open to chatting', 'quick chat',
    'brief chat', 'hop on a call', 'jump on a call', 'book a call', 'schedule a call',
    'schedule a demo', "let's connect", 'feel free to dm', 'dm me', 'shoot me a dm',
    'inbox me', 'pm me', 'game-changer', 'game changer', 'streamline', 'streamlining',
    'leverage', 'leveraging', 'tailored solution', 'cutting-edge', 'synergy',
    'all-in-one solution', 'seamlessly integrate', 'transform your business'
]

def count_sentences(text):
    if not text or not text.strip():
        return 0
    norm = re.sub(r'\b(e\.g\.|i\.e\.|vs\.|approx\.|etc\.)', '', text, flags=re.I)
    sentences = [s.strip() for s in re.split(r'[.!?]+(?:\s+|\n+|$)', norm) if s.strip()]
    return len(sentences)

def detect_placeholders(text):
    if not text:
        return []
    return re.findall(r'(\[[^\]]{2,30}\]|\{[^}]{2,30}\}|<[^>]{2,30}>)', text)

def validate_lead_output(payload):
    errors = []
    pitch = (payload.get('recommended_first_message') or '').strip()
    pitch_lower = pitch.lower()
    
    # 1. Banned phrases
    detected_banned = [p for p in BANNED_PHRASES if p in pitch_lower]
    if detected_banned:
        errors.append(f"Contains banned phrase(s): {', '.join(detected_banned)}")
        
    # 2. Length & sentences
    sentences = count_sentences(pitch)
    char_len = len(pitch)
    if char_len < 20:
        errors.append(f"Too short ({char_len} chars)")
    elif sentences > 3:
        errors.append(f"Too many sentences ({sentences}/3 max)")
    elif char_len > 400:
        errors.append(f"Too long ({char_len}/400 max chars)")
        
    # 3. Placeholders
    placeholders = detect_placeholders(pitch)
    if placeholders:
        errors.append(f"Contains placeholder(s): {', '.join(placeholders)}")
        
    # 4. Schema
    if payload.get('is_potential_lead') is not True:
        errors.append("is_potential_lead is not True")
    try:
        score = int(payload.get('confidence_score', 0))
        if score < 7 or score > 10:
            errors.append(f"Score {score} is below threshold 7")
    except:
        errors.append("Invalid confidence_score")
        
    return (len(errors) == 0), errors, pitch

def main():
    root = Path(__file__).resolve().parent.parent
    possible_csv = [root / "data" / "reddit_results.csv", root / "reddit_results.csv"]
    csv_path = next((p for p in possible_csv if p.exists()), None)
    
    if not csv_path:
        print("❌ Could not find reddit_results.csv")
        sys.exit(1)
        
    print(f"📂 Reading Reddit dataset from: {csv_path}")
    with open(csv_path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        
    print(f"📊 Loaded {len(rows)} total rows.")
    
    # Local Pre-Filter (Stage 2 Triage: Obvious Reject vs Candidate)
    obvious_reject_regex = re.compile(
        r'(\[for\s*hire\]|\bfor\s*hire\b|\bhire me\b|\bavailable for hire\b|\bportfolio\s*:\s*https?://|'
        r'\b(weekly|monthly)\s+(roundup|megathread|discussion|digest)\b|\bsecurity report\b|this week\'s top|'
        r'\b(rules and guidelines|moderator post|megathread)\b|^\[(removed|deleted)\]$)',
        re.I
    )
    candidate_regex = re.compile(
        r'(\bmissed (calls|inquiries|clients|leads)\b|\bafter hours\b|\btoo many messages\b|\bdouble booking\b|'
        r'\bscheduling\b|\blead capture\b|\bwhatsapp\b|\bmanual data entry\b)',
        re.I
    )
    priority_subs = {"smallbusiness", "smallbusinessowners", "restaurantowners", "realtors", "shopify", "entrepreneur"}

    pre_filtered = []
    reject_count = 0
    for r in rows:
        title = r.get("title") or ""
        body = r.get("body_text") or ""
        full = f"{title} {body}".strip()
        sub = (r.get("subreddit") or "").lower().replace("r/", "")
        
        if len(full) < 30 or obvious_reject_regex.search(full):
            reject_count += 1
            continue
            
        if candidate_regex.search(full) or sub in priority_subs:
            pre_filtered.append(r)
        else:
            reject_count += 1
            
    print(f"🧹 Filtered out {reject_count} obvious reject/noise rows without calling Gemini.")
    print(f"✨ {len(pre_filtered)} candidate posts eligible for evaluation.")
    
    # Priority sorting
    priority_subs = {"smallbusiness", "entrepreneur", "shopify"}
    sorted_candidates = sorted(
        pre_filtered,
        key=lambda r: (r.get("subreddit", "").lower().replace("r/", "") in priority_subs),
        reverse=True
    )
    
    out_path = root / "data" / "leads.json"
    existing_leads = []
    if out_path.exists():
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                existing_leads = json.load(f)
                if not isinstance(existing_leads, list):
                    existing_leads = []
        except:
            existing_leads = []
            
    existing_urls = {l.get("source_url") for l in existing_leads if l.get("source_url")}
    print(f"📌 Found {len(existing_leads)} existing qualified leads in data/leads.json")

    limit = 25
    for arg in sys.argv:
        if arg.startswith("--limit="):
            limit = int(arg.split("=")[1])
            
    batch = sorted_candidates[:limit]
    print(f"🤖 Evaluating batch of {len(batch)} candidates using {MODEL_NAME}...\n")
    
    newly_qualified = []
    for idx, item in enumerate(batch):
        sub = item.get("subreddit", "unknown").replace("r/", "")
        title_snip = (item.get("title") or "")[:55]
        
        if item.get("url") and item.get("url") in existing_urls:
            print(f"[{idx+1}/{len(batch)}] r/{sub}: \"{title_snip}...\" ⏩ Already qualified")
            continue
            
        print(f"[{idx+1}/{len(batch)}] r/{sub}: \"{title_snip}...\" ", end="", flush=True)
        
        try:
            parsed = call_gemini_with_retry(item)
            is_valid, val_errors, clean_pitch = validate_lead_output(parsed)
            score = int(parsed.get("confidence_score", 0)) if parsed.get("confidence_score") else 0
            
            if is_valid:
                print(f"✅ QUALIFIED & VALIDATED (Score: {score}/10 | {parsed.get('business_type', 'Business')})")
                new_lead = {
                    "id": f"lead-{int(time.time() * 1000)}-{os.urandom(3).hex()}",
                    "source_platform": "reddit",
                    "source_url": item.get("url") or f"https://www.reddit.com/r/{sub}",
                    "author": "u/reddit_user",
                    "subreddit_or_handle": f"r/{sub}",
                    "title": item.get("title") or "Inquiry Opportunity",
                    "body_text": item.get("body_text") or item.get("title") or "",
                    "identified_problem": parsed.get("identified_problem") or "Operational inquiry bottleneck.",
                    "business_type": parsed.get("business_type") or "Small Business",
                    "confidence_score": score,
                    "draft_pitch": clean_pitch,
                    "status": "new",
                    "created_at": item.get("created_date") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                newly_qualified.append(new_lead)
                existing_urls.add(new_lead["source_url"])
            else:
                if parsed.get("is_potential_lead") and score >= 7:
                    print(f"❌ BLOCKED by Anti-Spam Validator (Score was {score}/10):")
                    for err in val_errors:
                        print(f"   - {err}")
                else:
                    print(f"⚪ Skipped (Score: {score}/10 | {'Below threshold' if parsed.get('is_potential_lead') else 'Not high-fit'})")
        except Exception as e:
            print(f"❌ Error: {e}")
            
        if idx < len(batch) - 1:
            time.sleep(10)
            
    combined = existing_leads + newly_qualified
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        
    print(f"\n======================================================")
    print(f"🎉 Pipeline execution completed!")
    print(f"✨ Newly qualified this run: {len(newly_qualified)}")
    print(f"💾 Total qualified leads in data/leads.json: {len(combined)}")
    print(f"======================================================\n")

if __name__ == "__main__":
    main()
