# System Architecture & Technical Specification
## Project: Lead Pipeline Command Center (Freelance Research & Outreach Engine)
**Owner / Lead:** Vansh Panchal  
**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Google Gemini 2.5 Flash, Apify Cloud Actors, Supabase (PostgreSQL)  
**File Generated:** September 2026  

---

## 1. High-Level Master Architecture (ASCII Text Diagram)

```
========================================================================================================================
                                    LEAD PIPELINE COMMAND CENTER — FULL ARCHITECTURE
========================================================================================================================

+----------------------------------------------------------------------------------------------------------------------+
|                                     1. EXTERNAL TARGET DATA SOURCES & CHANNELS                                       |
+---------------------------------------------------+------------------------------------------------------------------+
|              A. Social Media & Job Boards         |                    B. Local Business Ecosystem                   |
|  - Reddit Communities:                            |  - Google Maps / Google Places:                                  |
|    r/smallbusiness, r/restaurantowners,           |    Delhi NCR Clinics (Skin, Dental, Hair Transplant),            |
|    r/realtors, r/shopify                          |    Luxury Salons, MedSpas, Interior Studios                      |
|  - X (Twitter): Keyword & phrase monitoring       |  - Meta Ad Library:                                              |
|                                                   |    Active Facebook & Instagram Paid Ads in India                 |
+---------------------------------------------------+------------------------------------------------------------------+
                                     │                                                 │
                                     ▼                                                 ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                    2. CLOUD INGESTION & CRAWLER LAYER (APIFY)                                        |
+----------------------------------------------------------------------------------------------------------------------+
|  [Actor 1] trudax/reddit-scraper-lite                                                                                |
|    - Budget Guardrail: $1.00 strict bound (Typical run: $0.72 for ~170 items)                                         |
|    - Parameters: skipComments=true, sort="new", residential proxy rotation                                           |
|                                                                                                                      |
|  [Actor 2] compass/crawler-google-places                                                                             |
|    - Extracts: Title, Phone Number, Website, Rating, Review Count, Full Address                                      |
|    - Social crawler: Auto-extracts Instagram, Facebook handles from target website                                   |
|                                                                                                                      |
|  [Actor 3] apify/facebook-ads-scraper                                                                                |
|    - Input: Keyword & location (e.g. "Skin Clinic Delhi", countryCode="IN")                                          |
|    - Extracts: Active Ad Creative, Landing Page URL, Publisher Name, Ad Copy Offer                                    |
+----------------------------------------------------------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                   3. NEXT.JS 15 BACKEND API CONTROLLERS (app/api/)                                   |
+----------------------------------------------------------------------------------------------------------------------+
|  - POST /api/scraper/trigger      --> Coordinates autonomous Reddit scrape, triggers pre-filter & Gemini pipeline    |
|  - POST /api/scraper/google-maps  --> Ingests Google Places items, calculates scorecard, generates WhatsApp pitch    |
|  - POST /api/scraper/meta-ads     --> Queries Meta Ad Library, enriches via Google Places lookup, runs scorecard     |
|  - GET  /api/leads                --> Serves leads and computed funnel analytics to the UI                           |
|  - POST /api/scraper/run          --> Spawns local Python ingestion scripts (analyze_leads.py)                      |
+----------------------------------------------------------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                  4. PIPELINE PROCESSING & EVALUATION ENGINE (lib/)                                   |
+----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                      |
|  [Stage 4A: Normalization & Deduplication]                                                                           |
|    * Phone Normalizer: Converts raw phones to standard E.164 (+91XXXXXXXXXX)                                         |
|    * Business Normalizer: Strips legal & category suffixes ('Pvt Ltd', 'LLP', 'Clinic', 'Dental', 'Salon')          |
|    * URL Sanitizer: Separates true websites from wa.me and Facebook redirects                                        |
|    * Multi-Key Deduplication: Checked against Supabase source_url, phone_number, and normalized business name        |
|                                                                                                                      |
|  [Stage 4B: Pre-Filtering (Reddit)]                                                                                  |
|    * Regex Dropper: Strips [FOR HIRE], freelancer self-promotions, student projects, dev chatter                     |
|    * Symptom Matching: Requires operational friction (missed calls, scheduling, double booking, after-hours)         |
|                                                                                                                      |
|  [Stage 4C: Cross-Source Enrichment (Meta Ads <-> Google Places)]                                                    |
|    * Takes advertiser page name from Meta Ads -> Looks up Google Places -> Attaches star rating, reviews, address    |
|                                                                                                                      |
|  [Stage 4D: 10-Point Deterministic Scorecard (scorecard.ts)]                                                         |
|    * Active Meta Ads running       --> +3 points                                                                     |
|    * Google Review Count >= 50     --> +2 points                                                                     |
|    * Verified Instagram present    --> +1 point                                                                      |
|    * Official Website listed       --> +1 point                                                                      |
|    * Booking Friction Detected     --> +2 points                                                                     |
|    * High-Ticket Vertical          --> +1 point                                                                      |
|    * PRIORITY TIERS:                                                                                                 |
|      - [8 - 10 Pts] : IMMEDIATE OUTREACH (🔥 Fire Badge - Direct WhatsApp/Call)                                      |
|      - [6 - 7  Pts] : HIGH POTENTIAL     (🟢 Green Badge - Personalized Audit)                                       |
|      - [4 - 5  Pts] : MEDIUM PRIORITY    (🟡 Neutral Review)                                                         |
|      - [0 - 3  Pts] : SKIP / DISCARD     (⚪ Filtered Out)                                                           |
+----------------------------------------------------------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                5. AI INTELLIGENCE & AUDIT PITCH GENERATION LAYER                                     |
+----------------------------------------------------------------------------------------------------------------------+
|  [Google Gemini 2.5 Flash API (@google/generative-ai)]                                                               |
|    * Persona: Solo local operational consultant typing casually from a laptop/phone                                  |
|    * Task: Identifies exact conversion bottleneck (e.g. ad traffic dropping on contact form instead of WhatsApp)     |
|    * Backoff Retry: Exponential sleep on HTTP 429 / RESOURCE_EXHAUSTED                                               |
|                                                                                                                      |
|  [Code-Level Anti-Spam Validator (anti-spam-validator.ts)]                                                           |
|    * Sentence Constraint: 2 to 3 sentences max (under 300 characters)                                                |
|    * Strict Banned Phrases: 'We help', 'We specialize', 'Game-changer', 'Leverage', 'Hop on a call', 'Book a demo'   |
|    * Zero Placeholders: Strictly rejects [Name], [Company], [Clinic]                                                 |
|    * Zero False Testimonials: Never claims fabricated past clients                                                   |
|                                                                                                                      |
|  [Deterministic Fallback Engine]                                                                                     |
|    * Instantly produces high-converting peer pitch if LLM times out or hits API quota bounds                         |
+----------------------------------------------------------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                     6. STORAGE, SYNC & PERSISTENCE LAYER                                             |
+---------------------------------------------------+------------------------------------------------------------------+
|           A. Cloud Database (Supabase)            |                      B. Offline Fallback Mirror                  |
|  - PostgreSQL Database Table: `public.leads`      |  - Local JSON: `data/leads.json` (Synced after every run)        |
|  - Key Columns: id, business_name, phone_number,  |  - Raw CSVs: `data/reddit_results.csv`, `data/hiring_leads.csv`  |
|    source_platform, source_url, website_url,      |                                                                  |
|    instagram_url, google_maps_url, rating,        |  [Client-Side Cache]                                             |
|    review_count, has_active_ads, prospect_score,  |  - Browser `localStorage` ('lead_command_center_clean_v6')        |
|    audit_friction_points, draft_pitch, status     |  - Optimistic UI updates with zero-latency visual feedback       |
|  - B-Tree Indexes: `idx_leads_prospect_score`,    |                                                                  |
|    `idx_leads_business_name`                      |                                                                  |
+---------------------------------------------------+------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                               7. NEXT.JS 15 FRONTEND COMMAND CENTER (Desktop-First)                                  |
+----------------------------------------------------------------------------------------------------------------------+
|  [Top Shell & Navigation Bar]                                                                                        |
|    * Supabase Live Status Indicator (Connected / Fallback)                                                           |
|    * Reset / Sync from Database Button                                                                               |
|    * "Run Scraper" Trigger Modal (Select Reddit / Meta Ads / Google Maps with keyword inputs)                        |
|                                                                                                                      |
|  [4-Stage Funnel Strip & KPI Overview Cards]                                                                        |
|    * Ingested Total | Pitched Count | Replied Count | Booked Meetings Count                                          |
|    * Visual Conversion Progress Bars (Discovered -> Pitched -> Replied -> Booked)                                    |
|                                                                                                                      |
|  [Segmented Filter & Search Toolbar]                                                                                 |
|    * Multi-Platform Filter: [ALL] | [META ADS] | [GOOGLE MAPS] | [REDDIT] | [X]                                     |
|    * Keyword & Business Search (Debounced input matching Name, Phone, Friction, Category)                            |
|                                                                                                                      |
|  [Core Application Views (Full Bleed: 1280px - 2560px)]                                                              |
|    1. Kanban Pipeline View:                                                                                          |
|       - Column 1: New / Discovered                                                                                   |
|       - Column 2: Pitch Sent                                                                                         |
|       - Column 3: Replied                                                                                            |
|       - Column 4: Meeting Booked / Won                                                                               |
|    2. Master-Detail Feed View (7/5 Desktop Split):                                                                   |
|       - Left Panel (Col-7): Scrollable List of deduplicated lead cards with ratings, ads badge, score pill           |
|       - Right Panel (Col-5): Pinned Detail Inspector with friction audit list & formatted monospace pitch           |
|    3. Signals & Market Intelligence View:                                                                            |
|       - Categorizes recurring bottlenecks across industries to spot automated workflow agency packages               |
|                                                                                                                      |
|  [1-Click Direct Outreach Execution]                                                                                 |
|    * [Open in WhatsApp]: Generates direct link -> `https://wa.me/<phone>?text=<encoded_pitch>`                       |
|    * [Copy Pitch to Clipboard]: 1-click copy with visual "Copied!" feedback                                         |
|    * [Open Google Maps] / [Open Instagram] / [Visit Website] external quick links                                    |
|    * Stage Dropdown Selector: Immediate optimistic status mutation saved to Supabase                                 |
+----------------------------------------------------------------------------------------------------------------------+
                                     │
                                     ▼
