# LeadPulse AI V2 — Phase 8: Research Persistence & Campaign Run Storage Implementation Report

**Document Version:** 8.0.0  
**Implementation Date:** September 9, 2026  
**Status:** **PHASE 8 COMPLETE — ALL VERIFICATIONS PASSED**  
**Integration Status:** Live Pipeline Verified (`Campaign Research Run` -> `Candidate Discovery & Normalization` -> `Specialist Parallel Research` -> `Opportunity Scoring & Bottleneck Reasoning` -> `Lead Intelligence Synthesis` -> `Outreach Drafting & Validation` -> `Human Approval Boundary` -> `Durable Multi-Agent Persistence` -> `Phase 9 React Dashboard API Contract`)  
**Hard Architectural Boundary:** **ZERO AUTOMATIC EXTERNAL COMMUNICATION** (No WhatsApp, SMS, email, or DM dispatched; Phase 8 persists intelligence and human approval state without external execution).

---

## 1. Executive Summary

Phase 8 implements the deterministic persistence layer and research run lifecycle storage for LeadPulse AI V2. Building upon the intelligence synthesis and outreach validation delivered across Phases 0–7, Phase 8 ensures that the complete multi-agent research pipeline persists its findings durably into Supabase and local mirror storage, surviving worker restarts, server restarts, dashboard refreshes, and campaign completions.

### Complete Architecture Pipeline:

```text
Next.js Dashboard (Phase 9 Consumer)
      │
      ▼
Python AI Worker (FastAPI Gateway)
      │
      ▼
Multi-Agent Pipeline (OpenAI Agents SDK)
[Search Strategist ──► Specialists (Website/Ads/Maps) ──► Opportunity Agent ──► Lead Analyst ──► Outreach Agent]
      │
      ▼
Deterministic Persistence Service (app/services/persistence_service.py)
      ├── Idempotent Multi-Key Deduplication (source_url, phone, normalized name)
      ├── Partial Research Failure Isolation (preserves valid outputs on sibling agent errors)
      ├── Evidence Classification Integrity (observed, inferred, unknown never corrupted)
      └── Telemetry & Agent Versioning (real token counts, execution time, model version)
      │
      ├──► Primary Cloud Storage: Supabase PostgreSQL (public.leads & public.research_runs)
      └──► Local Durable Mirror: SQLite (data/leadpulse_v2.db)
      │
      ▼
API Contract Layer (/api/v1/leads, /leads/{id}/report, /research-runs)
```

### Key Architectural Invariants Delivered:
1. **Durable Lifecycle Persistence**: Persists runs from `pending` -> `running` -> `completed` / `partial` / `failed` / `cancelled` with live counter updates (`queries_generated`, `businesses_found`, `businesses_filtered`, `businesses_triaged`, `businesses_researched`, `qualified_leads`, `total_tokens`).
2. **Deterministic Multi-Key Idempotency**: Pre-filtering and upsert logic deduplicates by canonical `source_url`, E.164 `phone_number`, and legal/clinic-stripped `business_name`. Re-running campaigns or retrying tools never creates duplicate business entities.
3. **Partial Research Preservation**: When a specialist (e.g., Ads Agent) times out or fails, successful outputs (e.g., Website & Maps) are durably saved with `research_status = "partial"`. Missing data is never converted into fabricated conclusions.
4. **Strict Evidence Classification Integrity**: Findings tagged as `observed`, `inferred`, or `unknown` retain their exact classification. Under no circumstances is `unknown` or `inferred` promoted to `observed` during database persistence.
5. **Outreach & Human Approval Persistence**: Outreach draft text, character/sentence metrics, validation error lists, and human approval status (`awaiting_human_approval`, `approved`, `rejected`) are durably stored. Approved messages remain staged for copying in Phase 9.
6. **Strict Non-Sending Boundary**: In accordance with the system specification, `external_send_executed` is guaranteed `False`. Zero automated WhatsApp calls or external dispatches occur.
7. **Dual-Storage Survivability**: Implements dual-tier storage with Supabase PostgreSQL as primary and a thread-safe SQLite database as a durable local mirror, guaranteeing that zero worker crashes or schema cache delays cause data loss.

---

## 2. Database Schema & Migrations

### 2.1 Supabase PostgreSQL Migration (`supabase/migrations/20260909_v2_research.sql`)
The migration safely extends `public.leads` without modifying or destroying any existing V1 records (preserving all 51+ existing records), and creates `public.research_runs`:

```sql
-- 1. Create research_runs table for tracking campaign run lifecycles
CREATE TABLE IF NOT EXISTS public.research_runs (
  run_id TEXT PRIMARY KEY,
  campaign_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, partial, failed, cancelled
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  queries_generated INTEGER DEFAULT 0,
  businesses_found INTEGER DEFAULT 0,
  businesses_filtered INTEGER DEFAULT 0,
  businesses_triaged INTEGER DEFAULT 0,
  businesses_researched INTEGER DEFAULT 0,
  qualified_leads INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  apify_calls INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  configuration JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast Indexing for research_runs
CREATE INDEX IF NOT EXISTS idx_research_runs_status ON public.research_runs(status);
CREATE INDEX IF NOT EXISTS idx_research_runs_campaign_id ON public.research_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_research_runs_created_at ON public.research_runs(created_at DESC);

-- 2. Extend public.leads with V2 Research & Intelligence Columns
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS research_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS research_priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS opportunity_score NUMERIC(5,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS recommended_service TEXT,
  ADD COLUMN IF NOT EXISTS primary_problem TEXT,
  ADD COLUMN IF NOT EXISTS why_this_service TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS research_sources JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specialist_results JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_analysis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outreach_draft JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS agent_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS model_name TEXT,
  ADD COLUMN IF NOT EXISTS token_usage JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS research_run_id TEXT;

-- Fast Indexing for public.leads V2 queries
CREATE INDEX IF NOT EXISTS idx_leads_research_status ON public.leads(research_status);
CREATE INDEX IF NOT EXISTS idx_leads_research_run_id ON public.leads(research_run_id);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_score ON public.leads(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON public.leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON public.leads(phone_number);
```

---

## 3. Idempotency & Deduplication Strategy

The persistence service implements deterministic multi-key deduplication based on Phase 4 normalizers:

1. **Primary Key Match**: If `id` is supplied and matches an existing record, the record is updated in-place.
2. **Canonical URL Match**: Lowercase, stripped `source_url`.
3. **E.164 Phone Number Match**: Standardized Indian (`+91...`) and international telephone numbers.
4. **Normalized Business Name Match**: Strips legal suffixes (`Pvt Ltd`, `LLP`, `Inc`, `Clinic`, `Dental`, `Hospital`, `Salon`, `Spa`, etc.) and leading `"the "`. E.g., `"Apex Dental Clinic Pvt Ltd"` and `"Apex Dental"` resolve to `"apex"`.
5. **Safe Merge Policy**:
   - Scalar attributes prefer incoming non-empty values.
   - List fields (`audit_friction_points`, `research_sources`) are merged with unique preservation.
   - Evidence lists are merged on unique `finding` keys, strictly preserving the original `classification`.
   - Nested agent results (`specialist_results`, `lead_analysis`, `outreach_draft`) are merged key-by-key.
   - `created_at` timestamp is preserved; `updated_at` is set to the current ISO timestamp.

---

## 4. Canonical Report Contract (`GET /api/v1/leads/{lead_id}/report`)

Designed specifically for the Phase 9 React/Next.js dashboard without requiring client-side reconstruction:

```json
{
  "lead": {
    "id": "uuid-v4-string",
    "business_name": "Apex Elite Smile Dental Clinic Pvt Ltd",
    "phone_number": "+919810123456",
    "website_url": "https://apexsmiledental.com",
    "instagram_url": null,
    "google_maps_url": "https://maps.google.com/?cid=1001",
    "address": "Greater Kailash 1, South Delhi, Delhi 110048",
    "rating": 4.9,
    "review_count": 210,
    "has_active_ads": true,
    "prospect_score": 9,
    "audit_friction_points": [
      "Paid Meta ads active but landing page has zero instant chat CTA",
      "No online appointment scheduling widget"
    ],
    "direct_contact_channel": "whatsapp"
  },
  "discovery": {
    "source_platform": "google_maps",
    "source_url": "https://maps.google.com/?cid=delhi_apex_dentistry_88",
    "author": null,
    "title": "Apex Elite Smile Dental Clinic Pvt Ltd",
    "body_text": ""
  },
  "specialists": {
    "website": {
      "status": "success",
      "agent_name": "website_specialist",
      "evidence": [...]
    },
    "ads": {
      "status": "success",
      "agent_name": "ads_specialist",
      "evidence": [...]
    },
    "maps": {
      "status": "success",
      "agent_name": "maps_specialist",
      "evidence": [...]
    }
  },
  "opportunity": {
    "opportunity_score": 91.5,
    "primary_problem": "Active Meta ad campaigns drive high-intent traffic to a site lacking instant WhatsApp intake",
    "recommended_service": "whatsapp_automation",
    "why_this_service": "Converts expensive ad clicks into instant booked consultations 24/7",
    "evidence": [...],
    "confidence": 0.92
  },
  "analysis": {
    "qualification_status": "qualified",
    "priority": "high",
    "opportunity_score": 91.5,
    "primary_problem": "Active Meta ad campaigns drive high-intent traffic to a site lacking instant WhatsApp intake",
    "recommended_service": "whatsapp_automation",
    "why_this_service": "Converts expensive ad clicks into instant booked consultations 24/7",
    "confidence": 0.92,
    "research_status": "complete",
    "limitations": []
  },
  "outreach": {
    "draft": {
      "message": "I saw your dental implant ads on Meta. Adding instant WhatsApp booking on your site could help capture high-intent inquiries before they bounce.",
      "service": "whatsapp_automation",
      "confidence": 0.9,
      "status": "draft",
      "character_count": 142,
      "sentence_count": 2
    },
    "outreach_status": "approved",
    "direct_contact_channel": "whatsapp",
    "external_send_executed": false
  },
  "metadata": {
    "research_status": "complete",
    "confidence_score": 0.92,
    "agent_version": "2.0.0",
    "prompt_version": "2.0.0",
    "model_name": "auto",
    "research_timestamp": "2026-09-10T00:05:29+00:00",
    "research_run_id": "run_fc47202385ed",
    "token_usage": {
      "prompt_tokens": 1450,
      "completion_tokens": 320,
      "total_tokens": 1770
    }
  }
}
```

