# LeadPulse AI V2 — Phase 9 Architecture Audit

**Document Version:** 9.0.0  
**Date:** September 10, 2026  
**Status:** COMPLETE & APPROVED FOR PHASE 9.1 EXECUTION  
**Scope:** LeadPulse AI V2 Dashboard & Campaign Control Center Architectural Audit & Integration Blueprint

---

## 1. Current Frontend Architecture

The existing user interface is built on:
- **Framework:** Next.js 15.5.25 App Router with React 19 (`react: ^19.0.0`, `react-dom: ^19.0.0`).
- **Language:** TypeScript 5.7 in strict mode (`tsconfig.json`).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss: ^4.0.0`, `tailwindcss: ^4.0.0`), utilizing CSS variables in `app/globals.css`.
- **Icons:** `lucide-react` (v1.16.0).
- **Core View:** A monolithic client component in `app/page.tsx` (1,495 lines) that consolidates:
  - Header with branding, global search, KPI summaries, and view toggles.
  - 4-stage funnel strip & metric badges.
  - Multi-platform lead feed (Reddit, Google Maps, Meta Ads, Instagram).
  - Lead Inspector Drawer showing commercial maturity, friction points, notes, and direct contact buttons.
  - Scraper launcher modal (`components/ScraperModal.tsx`).
  - Outreach Approval Queue (`components/OutreachApprovalQueue.tsx`, 784 lines).

---

## 2. Current Next.js Role

Next.js currently serves two distinct roles:
1. **Frontend Presentation Layer:** Server/Client React rendering for the V1 prospecting feed.
2. **Backend-For-Frontend (BFF) HTTP API Gateway:** An active Node.js API runtime (`app/api/`) that provides:
   - `/api/leads`: Local JSON and Supabase data parsing (`lib/lead-parser.ts`).
   - `/api/scraper/trigger`: Reddit scraping via Apify + Gemini 2.5 Flash qualification.
   - `/api/scraper/google-maps`: Google Places Apify crawler execution.
   - `/api/scraper/meta-ads`: Facebook Ads Library crawler execution.
   - `/api/scraper/run`: Multi-source scrape orchestrator.
   - `/api/outreach`: Proxy endpoint connecting to the Python AI Worker's `/api/v1/outreach` endpoints.
   - `/api/outreach/[...path]`: Dynamic catch-all proxy forwarding human approval, rejection, and editing to the Python AI Worker.

---

## 3. Existing API Surface

### 3.1 Next.js BFF Layer (Port 3000)
| Endpoint | Method | Purpose | Backend Integration |
|---|---|---|---|
| `/api/leads` | GET | List parsed leads with funnel counts | Local JSON + Supabase |
| `/api/scraper/trigger` | POST | Reddit Apify crawl + qualification | Apify + Gemini |
| `/api/scraper/google-maps` | POST | Google Maps Places crawler | Apify |
| `/api/scraper/meta-ads` | POST | Meta Ads scraper | Apify |
| `/api/scraper/run` | POST | Orchestrates multi-channel crawl | Apify |
| `/api/outreach` | GET | List outreach drafts | Python Worker (`GET /api/v1/outreach`) |
| `/api/outreach` | POST | Draft outreach message | Python Worker (`POST /api/v1/outreach/draft`) |
| `/api/outreach/:lead_id/approve` | POST | Human approval of draft | Python Worker (`POST /api/v1/outreach/:id/approve`) |
| `/api/outreach/:lead_id/reject` | POST | Human rejection of draft | Python Worker (`POST /api/v1/outreach/:id/reject`) |
| `/api/outreach/:lead_id/edit` | POST | Deterministic edit & validate | Python Worker (`POST /api/v1/outreach/:id/edit`) |
| `/api/outreach/:lead_id/regenerate`| POST | Re-draft with validator guidance | Python Worker (`POST /api/v1/outreach/:id/regenerate`) |

### 3.2 Python AI Worker (FastAPI on Port 8000)
| Endpoint | Method | Purpose |
|---|---|---|
| `/health`, `/health/ready`, `/api/v1/health` | GET | Worker readiness and provider health |
| `/api/v1/run`, `/run`, `/api/v1/agent/run` | POST | Agent runner interface |
| `/api/v1/specialists/triage` | POST | Fast-path & specialist triage |
| `/api/v1/specialists/research` | POST | Parallel Website, Ads, Maps execution |
| `/api/v1/opportunities/analyze` | POST | Opportunity Agent + Scorer |
| `/api/v1/leads` | GET | Paginated lead list with multi-column filtering |
| `/api/v1/leads/{id}` | GET | Single lead record |
| `/api/v1/leads/{id}/report` | GET | Canonical Phase 9 Lead Intelligence Report contract |
| `/api/v1/research-runs` | POST | Initialize a campaign research run |
| `/api/v1/research-runs` | GET | List historical research runs with token/tool telemetry |
| `/api/v1/research-runs/{run_id}` | GET | Real-time campaign run progress and metrics |

---

## 4. Existing Reusable Components

The following UI components are production-tested and available for reuse or adaptation:
1. `components/OutreachApprovalQueue.tsx`: Complete Phase 7 human approval state machine UI with strict non-sending warning, copy-to-clipboard, feedback badges, and editing drawer.
2. `components/ScraperModal.tsx`: Scraper configuration modal supporting keywords, subreddits, and Google Maps queries.
3. `components/LeadCard.tsx`: Prospect card layout with tags, friction badges, rating/reviews, and contact links.
4. `components/FilterBar.tsx`: Filter bar with search inputs, score buttons, and platform pills.
5. `components/Header.tsx`: Platform branding, environment badges, and quick stats.
6. `components/KpiMetrics.tsx`: KPI cards for high priority, reply rate, and sent pitches.
7. `components/LeadDetailDrawer.tsx`: Slide-over inspector panel.
8. `components/LeadTableView.tsx`: Tabular view of lead prospects.

---

## 5. Existing V1 Dashboard Functionality

The following V1 capabilities are fully functional and must be preserved:
- Lead feed discovery & search across 67+ real records.
- Deterministic 10-point scorecard evaluation (8–10 Immediate, 6–7 High Potential, 4–5 Medium, 0–3 Skip).
- Deep cross-linking: direct Google Maps links, official website URLs, Instagram handles.
- Manual WhatsApp action (`https://wa.me/<phone>?text=...`) with **ZERO automated sending**.
- Lead lifecycle status updates (`new`, `pitch_sent`, `replied`, `meeting_booked`, `archived`).
- In-memory and Supabase-synced lead notes.
- Scraper modal with real-time log polling.