+----------------------------------------------------------------------------------------------------------------------+
|                                          8. OUTREACH RECIPIENT / TARGET PROSPECT                                     |
+----------------------------------------------------------------------------------------------------------------------+
|  - Client receives high-context, 3-sentence casual observation on WhatsApp or Instagram DM                           |
|  - No cold sales buzzwords -> High response rate (Target: >=15%)                                                     |
|  - Meeting scheduled -> Status moved to "Meeting Booked" -> Revenue generated                                       |
+----------------------------------------------------------------------------------------------------------------------+
```

---

## 2. End-to-End Data Flow Sequence (Step-by-Step)

```
[Developer / User]
       │
       │ 1. Opens Dashboard & Clicks "Run Scraper" (or triggers cron)
       ▼
[Next.js Frontend]
       │
       │ 2. Sends POST request with search parameters
       ▼
[API Route: /api/scraper/google-maps or /meta-ads or /trigger]
       │
       │ 3. Dispatches Actor task to Apify Cloud
       ▼
[Apify Crawler Actors]
       │
       │ 4. Scrapes target platforms (Residential Proxies, Anti-Bot Bypass)
       │    Returns raw JSON dataset (places, ad creatives, or forum posts)
       ▼
[Normalization & Deduplication Engine (lib/)]
       │
       │ 5. Cleans phone numbers to +91 E.164
       │ 6. Strips business name legal suffixes
       │ 7. Cross-references database to skip already tracked URLs or phones
       ▼
