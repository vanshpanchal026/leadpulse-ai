Project Name: Lead Pipeline Command Center (Freelance Research & Outreach Engine)

Version: 1.0

Status: MVP Operational (Sprint 1–3 Completed)

Owner: Vansh Panchal

1. Executive Summary & Problem Statement
Background
Manual client hunting on platforms like Reddit, X, and job boards is high-friction and inefficient. Over 85% of posts with keywords like "automation" or "chatbot" are developer self-promotions ([FOR HIRE]), bot summaries, or student discussions. Furthermore, traditional cold outreach (walk-ins, unsolicited cold calls, mass generic DMs) results in low conversion rates and causes high fatigue for solo, introverted developers.

The Solution
An internal, automated lead intelligence and command center that:

Scrapes high-intent discussions from business-centric communities via Apify.

Evaluates posts using an LLM (Gemini API) using strict pain-symptom criteria (e.g., missed customer inquiries, scheduling friction, after-hours coverage).

Automatically drafts genuine, value-first, non-salesy initial outreach messages.

Aggregates qualified prospects into an interactive, monochromatic Kanban and Feed dashboard for rapid 1-click execution.

2. Target Persona & Value Proposition
User Persona (Internal)
Role: Solo Full-Stack Developer & Automation Consultant.

Core Strengths: Frontend development (React, Next.js), n8n workflow orchestration, WhatsApp/Telegram API bots, Gemini/Claude integrations, VPS hosting.

Outreach Preference: Async, text-based, high-context warm responses. No aggressive cold calling or walk-ins.

Target Client Profile (Prospects)
Company Size: 10–20 employees / active operational flow (not zero-budget solo founders).

Niches: Local service businesses, dental clinics, boutique salons, real estate brokers, restaurants/hospitality, and established e-commerce brands.

Core Pain Points: High inbound message volume, slow response times outside business hours, manual booking errors, fragmented lead follow-up.

Offer Positioning: Framed strictly around capturing missed inquiries and automating calendar bookings, never pitched as generic "AI chatbots" or "tech automation."

3. System Architecture & Tech Stack
[Target Platforms: Reddit / X]
             │
             ▼
[Apify Actor: trudax/reddit-scraper-lite]
             │
      (Raw CSV / JSON)
             │
             ▼
[Ingestion & Pre-Filter Pipeline (Node.js/Python)]
             │
     (Candidate Posts)
             │
             ▼
[LLM Evaluation Engine: Gemini 2.5 Flash]
  - Symptom matching
  - Fit scoring (1-10)
  - Zero-hallucination pitch generator
             │
     (Qualified Leads >= 7)
             │
             ▼
[Data Storage: data/leads.json (→ Supabase)]
             │
             ▼
[Next.js 15 Command Center Dashboard]
  ├── Kanban Pipeline View
  ├── Master-Detail Feed View
  └── Signals / Analytics Radar
Core Technologies
Scraping Engine: Apify API (trudax/reddit-scraper-lite running on residential proxy networks).

AI Evaluation Engine: Google Gemini API (gemini-2.5-flash via @google/generative-ai).

Frontend Application: Next.js 15 (App Router, Server & Client Components), TypeScript.

