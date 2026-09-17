# LeadPulse AI — V2 Codebase Audit & System Architecture Assessment

**Document Version:** 2.0.0  
**Date:** September 9, 2026  
**Auditor:** Lead Software Architect & Implementation Engineer  
**Repository Working Directory:** `C:\Users\pc\OneDrive\Desktop\Freeelancing Research tool`  
**Reference Document:** `LeadPulse AI — V2 Final System Architecture.md`  

---

## Executive Summary

This codebase audit evaluates the existing **LeadPulse AI V1** system in preparation for its architectural upgrade to **LeadPulse AI V2**. 

In V1, LeadPulse functions as a semi-automated lead capture tool with fixed search queries, direct Apify actor runs, client-driven API routes in Next.js 15, and single-turn Google Gemini 2.5 Flash pitch generation. While its deterministic scoring, phone/business normalization, and anti-spam validation engines are robust and highly effective, its intelligence layer is constrained by hardcoded keywords and reactive scraping.

In V2, LeadPulse transitions to an **autonomous multi-agent architecture** powered by the **OpenAI Agents SDK** and the user's **OpenAI-compatible API endpoint**. The fundamental design principle remains:
> **AI decides WHAT is worth investigating. Deterministic code decides HOW it is safely executed.**

This audit catalogs all existing components, maps current data flows, documents reusable algorithms, specifies required schema evolutions, and outlines a zero-regression phased migration plan.

---

## 1. Current Architecture