[Scorecard Calculation Engine (lib/scorecard.ts)]
       │
       │ 8. Computes 10-Point Score:
       │    Ads (+3) + Reviews>=50 (+2) + Instagram (+1) + Web (+1) + Friction (+2) + HighTicket (+1)
       ▼
[Branching: Qualification Gate]
       ├─────────────────────────────────────────┐
       │ (Score < 6 / Unqualified)               │ (Score >= 6 / High Intent)
       ▼                                         ▼
[Assign default inquiry context]          [Google Gemini 2.5 Flash]
       │                                         │
       │                                         │ 9. Generates 2-3 sentence casual audit pitch
       │                                         ▼
       │                                  [Anti-Spam Validator (lib/anti-spam-validator.ts)]
       │                                         │
       │                                         │ 10. Asserts length, banned words, zero placeholders
       │                                         ▼
       └────────────────────┬────────────────────┘
                            │
                            ▼
               [Supabase PostgreSQL (public.leads)]
                            │
                            │ 11. Upsert lead record (`onConflict: source_url`)
                            │ 12. Backup to local `data/leads.json`
                            ▼
               [Next.js Dashboard Command Center]
                            │
                            │ 13. Realtime UI re-hydration in Kanban & Feed
                            ▼
               [1-Click Action: WhatsApp / Call]
                            │
                            │ 14. Developer clicks "Open in WhatsApp"
                            ▼
               [Target Business Owner WhatsApp Inbox]