---

## 6. Supabase Integration Points

- **Client Configuration:** `lib/supabase.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Database Tables (Verified in Phase 8.1):**
  - `public.leads`: Contains 67+ records with 27 V1 columns + 19 V2 multi-agent columns (`research_status`, `opportunity_score`, `recommended_service`, `evidence`, `outreach_draft`, etc.).
  - `public.research_runs`: Tracks campaign run lifecycles, progress counters, token counts, and tool calls.
- **Dual-Storage Resilience:** Local SQLite mirror (`data/leadpulse_v2.db`) operates as an immediate offline-first fallback, ensuring that UI components never hang if Supabase is temporarily unreachable.

---

## 7. Python Worker Integration Points

- `lib/ai-worker-client.ts`: TypeScript client with `checkWorkerReadiness()`, timeout guards, and typed request wrappers.
- Next.js API route proxies (`app/api/outreach/*`) connecting to `http://127.0.0.1:8000`.
- Canonical Phase 9 Lead Intelligence Report contract:
  ```typescript
  interface LeadReportResponse {
    lead_id: string;
    business_name: string;
    location: string;
    opportunity_summary: {
      opportunity_score: number;
      confidence: number;
      recommended_service: string;
      primary_problem: string;
      why_this_service: string;
    };
    evidence: EvidenceItem[];
    specialists: {
      website?: WebsiteSpecialistResult;
      ads?: AdsSpecialistResult;
      maps?: MapsSpecialistResult;
    };
    lead_analysis?: LeadAnalysis;
    outreach: OutreachSection;
    metadata: ResearchMetadata;
  }
  ```

---

## 8. Recommended React/Vite Integration Architecture

To safely satisfy the non-negotiable architecture without breaking the Next.js API / BFF layer:

```text
┌─────────────────────────────────────────────────────────┐
│              LeadPulse V2 Frontend (client/)            │
│                                                         │
│  React 19 + TypeScript + Vite                           │
│  Tailwind CSS + shadcn/ui Design System                 │
│  TanStack Query (Server State & Polling)                │
│  TanStack Table (Multi-Axis Lead Grid)                  │
│  ECharts (Analytics & Funnel Visualization)             │
│  Zod (Strict API Boundary Validation)                   │
│  React Router (Desktop-First SaaS Navigation)           │
│  Sonner (Restrained Action Notifications)               │
└────────────────────────────┬────────────────────────────┘
                             │
                             │ HTTP (Vite Proxy: /api -> :3000, /api/v1 -> :8000)
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Next.js 15 API / BFF Gateway (:3000)          │
│                                                         │
│  /api/leads                 /api/scraper/*              │
│  /api/outreach              /api/outreach/[...path]     │
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   Python AI Worker (:8000)          Supabase PostgreSQL
   (OpenAI Agents SDK)               (leads + research_runs)
```

### Directory Organization:
- `client/`: Dedicated Vite application root.
  - `client/index.html`: Vite HTML entry point.
  - `client/vite.config.ts`: Vite config with React plugin, `@client` and `@` path aliases, and dev server proxy:
    - `/api/v1` $\to$ `http://127.0.0.1:8000` (Python AI Worker)
    - `/api` $\to$ `http://127.0.0.1:3000` (Next.js BFF Layer)
  - `client/tsconfig.json`: Isolated TypeScript config with `"jsx": "react-jsx"`.
  - `client/src/`:
    - `client/src/main.tsx`: React mounting entrypoint.
    - `client/src/App.tsx`: Top-level providers (`QueryClientProvider`, `Toaster`, Design System shell).
    - `client/src/styles/globals.css`: Tailwind design tokens, typography, slate/zinc SaaS palette.
    - `client/src/lib/utils.ts`: `cn()` class merging utility.
    - `client/src/components/ui/`: shadcn/ui primitives (`Button`, `Badge`, `Card`, `Sonner`).
- Root `package.json`:
  - Contains locked dependencies: `@tanstack/react-query`, `@tanstack/react-table`, `echarts`, `echarts-for-react`, `xlsx`, `zod`, `react-router-dom`, `date-fns`, `sonner`, `clsx`, `tailwind-merge`, `class-variance-authority`.
  - Retains all Next.js scripts (`dev`, `build`, `start`, `lint`, and all test runners).
  - Adds `"client:dev"` and `"client:build"` scripts.

This architecture ensures:
1. **Next.js production build (`npx next build`) never breaks.**
2. **Next.js API layer remains the active BFF.**
3. **Vite frontend builds independently and cleanly.**
4. **Zero regressions to existing V1 functionality.**

---

## 9. Migration Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| JSX Compiler Collision | Next.js uses `"jsx": "preserve"`; Vite requires `"jsx": "react-jsx"` | Isolated `client/tsconfig.json` for Vite; root `tsconfig.json` excludes `client/` |
| Port Collisions | Vite (5173), Next.js (3000), AI Worker (8000) | Vite `server.proxy` explicitly maps `/api` to 3000 and `/api/v1` to 8000 |
| Automated Messaging Regression | Critical violation if outreach auto-dispatches | UI strictly preserves `external_send_executed = false`; WhatsApp action remains manual `wa.me` |
| Schema Desynchronization | Differences between V1 leads and V2 intelligence | Zod schemas at API boundary with fallback defaults |

---

## 10. Files Created in Phase 9.1

1. `docs/PHASE_9_ARCHITECTURE_AUDIT.md` (This document)
2. `client/index.html` (Vite HTML shell)
3. `client/vite.config.ts` (Vite build and proxy configuration)
4. `client/tsconfig.json` (Vite TypeScript configuration)
5. `client/src/main.tsx` (React 19 Vite mounting)
6. `client/src/App.tsx` (Root app with QueryClient, Toaster, and design system shell)
7. `client/src/styles/globals.css` (Tailwind design tokens, CSS variables, dark/light theme)
8. `client/src/lib/utils.ts` (Tailwind merge `cn` utility)
9. `client/src/components/ui/button.tsx` (shadcn Button primitive with CVA variants)
10. `client/src/components/ui/badge.tsx` (shadcn Badge primitive with status/evidence variants)
11. `client/src/components/ui/card.tsx` (shadcn Card primitive)
12. `client/src/components/ui/sonner.tsx` (Sonner toast container)
13. `scripts/test-phase9-1.mjs` (Phase 9.1 automated verification script)

---

## 11. Files Modified in Phase 9.1

1. `package.json` (Added locked dependencies and client npm scripts)
2. `tsconfig.json` (Added `client` to exclusions so Next.js build is not impacted by Vite JSX)

---

## 12. Files That Must NOT Be Deleted

- `app/api/**` (All Next.js API routes)
- `app/page.tsx` (Existing V1 dashboard)
- `components/OutreachApprovalQueue.tsx` (Phase 7 human approval component)
- `components/ScraperModal.tsx` (V1 scraper modal)
- `lib/**` (`supabase.ts`, `scorecard.ts`, `lead-parser.ts`, `ai-worker-client.ts`)
- `ai-worker/**` (All Python AI worker code and test suites)
- `supabase/**` (All migrations and configuration)
- `tests/**` (All integration test suites)
- `scripts/**` (All regression test scripts)

---

## 13. Dependency Changes

The following dependencies are added to `package.json`:
- **Vite & Tooling:** `vite` (`^6.2.0`), `@vitejs/plugin-react` (`^4.3.4`)
- **Data & Tables:** `@tanstack/react-query` (`^5.66.11`), `@tanstack/react-table` (`^8.21.2`)
- **Charts & Export:** `echarts` (`^5.6.0`), `echarts-for-react` (`^3.0.2`), `xlsx` (`^0.18.5`)
- **Validation & Routing:** `zod` (`^3.24.2`), `react-router-dom` (`^7.2.0`)
- **UI Primitives & Helpers:** `clsx` (`^2.1.1`), `tailwind-merge` (`^3.0.2`), `class-variance-authority` (`^0.7.1`), `date-fns` (`^4.1.0`), `sonner` (`^2.0.1`), `@radix-ui/react-slot` (`^1.1.2`)

---

## 14. Testing Strategy

1. **Vite Build Verification:** Execute `npx vite build --config client/vite.config.ts client` to confirm error-free bundling.
2. **Next.js Build Verification:** Execute `npx next build` to confirm zero regressions in existing Next.js App Router and API routes.
3. **TypeScript Verification:** Execute `npx tsc --noEmit` to confirm complete type safety.
4. **Python Regression:** Run `pytest ai-worker/tests/ tests/test_phase8_integration.py` (all 440 tests must pass).
5. **Node.js Integration Regression:** Run `scripts/test-phase8-integration.mjs` (all 8 tests must pass).
6. **Phase 9.1 Verification:** Execute `scripts/test-phase9-1.mjs` to verify Vite assets, design system tokens, and proxy setup.