---

## 5. API Layer Reference

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/leads` | Paginated lead listings with `status`, `research_status`, `research_run_id` filters. |
| `GET` | `/api/v1/leads/{lead_id}` | Detailed single lead intelligence record. |
| `GET` | `/api/v1/leads/{lead_id}/report` | Complete, structured business report ready for React components. |
| `GET` | `/api/v1/research-runs` | Paginated campaign runs with `status` and `campaign_id` filters. |
| `POST` | `/api/v1/research-runs` | Initialize a new campaign research run record. |
| `GET` | `/api/v1/research-runs/{run_id}` | Retrieve run status, metrics, and structured error logs. |

---

## 6. Security & Credential Invariants

- **Zero Credential Exposure**: `AI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APIFY_TOKEN` are protected via `pydantic.SecretStr` and redacted in logs, exceptions, and API serialization.
- **No Direct Agent Database Access**: Agents cannot execute arbitrary database commands. All persistence is managed strictly by deterministic backend application code.
- **No External Sending**: No WhatsApp, SMS, or third-party outreach execution is implemented or called.

---

## 7. Adversarial Audit Findings & Resilience Hardening

During adversarial review and end-to-end integration testing, several critical boundary conditions were identified and hardened:

1. **Deterministic UUID Mapping for PostgreSQL Compatibility**:
   - *Problem*: Custom string IDs (e.g., `phase7_live_lead_01` or client-generated IDs) passed to Supabase caused Postgres rejection (`22P02 invalid input syntax for type uuid`).
   - *Fix*: Implemented `to_valid_uuid(id_val)` utilizing RFC 4122 `uuid5(NAMESPACE_DNS, id_val)` for non-UUID strings during Supabase sync, ensuring zero sync failures while retaining exact client IDs in the local mirror and response contracts.

2. **Column Type Enforcement (`confidence_score` & `rating`)**:
   - *Problem*: Remote Supabase `leads.confidence_score` was typed as `integer`, rejecting Python floats (`0.85`), and `rating` exceeded bounds if non-clamped.
   - *Fix*: Added safe type normalization in `_sync_lead_to_supabase`: mapped float confidence to integer (0–10 scale), clamped rating within PostgreSQL `numeric(2,1)` bounds (0.0 to 9.9).

3. **Tolerant Schema Parsing for Specialist Failure Payloads**:
   - *Problem*: When specialist workers returned string error descriptions (e.g. `"Service temporarily unavailable: HTTP 503"`) or lists instead of dictionaries, `SpecialistReportSection` threw a Pydantic `ValidationError`, crashing `GET /api/v1/leads/{id}/report` with HTTP 500.
   - *Fix*: Added a Pydantic `field_validator` with `mode="before"` to coerce string/list errors into structured dictionaries (`{"status": "recorded", "details": ...}` or `{"items": ...}`).

4. **Preservation of Legitimate Falsy Scores (`0.0`)**:
   - *Problem*: `upsert_lead` used Python `or` chaining (`lead_data.get(...) or existing[...]`), which incorrectly treated explicit `0.0` opportunity scores as falsy and overwrote them with stale data.
   - *Fix*: Refactored to explicit `is not None` null-coalescing.

5. **Local Cache-Miss Fallback to Remote Supabase**:
   - *Problem*: If a lead was persisted directly in Supabase or existed prior to local mirror creation, `get_lead` returned 404.
   - *Fix*: Added automatic remote lookup fallback on local cache miss, hydrating the local mirror seamlessly.

6. **Multi-Key Deduplication Extension for `website_url`**:
   - *Problem*: Deduplication previously only checked `source_url`, `phone_number`, and normalized name, missing businesses discovered via different search queries with matching canonical website domains.
   - *Fix*: Added normalized `website_url` lookup into `_find_existing_lead`.