### 1.1 Architecture Overview & Subsystem Dichotomy
A critical finding of this audit is that the repository contains **two distinct architectural subsystems** representing two evolutionary stages of the project:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REPOSITORY TOPOLOGY                                  │
│                                                                                        │
│   ┌────────────────────────────────────────┐  ┌────────────────────────────────────┐   │
│   │   Subsystem A: Legacy Reddit CSV       │  │   Subsystem B: Local Prospecting   │   │
│   │   (V0 Prototype)                       │  │   LeadPulse V1 (Active System)     │   │
│   ├────────────────────────────────────────┤  ├────────────────────────────────────┤   │
│   │ • Type Contract: lib/types.ts          │  │ • Type Contract: types/lead.ts     │   │
│   │   (LeadIntent, PipelineStage)          │  │   (prospect_score, phone_number)   │   │
│   │ • Data Sources:                        │  │ • Data Sources:                    │   │
│   │   data/reddit_results.csv              │  │   Apify Google Places, Meta Ads    │   │
│   │   data/hiring_leads.csv                │  │ • Primary Persistence:             │   │
│   │ • Parser: lib/lead-parser.ts           │  │   Supabase (public.leads)          │   │
│   │ • API Endpoint: /api/leads             │  │ • Local Backup: data/leads.json    │   │
│   │ • Isolated Components:                 │  │ • Active Dashboard: app/page.tsx   │   │
│   │   Header.tsx, FilterBar.tsx,           │  │   LeadCard.tsx, ScraperModal.tsx   │   │
│   │   KpiMetrics.tsx, LeadTableView.tsx,   │  │ • API Routes: app/api/scraper/*    │   │
│   │   LeadDetailDrawer.tsx                 │  │ • Deterministic Scorecard:         │   │
│   │                                        │  │   lib/scorecard.ts (10 pts)        │   │
│   │                                        │  │ • LLM: Gemini 2.5 Flash            │   │
│   └────────────────────────────────────────┘  └────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Subsystem A (Legacy Reddit CSV Prototype):** Operates on `lib/types.ts` (`LeadIntent`: `'HIRING' | 'FOR_HIRE' | 'DISCUSSION'`, `PipelineStage`: `'inbox' | 'qualified' | 'outreach' | 'converted' | 'archived'`). Powered by `lib/lead-parser.ts`, consumed by `app/api/leads/route.ts`, and rendered by isolated components in `components/` (`Header.tsx`, `FilterBar.tsx`, `KpiMetrics.tsx`, `LeadDetailDrawer.tsx`, `LeadTableView.tsx`).
* **Subsystem B (LeadPulse V1 Multi-Channel Prospecting):** The primary active system. Operates on `types/lead.ts`, uses `app/page.tsx` (master-detail feed with KPI metrics and 4-stage funnel), triggers Apify via `app/api/scraper/*`, enforces the 10-point scorecard (`lib/scorecard.ts`), validates pitches via `lib/anti-spam-validator.ts`, and stores leads in Supabase `public.leads` with `data/leads.json` as a filesystem fallback.

### 1.2 Technology Stack
* **Framework:** Next.js 15.2.0 (App Router, Server & Client Components)
* **Language & Runtime:** TypeScript 5.7.0, Node.js 22+, Python 3.14.5
* **UI & Styling:** React 19.0.0, Tailwind CSS v4.0.0, Lucide React 1.16.0
* **External Scraper Engine:** Apify Cloud API Client (`apify-client` 2.25.0)
* **Current LLM SDK:** Google Generative AI (`@google/generative-ai` 0.24.1) using `gemini-2.5-flash`
* **Database & Persistence:** Supabase PostgreSQL (`@supabase/supabase-js` 2.115.0), Local Filesystem (`fs`, `papaparse`)
* **Deployment / Containerization:** Currently runs locally via `npm run dev` and `python` scripts. No `Dockerfile` or `docker-compose.yml` currently exists. Route handlers declare `maxDuration = 300` for Vercel deployment.

### 1.3 Environment Variables & Secrets Audit
* **Active Environment Variables (`.env` / `.env.local`):**
  * `APIFY_TOKEN` / `APIFY_API_TOKEN`: Configured with active Apify token (`euphonic_hamper` account).
  * `GEMINI_API_KEY`: Configured with Google AI Studio key for `gemini-2.5-flash`.
  * `NEXT_PUBLIC_SUPABASE_URL`: Active Supabase project URL (`https://fkgyaqwplieawuphxagu.supabase.co`).
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key for public queries.
* **Missing Variables for V2 Upgrade:**
  * `AI_API_KEY`: User's OpenAI-compatible API key.
  * `AI_BASE_URL`: Base URL for custom OpenAI-compatible endpoint.
  * `AI_MODEL`: Target model identifier.
  * `AI_API_MODE`: Protocol mode (`responses` vs `chat_completions`).
  * `SUPABASE_SERVICE_ROLE_KEY`: Service-role key for backend AI worker database writes.
  * `AI_WORKER_URL`: Internal URL of the Python AI worker (e.g., `http://localhost:8000`).

### 1.4 Existing Scripts & Tooling Audit
The repository contains 9 specialized utility and test scripts in `scripts/`:
1. **`scripts/test-scorecard.js` (Node.js):** Verifies the 10-point scorecard against 3 benchmark test cases (high-ticket dental clinic = 10/10; mid-tier salon = 4/10; hardware store = 2/10).
2. **`scripts/test-svg-safety.ts` (Node.js / tsx):** Asserts SVG icon sanitization (no nested `<svg>`, strict dimensions) and Tailwind CSS v4 `@theme` import rules.
3. **`scripts/test-meta-ads.ts` (Node.js / tsx):** Integration test for the Meta Ads pipeline with Google Places cross-enrichment. (Fixed ESM `dotenv/config` import order to eliminate Supabase fallback warning).
4. **`scripts/process-reddit-csv.py` (Python):** Standalone Python pipeline implementing CSV loading, pre-filtering, Gemini 2.5 Flash prompting with HTTP 429 exponential backoff, and direct Supabase upserts. Provides an immediate architectural reference for the Python AI worker.
5. **`scripts/process-reddit-csv.js` (Node.js):** Node.js equivalent of the Reddit processor integrating `lib/pre-filter.ts` and `lib/anti-spam-validator.ts`.
6. **`scripts/analyze_leads.py` (Python):** Standalone text analysis script with regex extractors for hiring intent, contact methods (Email, Telegram, Discord, Calendly), and budget ranges.
7. **`scripts/run_reddit_scraper.py` (Python):** Triggers Apify actor `trudax/reddit-scraper-lite` via Python `requests`.
8. **`scripts/deduplicate-leads.js` (Node.js):** Multi-key deduplication utility across Supabase and `data/leads.json` that merges duplicate records based on completeness scoring.
9. **`scripts/migrate-to-supabase.js` (Node.js):** Migrates `data/leads.json` to Supabase `public.leads`. (Updated to preserve all local prospecting columns: `phone_number`, `business_name`, `prospect_score`, `website_url`, etc., preventing data loss).

---

## 2. Existing Data Flow

### 2.1 Reddit Pathway (`/api/scraper/trigger` & `scripts/process-reddit-csv.js`)
1. **Trigger:** User selects subreddits and keywords in `ScraperModal.tsx` or runs `npm run process-leads`.
2. **Data Acquisition:** Calls Apify actor `trudax/reddit-scraper-lite` with search query URLs.
3. **Stage 1 Deduplication:** Checks URLs against Supabase `public.leads` and `data/leads.json`.
4. **Stage 2 Pre-Filtering (`lib/pre-filter.ts`):** Evaluates posts against `OBVIOUS_REJECT_PATTERNS` (dropping `[for hire]`, portfolio links, freelancer pitches, weekly megathreads). Checks `CANDIDATE_SIGNALS` (`missed calls`, `after hours`, `double booking`, `scheduling friction`). Rejects non-candidate noise without LLM token cost.
5. **AI Qualification:** Passes candidates to Gemini 2.5 Flash to classify business type, identify operational bottlenecks, and generate a draft outreach message.
6. **Tone & Anti-Spam Validation (`lib/anti-spam-validator.ts`):** Enforces 2–3 sentences, banned phrase rejection, and zero placeholder tags.
7. **Persistence:** Upserts qualified records into Supabase `public.leads` (on conflict `source_url`) and appends to `data/leads.json`.

### 2.2 Google Maps Pathway (`/api/scraper/google-maps`)
1. **Trigger:** User submits search queries (e.g., `skin clinic in Delhi`, `dental clinic in South Delhi`).
2. **Data Acquisition:** Triggers Apify actor `compass/crawler-google-places` to scrape business titles, addresses, ratings, review counts, websites, and social media links.
3. **Normalization:** Formats phone numbers to standard E.164 (`+91...`). Extracts Instagram profile handles from nested metadata or website social links.
4. **Deterministic Scorecard (`lib/scorecard.ts`):** Calculates 10-point prospect score based on review count, website presence, Instagram presence, and booking friction.
5. **AI Pitch Generation:** For leads scoring $\ge 6$, Gemini 2.5 Flash drafts a 2–3 sentence operational WhatsApp audit note. If Gemini fails or is unconfigured, a deterministic template fallback pitch is assigned.
6. **Persistence:** Upserts into Supabase `leads` and synchronizes with `data/leads.json`.

### 2.3 Meta Ads Pathway (`/api/scraper/meta-ads`)
1. **Trigger:** User provides niche/location query (e.g., `Skin Clinic Delhi`).
2. **Data Acquisition:** Queries Meta Ad Library via `apify/facebook-ads-scraper` for active campaigns in India.
3. **Landing Page Inspection & Phone Extraction:** Fetches landing page HTML (`fetchLandingPagePhoneAndFriction`) to scan for `wa.me`, `tel:`, or 10-digit Indian phone numbers.
4. **Business Name Normalization & Deduplication:** Cleans corporate and clinic suffixes (`Pvt Ltd`, `LLP`, `Clinic`, `Dental`) to group multiple ad variants under a single unique business identity.
5. **Cross-Enrichment via Google Places:** Executes background Google Places lookup (`enrichMetaCandidatesWithGooglePlaces`) to retrieve Google Maps ratings, review counts, and physical addresses for advertiser businesses.
6. **Deterministic Scoring:** Incorporates active ads (+3 points) into `calculateProspectScore`.
7. **AI Pitch Generation:** Produces ad-spend efficiency pitch pointing out form drop-off vs. automated WhatsApp routing.
8. **Persistence:** Upserts into Supabase and updates `data/leads.json`.

### 2.4 Data Consumption & Mutation Flow
* **UI Hydration:** `app/page.tsx` loads leads from Supabase `leads` table ordered by `created_at DESC`. If Supabase is unreachable or unconfigured, falls back to browser `localStorage` (`lead_command_center_clean_v6`), then to `data/leads.json`.
* **Lead Deduplication in UI:** Function `deduplicateLeads()` ensures 1 unique business = 1 lead card.
* **Status Updates:** User changes lead status (`new`, `pitch_sent`, `replied`, `meeting_booked`, `archived`) via UI dropdown. The update executes an immediate Supabase query `supabase.from('leads').update({...}).eq('id', leadId)` with optimistic UI and toast confirmation.

---

## 3. Existing Apify Actors

| Actor Name | Actor ID | Current Use Case | Input Parameters Used | Budget & Rate Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **Reddit Scraper Lite** | `trudax/reddit-scraper-lite`<br>(ID: `oAuCIx3ItNrs2okjQ`) | Scrapes new posts from target subreddits | `startUrls`, `skipComments: true`, `includeMediaLinks: false`, `maxPostCount: 6`, `maxItems: 20-240`, `sort: 'new'`, `proxy: { useApifyProxy: true }` | Pay-per-event ($0.02 start + $0.004/item). Bounded to max 20–30 items per run in UI to stay under $0.30. |
| **Google Places Crawler** | `compass/crawler-google-places` | Extracts local business names, addresses, phone numbers, ratings, reviews, websites, and social links | `searchStringsArray`, `maxCrawledPlacesPerSearch: 10-20`, `language: 'en'`, `scrapeWebSocialMedia: true`, `scrapePlaceDetails: true`, `skipClosedPlaces: true` | Pay-per-result. Limited to 15–30 places per run to control runtime and cost. |
| **Facebook / Meta Ads Scraper** | `apify/facebook-ads-scraper` | Discovers active advertisers running campaigns in India | `startUrls`, `searchTerms`, `countryCode: 'IN'`, `adActiveStatus: 'ACTIVE'`, `resultsLimit: 10-30`, `includeAboutPage: true`, `isDetailsPerAd: true` | Bounded to 10–30 ads per run. |

---

## 4. Existing API Endpoints

| Endpoint | Method | Location | Purpose | Request Payload | Response Structure |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `/api/leads` | `GET` | `app/api/leads/route.ts` | Returns parsed leads and statistical breakdown from local CSVs (`reddit_results.csv`, `hiring_leads.csv`) | None | `{ leads: Lead[], stats: LeadStats }` |
| `/api/scraper/trigger` | `POST` | `app/api/scraper/trigger/route.ts` | Runs Apify Reddit scraper, pre-filters posts, evaluates via Gemini, upserts qualified leads | `{ subreddits?: string[], keywords?: string[], maxPosts?: number }` | `{ success: boolean, total_scraped: number, prefilter_rejected: number, evaluated: number, anti_spam_blocked: number, qualified: number, leads: Lead[] }` |
| `/api/scraper/google-maps` | `POST` | `app/api/scraper/google-maps/route.ts` | Ingests Google Places items, calculates scorecards, generates audit pitches, upserts to Supabase | `{ runActor?: boolean, searchQueries?: string[], maxPlacesPerSearch?: number, items?: any[] }` | `{ success: boolean, total_ingested: number, duplicates_skipped: number, evaluated: number, qualified_leads_count: number, leads: Lead[] }` |
| `/api/scraper/meta-ads` | `POST` | `app/api/scraper/meta-ads/route.ts` | Ingests Meta ad items, enriches via Google Places crawler, calculates scorecards, generates pitches | `{ searchQuery?: string, maxAds?: number, runActor?: boolean, items?: any[] }` | `{ success: boolean, search_query: string, total_ingested: number, duplicates_skipped: number, evaluated: number, qualified_leads_count: number, leads: Lead[] }` |
| `/api/scraper/run` | `POST` | `app/api/scraper/run/route.ts` | Spawns local Python scripts (`run_reddit_scraper.py` or `analyze_leads.py`) via `child_process.spawn` | `{ action: 'scrape' \| 'reanalyze' }` | `{ success: boolean, message: string, output: string, error?: string }` |

### 4.1 Serverless Timeout Constraints & Multi-Agent Architecture
All scraper route handlers currently declare `export const maxDuration = 300` (5 minutes) for Vercel/Next.js hosting. While sufficient for single keyword batch runs, autonomous multi-agent campaigns in V2 (generating contextual search plans, crawling maps, auditing landing pages, evaluating ads, synthesizing evidence, and drafting validated outreach) will exceed standard serverless execution limits.

**Architectural Decision for V2:**
Next.js route handlers must NOT execute long-running agent loops directly. Instead, Next.js acts as an orchestration proxy:
1. `POST /api/research/run` initiates a campaign run in the background Python AI Worker (`ai-worker/`) and returns a `run_id` immediately ($< 200$ms).
2. The Python worker manages autonomous execution, rate limits, and database state updates independently.
3. Next.js dashboard polls `GET /api/research/run/:id` or subscribes to Supabase realtime events to stream live agent progress without risking HTTP timeouts.

---

## 5. Existing Supabase Schema

### 5.1 Table: `public.leads`
Defined and migrated across `scripts/migrate-to-supabase.js` and `supabase/migrations/20260907_local_leads.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform         TEXT NOT NULL,               -- 'google_maps' | 'meta_ads' | 'reddit' | 'x'
  source_url              TEXT UNIQUE NOT NULL,        -- Deduplication key on conflict
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
  
  -- Local Prospecting & Multi-Channel Specific Columns
  business_name           TEXT,
  phone_number            TEXT,                        -- Clean E.164 (+91...)
  website_url             TEXT,
  instagram_url           TEXT,
  google_maps_url         TEXT,
  address                 TEXT,
  rating                  NUMERIC(2, 1),
  review_count            INTEGER DEFAULT 0,
  has_active_ads          BOOLEAN DEFAULT FALSE,
  prospect_score          INTEGER DEFAULT 0,          -- 1 - 10 Scorecard
  audit_friction_points   JSONB DEFAULT '[]'::jsonb,
  direct_contact_channel  TEXT DEFAULT 'whatsapp',
  notes                   TEXT
);

-- Existing Indexes
CREATE INDEX IF NOT EXISTS idx_leads_prospect_score ON public.leads(prospect_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_business_name  ON public.leads(business_name);
```

### 5.2 Client Helpers (`lib/supabase.ts`)
* `supabase`: Standard anonymous client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
* `getServiceSupabase()`: Server-side admin client using `SUPABASE_SERVICE_ROLE_KEY` (with fallback to anon key) for bypassing RLS during background agent writes.

---

## 6. Existing Scoring Logic & Lead Triage Handoff

Implemented in `lib/scorecard.ts` with unit verification in `scripts/test-scorecard.js`.

### 6.1 Scorecard Points Breakdown (10 Points Total)
1. **Active Meta / Google Ads:** $+3$ points (`has_active_ads === true`)
2. **Google Review Count $\ge 50$:** $+2$ points (`review_count >= 50`)
3. **Verified Instagram Handle / URL:** $+1$ point (`isValidInstagramUrl(instagram_url)`)
4. **Official Website Listed:** $+1$ point (`isValidWebsiteUrl(website_url)`)
5. **Operational / Conversion Friction Detected:** $+2$ points (`frictionPoints.length > 0`)
6. **High-Ticket Vertical:** $+1$ point (`isHighTicketNiche(...)`)

### 6.2 Priority Tiers
* **$8 - 10$ points:** `immediate` (🔥 Immediate outreach candidate — active marketing with conversion friction)
* **$6 - 7$ points:** `high` (🟢 High potential candidate)
* **$4 - 5$ points:** `medium` (🟡 Medium priority candidate)
* **$0 - 3$ points:** `skip` (⚪ Filtered out)

### 6.3 Helper Functions
* `isValidInstagramUrl()`: Verifies handle or valid URL, excludes `/p/` or `/reel/` post links.
* `isValidWebsiteUrl()`: Filters out WhatsApp (`wa.me`, `whatsapp.com`) and Facebook URLs so they aren't scored as true websites.
* `isHighTicketNiche()`: Matches against `HIGH_TICKET_KEYWORDS` (`dental`, `dentist`, `implant`, `clinic`, `hair transplant`, `interior`, `luxury salon`, `med spa`, `aesthetic`, `dermatolog`, `cosmetic`, `plastic surg`).
* `detectFrictionPoints()`: Identifies missing websites, lack of 1-click WhatsApp buttons, or high offline review volume without 24/7 inquiry automation.

### 6.4 Deterministic Scorecard vs. AI Lead Triage Handoff (V2 Interaction)
The deterministic scorecard directly controls the handoff to the Phase 10 **Lead Triage Agent**:
```
Raw Scraped Businesses
          │
          ▼
Deterministic Scorecard (lib/scorecard.ts)
          │
    ┌─────┴─────────────────────┐
    ▼                           ▼
Score 0–3                   Score 4–10
(Skip Tier)                 (Eligible Candidates)
    │                           │
    ▼                           ▼
Filtered Out               Lead Triage Agent (Cheap LLM Call)
(Zero LLM Tokens Spent)    • Evaluates qualification
                           • Assigns priority (high/med/low)
                           • Decides which specialists to run:
                             ["website", "ads", "maps"]
```

---

## 7. Existing AI Logic

### 7.1 LLM Provider & SDK
* **Provider:** Google Gemini API via `@google/generative-ai`
* **Model:** `gemini-2.5-flash` with `temperature: 0.2` and `responseMimeType: 'application/json'`
* **Error Handling:** Exponential backoff on HTTP 429 (`RESOURCE_EXHAUSTED` / Quota Exceeded)

### 7.2 Tone Guidelines & Prompt Constraints
Across all endpoints and scripts (`trigger/route.ts`, `google-maps/route.ts`, `meta-ads/route.ts`, `process-reddit-csv.js`):
1. **Perspective:** Solo local tech/operations consultant (Vansh) typing from a phone or laptop.
2. **Brevity:** Strictly 2 to 3 casual sentences (under 300–400 characters).
3. **No Agency Jargon:** Rejects "We help", "We specialize", "Game-changer", "Leverage", "Tailored solution", "Hop on a call", "Book a demo".
4. **No Fabrication:** Never invents client testimonials or claims past work not in the data.
5. **No Template Placeholders:** Rejects `[Name]`, `[Company]`, `[Clinic]`.

### 7.3 Code-Level Anti-Spam Validator (`lib/anti-spam-validator.ts`)
* `validateLeadOutput()`: Enforces validation rules deterministically in code before any lead or pitch can be saved.
* `BANNED_PHRASES`: List of 30+ blacklisted phrases.
* `countSentences()`: Splits on sentence punctuation while protecting abbreviations (`e.g.`, `Dr.`, `vs.`).
* `detectPlaceholders()`: Regex pattern detector for brackets, curlies, and angles.

**Validation Code Divergence Found in Audit:**
While `lib/anti-spam-validator.ts` exposes `validateLeadOutput()`, both `google-maps/route.ts` and `meta-ads/route.ts` currently reimplement inline copies of regex and banned phrase checks rather than importing `validateLeadOutput()`. In V2, outreach validation must be strictly centralized into a single deterministic guardrail in both Python (`guardrails/outreach.py`) and TypeScript to prevent rule drift.

---

## 8. Existing Dashboard Architecture

Located in `app/page.tsx`:
* **Header Bar:** Brand mark, Supabase Live / Local Cache status pill, "Run Scraper" action button, "Sync Supabase" button, "Export Leads" (JSON) button.
* **Pipeline Overview & Funnel Strip:** 4-stage funnel visualization:
  1. *Discovered $\rightarrow$ Pitched*
  2. *Pitched $\rightarrow$ Replied*
  3. *Replied $\rightarrow$ Booked*
  4. *Overall Conversion*
* **KPI Metrics Cards:** Total Tracked, High-Intent ($\ge 8$), Pitched, Booked Calls.
* **Filter Bar:** Source selection pills (`All`, `Meta Ads (Spenders)`, `Google Maps`, `Reddit`, `X`), search input, channel pills, status pills (`All`, `New`, `Pitched`, `Replied`, `Booked`, `Archived`).
* **Master-Detail Feed View (Col-7 / Col-5):**
  * *Left Column (7 cols):* Card feed rendering `LeadCard.tsx` with business badges, review stars, active ad flags, phone pills, and status chips.
  * *Right Column (5 cols):* Sticky pitch inspector panel rendering `InspectorBody` with operational audit details, direct 1-click WhatsApp button (`https://wa.me/<phone>?text=...`), pitch copy button, and status transition buttons.
* **Slide-over Drawer:** Pinned inspector for deep inspection on mobile or drawer toggle.
* **Scraper Modal (`components/ScraperModal.tsx`):** Tabbed dialog to trigger Meta Ads, Google Maps, or Reddit scrapers with animated step progress simulation.

---

## 9. Reusable Modules

The following existing files and functions are production-ready and **must be preserved and reused** in V2:

### 9.1 Reusable TypeScript Modules
1. **`lib/scorecard.ts`:**
   * `calculateProspectScore()` — Complete 10-point scoring algorithm.
   * `detectFrictionPoints()` — Heuristics for conversion friction.
   * `HIGH_TICKET_KEYWORDS` — High-LTV seed verticals list.
   * `isValidWebsiteUrl()` & `isValidInstagramUrl()` — Sanitization functions.
2. **`lib/anti-spam-validator.ts`:**
   * `validateLeadOutput()` — Verification gate for pitches.
   * `BANNED_PHRASES` — Comprehensive blacklist.
   * `countSentences()` & `detectPlaceholders()` — Text safety checks.
3. **Phone & Business Normalization:**
   * E.164 phone normalizer (`normalizePhoneNumber` in `google-maps/route.ts` & `meta-ads/route.ts`).
   * Business name suffix stripper (`normalizeBusinessName` in `meta-ads/route.ts` & `deduplicate-leads.js`).
   * Deduplication logic (`deduplicateLeads` in `page.tsx` & `deduplicate-leads.js`).
4. **Apify Actor Execution Configurations:**
   * Exact actor IDs, input parameters, and pagination limits for `compass/crawler-google-places`, `apify/facebook-ads-scraper`, and `trudax/reddit-scraper-lite`.
5. **Cross-Enrichment Heuristic:**
   * Linking Meta Ads advertiser names to Google Places reviews/ratings/address (`enrichMetaCandidatesWithGooglePlaces`).
6. **`types/lead.ts`:**
   * Core `Lead`, `LeadStatus`, `Platform` type contracts.
7. **UI Component Assets:**
   * `LeadCard.tsx`, WhatsApp and Instagram SVGs, funnel progress calculation logic in `page.tsx`.

### 9.2 Reusable Python Modules & Reference Logic
1. **`scripts/process-reddit-csv.py`:**
   * Exponential backoff and retry handling on HTTP 429 (`RESOURCE_EXHAUSTED`).
   * Direct Supabase REST client initialization and batch upsert logic.
2. **`scripts/analyze_leads.py`:**
   * Regex extractors for contact discovery (`extract_contacts`: emails, telegram, discord, calendly).
   * Regex extractors for commercial budget signals (`extract_budget`).
3. **`scripts/run_reddit_scraper.py`:**
   * Synchronous polling pattern for Apify actor execution via HTTP REST API.

---

## 10. Files That Need Modification

| File Path | Nature of Modification | Rationale |
| :--- | :--- | :--- |
| `types/lead.ts` | Add V2 schema properties | Add `ai_analysis`, `research_status`, `research_priority`, `recommended_service`, `opportunity_score`, `research_sources`, `agent_version`, `model_name`, `token_usage`, `research_timestamp`, `research_run_id`. |
| `app/page.tsx` | Extend UI for Autonomous Campaigns & Specialist Evidence | Add Campaign Launcher modal trigger; display AI Opportunity Score alongside Deterministic Score; render Specialist Evidence tabs (Website, Ads, Maps); support human approval flow before WhatsApp launch. |
| `components/ScraperModal.tsx` | Upgrade to Campaign Engine UI | Transition from static keyword picker to Campaign Engine interface (Goal, Locations, Seed Verticals, Max Queries, Max Candidates, Autonomy limits). |
| `components/LeadCard.tsx` | Display V2 badges & Opportunity Score | Render AI Opportunity Score, Recommended Service pill, and specialist inspection triggers. |
| `lib/supabase.ts` | Add service-role client helper | Enable server-side operations from API routes and background AI workers without anon-key RLS permission blocks (`getServiceSupabase()`). |
| `.env.example` | Document V2 variables | Add `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_MODE`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_WORKER_URL`. |
| `package.json` | Add dev scripts for AI worker | Add convenience scripts for running the Python AI worker and test suites (`npm run worker`, `npm run test:worker`). |

---

## 11. Files That Need Creation

### 11.1 Documentation & Migrations
* `docs/V2_CODEBASE_AUDIT.md` (This document)
* `docs/V2_PROVIDER_COMPATIBILITY.md` (Phase 1 provider test report)
* `supabase/migrations/20260909_v2_research.sql` (Supabase schema migration adding V2 columns and `research_runs` table)

### 11.2 Python AI Worker (`ai-worker/`)
Suggested modular structure isolating the multi-agent runtime:

```
ai-worker/
├── main.py                      # FastAPI/Uvicorn HTTP server exposing /campaign and /research endpoints
├── requirements.txt             # Python dependencies (openai, agents-sdk, pydantic, supabase, httpx, uvicorn, fastapi)
│
├── config/
│   ├── settings.py              # Centralized environment & model provider configuration
│   ├── profile.py               # Configurable LeadPulse business profile (Vansh's services & target profile)
│   └── limits.py                # Campaign safety boundaries (max queries, budget bounds, rate limits)
│
├── schemas/
│   ├── campaign.py              # Pydantic schema for Campaign definitions & bounds
│   ├── search.py                # Structured search plan generated by Search Strategist
│   ├── business.py              # Normalized business candidate schema
│   ├── analysis.py              # Specialist outputs & Lead Analyst intelligence schema
│   └── outreach.py              # Outreach draft & validator schema
│
├── tools/
│   ├── google_maps.py           # Controlled Apify Google Places wrapper
│   ├── meta_ads.py              # Controlled Apify Meta Ads scraper wrapper
│   ├── reddit.py                # Controlled Apify Reddit scraper wrapper
│   ├── website.py               # Lightweight website fetcher & DOM auditor
│   ├── database.py              # Supabase persistence tool
│   └── campaign.py              # Campaign limits & budget status tool
│
├── agents/
│   ├── main_agent.py            # Main LeadPulse Agent (manager orchestrator)
│   ├── search_strategist.py     # Search Strategist Agent (contextual query generator)
│   ├── triage_agent.py          # Lead Triage Agent (cheap candidate qualification)
│   ├── website_agent.py         # Website Specialist Agent (UX, forms, booking friction)
│   ├── ads_agent.py             # Ads Specialist Agent (active creative, offers, mismatch)
│   ├── maps_agent.py            # Maps Specialist Agent (reputation, location, category)
│   ├── opportunity_agent.py     # Opportunity Agent (service matching & value proposition)
│   ├── lead_analyst.py          # Lead Analyst (final structured intelligence synthesis)
│   └── outreach_agent.py        # Outreach Agent (personalized 2-3 sentence casual pitch)
│
├── guardrails/
│   ├── search.py                # Geographic & vertical boundary validator
│   ├── research.py              # Evidence & hallucination prevention guardrail
│   └── outreach.py              # Ported anti-spam validator (length, banned phrases, placeholders)
│
└── tests/
    ├── test_provider.py         # Phase 1 isolated provider compatibility tests
    ├── test_scorecard.py        # Deterministic pipeline verification
    ├── test_tools.py            # Controlled tool execution tests
    └── test_end_to_end.py       # Mini campaign end-to-end integration test
```

### 11.3 Next.js Internal API Endpoints (`app/api/research/`)
* `app/api/research/campaign/route.ts` — Create & list research campaigns.
* `app/api/research/run/route.ts` — Trigger autonomous research run via AI worker HTTP proxy.
* `app/api/research/run/[id]/route.ts` — Poll live research run status and token usage.
* `app/api/research/lead/[id]/approve/route.ts` — Human approval gate for outreach pitches.

---

## 12. Potential Breaking Changes

1. **LLM Provider Replacement:**
   * *Change:* Replacing `@google/generative-ai` with OpenAI Agents SDK over the user's OpenAI-compatible API.
   * *Mitigation:* Ensure Phase 1 verifies tool-calling and structured JSON output before agents are built. Keep deterministic fallback pitches active during transition.
2. **Database Schema Additions:**
   * *Change:* Adding `ai_analysis` JSONB and tracking columns to `public.leads`.
   * *Mitigation:* Use `ADD COLUMN IF NOT EXISTS` with safe defaults (`NULL` or `'[]'::jsonb`). Existing V1 leads will remain completely intact and valid.
3. **Dual-Runtime Coordination:**
   * *Change:* Next.js (port 3000) communicating with Python AI Worker (port 8000).
   * *Mitigation:* The Next.js app should communicate with the worker via internal HTTP calls with timeout handling, and write to the shared Supabase instance. If the AI worker is offline, the Next.js dashboard continues to operate in V1 mode seamlessly.
4. **Serverless Execution Timeouts:**
   * *Change:* Next.js API routes time out at 300 seconds on Vercel. Multi-agent research campaigns will exceed this window.
   * *Mitigation:* Long-running multi-agent campaign jobs run asynchronously inside the Python AI worker. Next.js triggers the run, receives a `run_id` immediately, and polls status or receives webhooks.
5. **Deduplication Key Stability:**
   * *Change:* Autonomous search generating adjacent search queries may uncover already tracked businesses under slightly different query strings.
   * *Mitigation:* Maintain multi-key deduplication (`source_url`, normalized business name, and E.164 phone number) in the deterministic pipeline before leads reach the database.

---

## 13. Migration Strategy

The migration from V1 to V2 will follow an incremental, phased progression without disrupting existing features:

```
Phase 0: Codebase Audit (Complete)
    ↓
Phase 1: Provider Compatibility Verification
    * Run test_provider.py against user's OpenAI-compatible endpoint
    * Test: chat completion, tool calling, structured Pydantic output, agent loop
    * Output: docs/V2_PROVIDER_COMPATIBILITY.md
    ↓
Phase 2 & 3: AI Worker Skeleton & Centralized Provider Setup
    * Setup ai-worker/ directory, FastAPI server, requirements.txt
    * Centralize config/settings.py (AI_KEY, AI_BASE_URL, AI_MODEL, AI_API_MODE)
    ↓
Phase 4 & 5: Business Profile & Campaign Engine
    * Configure Vansh's consulting profile in config/profile.py
    * Implement Campaign bounds and models in schemas/campaign.py
    ↓
Phase 6, 7 & 8: Search Strategist & Controlled Apify Tools
    * Wrap Google Maps, Meta Ads, and Reddit Apify actors into controlled Python tools
    * Build Search Strategist Agent to autonomously plan contextual queries
    ↓
Phase 9 & 10: Deterministic Pipeline & Triage Agent
    * Port normalization, deduplication, and 10-point scorecard to Python
    * Implement cheap Triage Agent to select candidates for deep research
    ↓
Phase 11–16: Specialists, Opportunity, Analyst & Outreach Pipeline
    * Implement Website, Ads, and Maps specialist agents (parallel execution)
    * Implement Opportunity Agent, Lead Analyst, and Outreach Agent
    * Integrate deterministic Anti-Spam Validator
    ↓
Phase 17–20: Supabase V2 Schema & Research Run Tracking
    * Apply 20260909_v2_research.sql migration to Supabase
    * Track run metrics (queries, filtered, researched, qualified, token usage)
    ↓
Phase 21–23: Next.js API Routes, Dashboard UI & Human Approval
    * Add /api/research routes to Next.js
    * Update dashboard to display campaign controls, live status, and deep intelligence
    * Maintain strict Human-in-the-Loop approval for WhatsApp outreach
    ↓
Phase 24–26: End-to-End Verification & Rollout
    * Run 5–10 lead small campaign test
    * Verify end-to-end flow from Campaign → Search → Scrape → Score → Triage → Deep Research → Pitch → Approval
```

---

## Audit Conclusion & Next Steps

The LeadPulse V1 codebase provides a solid, working foundation. The deterministic components (`lib/scorecard.ts`, `lib/anti-spam-validator.ts`, phone/business normalizers, and Apify actor configurations) are fully aligned with the V2 specification and can be preserved directly.

**Immediate Next Action:**
Proceed to **Phase 1 (Provider Compatibility Verification)** by constructing a minimal, isolated test against the user's OpenAI-compatible API to verify tool-calling and structured JSON output capabilities.
