#!/usr/bin/env python3
"""
Lead Analyzer and Insight Generator
Project: Freelancing Research Tool

Analyzes scraped Reddit posts for freelancing opportunities, categorizes hiring
vs. for-hire posts, extracts budget/contact signals, and outputs prioritized leads.
"""

import sys
import csv
import re
import argparse
from pathlib import Path
from collections import Counter

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def classify_intent(title, body):
    text = f"{title} {body}".lower()
    
    # Check explicit tags first
    if "[hiring]" in text or "hiring:" in text or "[client]" in text:
        return "HIRING"
    if "[for hire]" in text or "[forhire]" in text or "for hire:" in text:
        return "FOR_HIRE"
    
    # Strong hiring signals
    hiring_patterns = [
        r"\blooking for (a |an )?(developer|engineer|freelancer|expert|agency|consultant)\b",
        r"\bneed (someone|a developer|help|an expert|to build|automation)\b",
        r"\bwant to hire\b",
        r"\bseeking (a |an )?(developer|consultant|expert)\b",
        r"\bbudget\s*:\s*\$",
        r"\bpaying\s*\$",
        r"\blooking to hire\b"
    ]
    for pat in hiring_patterns:
        if re.search(pat, text):
            return "HIRING"
            
    # Offering signals
    offering_patterns = [
        r"\bi (can )?build\b",
        r"\bi offer\b",
        r"\bportfolio\s*:\s*",
        r"\bavailable for\b",
        r"\bmy rate\b",
        r"\bhire me\b"
    ]
    for pat in offering_patterns:
        if re.search(pat, text):
            return "FOR_HIRE"
            
    return "DISCUSSION"

def extract_contacts(text):
    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    telegrams = re.findall(r'(?:t\.me/|telegram:\s*@?)([a-zA-Z0-9_]+)', text, re.IGNORECASE)
    discords = re.findall(r'(?:discord:\s*|discordapp\.com/users/)([a-zA-Z0-9_.#]+)', text, re.IGNORECASE)
    calendly = re.findall(r'calendly\.com/[a-zA-Z0-9_-]+', text, re.IGNORECASE)
    
    contacts = []
    if emails:
        contacts.extend([f"Email: {e}" for e in set(emails)])
    if telegrams:
        contacts.extend([f"TG: @{t}" for t in set(telegrams)])
    if discords:
        contacts.extend([f"Discord: {d}" for d in set(discords)])
    if calendly:
        contacts.extend([f"Calendar: {c}" for c in set(calendly)])
        
    return "; ".join(contacts) if contacts else "None"

def extract_budget(text):
    rates = re.findall(r'(\$[0-9]+(?:\.[0-9]{2})?(?:\s*-\s*\$[0-9]+(?:\.[0-9]{2})?)?(?:/hr|/hour|/mo|/month|\s*fixed)?)', text, re.IGNORECASE)
    if rates:
        return ", ".join(set(rates[:3]))
    return "N/A"

def analyze_dataset(csv_path, export_hiring=True):
    csv_file = Path(csv_path)
    if not csv_file.exists():
        print(f"Error: Dataset not found at {csv_file}")
        return
        
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
    total_posts = len(rows)
    print("=" * 65)
    print(f"  DATASET ANALYSIS: {csv_file.name} ({total_posts} total posts)")
    print("=" * 65)
    
    intent_counts = Counter()
    classified_rows = []
    
    for r in rows:
        title = r.get('title', '')
        body = r.get('body_text', '')
        intent = classify_intent(title, body)
        intent_counts[intent] += 1
        
        contacts = extract_contacts(f"{title} {body}")
        budget = extract_budget(f"{title} {body}")
        
        classified_rows.append({
            **r,
            'intent': intent,
            'contacts': contacts,
            'budget_signals': budget
        })
        
    print("\n1. Breakdown by Post Intent:")
    for intent, count in intent_counts.most_common():
        pct = (count / total_posts) * 100
        print(f"   - {intent:<12}: {count:>3} posts ({pct:.1f}%)")
        
    sub_counts = Counter(r['subreddit'] for r in rows)
    print("\n2. Breakdown by Subreddit:")
    for sub, count in sub_counts.most_common():
        print(f"   - r/{sub:<15}: {count:>2} posts")
        
    kw_counts = Counter(r['keyword_matched'] for r in rows)
    print("\n3. Top Matched Keyword Combinations:")
    for kw, count in kw_counts.most_common(8):
        print(f"   - {kw:<30}: {count:>2} posts")
        
    hiring_leads = [r for r in classified_rows if r['intent'] == 'HIRING']
    print(f"\n4. High-Intent Hiring Leads Identified: {len(hiring_leads)}")
    for idx, lead in enumerate(hiring_leads[:5], 1):
        clean_title = lead['title'].replace('\n', ' ')[:80]
        print(f"\n   [{idx}] r/{lead['subreddit']} | Keywords: {lead['keyword_matched']}")
        print(f"       Title: {clean_title}")
        print(f"       Budget: {lead['budget_signals']} | Contacts: {lead['contacts']}")
        print(f"       URL: {lead['url']}")
        
    if export_hiring and hiring_leads:
        out_path = csv_file.parent / 'hiring_leads.csv'
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            fields = ['subreddit', 'keyword_matched', 'title', 'budget_signals', 'contacts', 'url', 'score', 'created_date', 'body_text']
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(hiring_leads)
        print(f"\nSuccessfully exported {len(hiring_leads)} hiring leads to: {out_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Analyze freelancing leads from scraped Reddit CSV')
    parser.add_argument('--file', type=str, default='data/reddit_results.csv', help='Path to dataset CSV')
    args = parser.parse_args()
    
    project_root = Path(__file__).resolve().parent.parent
    target_csv = project_root / args.file if not Path(args.file).is_absolute() else Path(args.file)
    analyze_dataset(target_csv)