Design & Styling: Tailwind CSS v4, custom CSS token system (monochromatic palette, #0a0a0a / #f5f5f5 / #ffffff, 18px interactive pill radii, 24px container radii).

Icons: lucide-react.

Data Storage: Local JSON (data/leads.json) transitioning to PostgreSQL (Supabase).

4. Detailed Functional Specifications
Module 1: Targeted Scraping Engine
Source Subreddits:

Primary: r/smallbusiness, r/smallbusinessowners, r/Entrepreneur, r/shopify.

Vertical-Specific: r/restaurantowners, r/realtors.

Excluded: r/forhire, r/webdev, r/n8n, r/automation (reduces noise by ~85%).

Query Strategy (Symptom-Based):

Target keywords: "missed calls", "missed leads", "too many messages", "after hours", "double booking", "no time to reply", "scheduling issues".

Execution Parameters:

skipComments: true (keeps cost low and focuses on post bodies).

Hard budget constraints capped per run to avoid Apify credit exhaustion.

Module 2: Ingestion & LLM Evaluation Engine
Local Pre-Filtering:

Regex exclusions: r'\[for hire\]|for hire|this week|weekly roundup|security report'.

LLM Analysis (gemini-2.5-flash):

Evaluates whether the author is an active business operator facing real friction.

Rejects developer chatter, tool showcase posts, and low-budget rants.

Filters strictly: is_potential_lead === true AND confidence_score >= 7.

Pitch Drafting Constraints (Strict):

Must reference the author's specific operational bottleneck.

Max 2–4 sentences.

Zero generic buzzwords ("synergy", "cutting-edge AI", "seamless bot").

Strict Truthfulness: Never claim fabricated past clients or say "I built this for a client" unless explicitly authenticated. Pitch from a problem-solver perspective.

Module 3: Lead Pipeline Command Center (UI/UX)
┌────────────────────────────────────────────────────────────────────────┐
│  [Ω] LEAD PIPELINE COMMAND CENTER        [Pipeline] [Feed] [Signals]   │
├────────────────────────────────────────────────────────────────────────┤
│  [Total Ingested: 170]  [High-Intent: 4]  [Pitched: 1]  [Booked: 0]    │
├────────────────────────────────────────────────────────────────────────┤
│  [Search keywords / pain points...]  [All Channels] [r/smallbusiness]  │
├────────────────────────────────────────────────────────────────────────┤
│  INBOUND (2)    │  QUALIFIED (2)    │  PITCH SENT (1)  │  CONVERTED (0)│
│  ────────────   │  ─────────────    │  ──────────────  │  ─────────────│
│  [HVAC Schedule]│  [WhatsApp Bot]   │  [Salon Booking] │               │
│  Score: 8/10    │  Score: 9/10      │  Score: 8/10     │               │
│  [Inspect Pitch]│  [Inspect Pitch]  │  [Inspect Pitch] │               │
└────────────────────────────────────────────────────────────────────────┘
Views
Pipeline Kanban View:

Four columns: Inbound / Discovered, Qualified Leads, Pitch Sent, Meeting Booked / Won.

Cards show title, subreddit tag, confidence score badge, and pain-point excerpt.

Stage dropdown selector allows immediate status transitions.

Master-Detail Feed View:

Split-screen layout. Left list scrolls through leads; right panel stays pinned with the inspector.

Displays the full Reddit post body, author handle, and a direct ExternalLink to the live thread.

Pitch Inspector & Drawer:

Displays the AI-generated proposal in a monospace quote container.

Single-click "Copy Pitch to Clipboard" with visual state feedback ("Copied!").

Signals View:

Categorizes recurring operational bottlenecks across all crawled threads to spot emerging agency service opportunities.

5. Data Model & Contract
TypeScript Schema (types/lead.ts)
TypeScript
export type LeadStatus = 'new' | 'qualified' | 'pitch_sent' | 'replied' | 'meeting_booked' | 'archived';
export type Platform = 'reddit' | 'x' | 'instagram';

export interface Lead {
  id: string;
  source_platform: Platform;
  source_url: string;
  author: string;
  subreddit_or_handle: string;
  title: string;
  body_text: string;
  identified_problem: string;
  business_type: string;
  confidence_score: number; // Scale: 1 - 10
  draft_pitch: string;
  status: LeadStatus;
  created_at: string;
}

export interface PipelineStats {
  total_crawled: number;
  qualified_count: number;
  pitches_delivered: number;
  meetings_scheduled: number;
}
6. System Prompt Specification
The following prompt serves as the immutable instruction set for scripts/process-reddit-csv.js:

Plaintext
You are evaluating Reddit posts on behalf of Vansh, a solo freelance developer providing custom operational automations to growing businesses.

CORE OFFERINGS:
- After-hours customer inquiry capture (WhatsApp / Web)
- Automated calendar scheduling and appointment booking
- Connecting incoming leads directly to spreadsheets or CRMs
- Eliminating manual message handling

QUALIFICATION CRITERIA:
- The poster must be an established business owner or operator (approx. 5-20+ staff).
- The poster has real incoming communication friction or lost business due to delays.
- REJECT: Freelancer self-promotion ([FOR HIRE]), software developers seeking feedback, rants with no operational business.

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "is_potential_lead": boolean,
  "business_type": string,
  "identified_problem": string,
  "confidence_score": number (1-10),
  "recommended_first_message": string
}

MESSAGE RULES:
- Exactly 2 to 4 sentences.
- Speak directly to their specific bottleneck.
- Do NOT use sales buzzwords ("transform", "cutting-edge", "game-changer").
- NEVER claim you built this exact system for a prior client.
- Offer technical insight on how the friction can be solved.
7. Success Metrics & KPIs
Ingestion Signal-to-Noise Ratio: ≥20% qualified leads from raw scrape batches (up from <5% in initial test).

Outreach Friction: <60 seconds from opening the dashboard to reviewing and delivering a tailored response on Reddit/X.

Response Rate Target: ≥15% positive reply rate on warm comments/DMs.

Execution Safety: Zero account bans or spam flags by prioritizing value-first comments over bulk cold DMs.

8. Implementation Roadmap
Phase 1: MVP Construction (Completed)
Next.js 15 monochromatic UI implementation.

Pre-filtering logic for reddit_results.csv.

Gemini 2.5 Flash batch processing pipeline.

Integration of local dataset into Kanban and Feed views.

Phase 2: Persistence & Workflow Enhancements (Next Up)
Status Persistence: Create Next.js API route (/api/leads/update-status) to persist drag-and-drop mutations directly to disk or database.

Direct UI Scraper Hookup: Connect the header "Run Scraper" modal to trigger Apify actors with custom keyword parameters.

Export Capabilities: CSV/JSON export for lead archiving.

Phase 3: Multi-Channel Expansion
Add Apify X (Twitter) search actor for real-time phrase monitoring ("need a developer for whatsapp", "looking to automate booking").

Supabase integration with user authentication and automated daily cron jobs.

Webhook alert delivery to Telegram for immediate notification on high-confidence (9+/10) leads.