```

---

## 3. Database Schema Contract (`public.leads`)

```sql
-- Supabase PostgreSQL Schema Definition
CREATE TABLE IF NOT EXISTS public.leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform         TEXT NOT NULL,               -- 'google_maps' | 'meta_ads' | 'reddit' | 'x'
  source_url              TEXT UNIQUE NOT NULL,        -- Unique constraint for deduplication
  author                  TEXT,
  subreddit_or_handle     TEXT,
  title                   TEXT NOT NULL,
  body_text               TEXT,
  identified_problem      TEXT,
  business_type           TEXT,
  confidence_score        INTEGER DEFAULT 0,          -- 1 - 10
  draft_pitch             TEXT,
  status                  TEXT DEFAULT 'new',          -- 'new' | 'pitch_sent' | 'replied' | 'meeting_booked' | 'archived'
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  
  -- Local Prospecting & Multi-Channel Specific Attributes
  business_name           TEXT,
  phone_number            TEXT,                        -- Clean E.164 format (+91...)
  website_url             TEXT,
  instagram_url           TEXT,
  google_maps_url         TEXT,
  address                 TEXT,
  rating                  NUMERIC(2, 1),               -- e.g. 4.8
  review_count            INTEGER DEFAULT 0,
  has_active_ads          BOOLEAN DEFAULT FALSE,
  prospect_score          INTEGER DEFAULT 0,          -- 1 - 10 Scorecard
  audit_friction_points   JSONB DEFAULT '[]'::jsonb,
  direct_contact_channel  TEXT DEFAULT 'whatsapp',
  notes                   TEXT
);

-- Fast Indexing for Instant Filtering & Search
CREATE INDEX IF NOT EXISTS idx_leads_prospect_score ON public.leads(prospect_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_business_name  ON public.leads(business_name);
CREATE INDEX IF NOT EXISTS idx_leads_status         ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_platform       ON public.leads(source_platform);
```

---

## 4. Key Directory & Code Map

```
Freeelancing Research tool/
├── app/
│   ├── api/
│   │   ├── leads/route.ts                --> Serves leads list & parsed statistics
│   │   └── scraper/
│   │       ├── google-maps/route.ts      --> Google Places Apify ingestion & scorecard pipeline
│   │       ├── meta-ads/route.ts         --> Meta Ad Library ingestion & cross-enrichment pipeline
│   │       ├── trigger/route.ts          --> Reddit autonomous scraper & Gemini triage pipeline
│   │       └── run/route.ts              --> Child process runner for local Python scripts
│   ├── globals.css                       --> Tailwind CSS v4 design tokens (monochrome + cyan)
│   ├── layout.tsx                        --> Root layout with Inter & Inter Tight fonts
│   └── page.tsx                          --> Command Center Dashboard (Kanban, Feed, Drawer, Funnel)
├── components/
│   ├── FilterBar.tsx                     --> Platform & status chips filter
│   ├── Header.tsx                        --> Top navbar with connection status & scrape modal button
│   ├── KpiMetrics.tsx                    --> Conversion funnel & stats cards
│   ├── LeadCard.tsx                      --> Deduplicated lead card with ratings, ad pill, score
│   ├── LeadDetailDrawer.tsx              --> Slide-over inspector for pitch & audit notes
│   ├── LeadTableView.tsx                 --> Structured data table view
│   └── ScraperModal.tsx                  --> Modal dialog to configure and run crawler jobs
├── data/
│   ├── leads.json                        --> Unified offline master lead dataset
│   ├── reddit_results.csv                --> Raw Reddit scrape output
│   └── hiring_leads.csv                  --> Categorized hiring leads with budget & contact signals
├── lib/
│   ├── anti-spam-validator.ts            --> Anti-spam rules, sentence counter, banned phrase blocker
│   ├── format-date.ts                    --> Relative timestamp formatting & UUID validation
│   ├── lead-parser.ts                    --> Parser for local CSV and JSON datasets
│   ├── pre-filter.ts                     --> Stage 2 regex pre-filtering for forum posts
│   ├── scorecard.ts                      --> 10-point prospect score calculation engine
│   ├── supabase.ts                       --> Supabase client initialization & connection check
│   └── types.ts                          --> Legacy data types
├── scripts/
│   ├── analyze_leads.py                  --> Python lead analysis script
│   ├── process-reddit-csv.js             --> Offline batch processing via Gemini
│   └── run_reddit_scraper.py             --> Standalone Reddit crawler execution script
├── supabase/
│   └── migrations/
│       └── 20260907_local_leads.sql      --> PostgreSQL schema migration for local leads
├── types/
│   └── lead.ts                           --> Master TypeScript interface definitions
├── design-v2.md                          --> UI/UX styling specification
├── PRD.md                                --> Product Requirements Document
└── ARCHITECTURE.md                       --> This architectural specification document
```
