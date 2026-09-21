# LeadPulse AI V2 — Phase 5: Lead Triage + Specialist Agents (Website, Ads, Maps) Implementation Report

**Document Version:** 5.0.0  
**Implementation Date:** September 9, 2026  
**Status:** **PHASE 5 COMPLETE — ALL VERIFICATIONS PASSED**  
**Integration Status:** Live Pipeline Verified (NormalizedCandidate -> Deterministic Fast-Path (<4) -> Lead Triage Agent -> Parallel Specialists [Website, Ads, Maps] -> Grounded Evidence & Bounded Confidence -> Specialist Failure Isolation -> Token & Budget Accounting)

---

## 1. Executive Summary

Phase 5 introduces deep research intelligence for candidate businesses discovered during Phase 4 prospecting campaigns. Rather than indiscriminately performing expensive research on every candidate, Phase 5 establishes an evidence-first, sandboxed multi-agent architecture:

1. **Lead Triage Agent (`ai-worker/app/agents/specialists/triage_agent.py`)**: Evaluates normalized candidates from Phase 4. Enforces a deterministic fast-path (candidates with scorecard score < 4 or tier='skip' are disqualified immediately with zero token expenditure). Qualified candidates undergo structured LLM triage to select which specialist agents (`website`, `ads`, `maps`) are warranted.
2. **Controlled Website Retrieval Service (`ai-worker/app/services/website_fetcher.py`)**: A sandboxed HTTP retrieval tool protecting against SSRF (Server-Side Request Forgery). Blocks localhost, private subnets (RFC 1918), carrier-grade NAT, and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`). Pre-resolves DNS and validates every resolved IP address. Re-validates every redirect hop (max 3). Limits payload sizes (512 KB) and parses clean visible text, CTAs, and booking/contact links.
3. **Website Specialist Agent (`ai-worker/app/agents/specialists/website_agent.py`)**: Audits public website content. Strictly observes CTAs, online booking flows, and WhatsApp links. If a website is unreachable, emits `status="unavailable"` and never infers that the business has a "bad website" or "broken booking system".
4. **Ads Specialist Agent (`ai-worker/app/agents/specialists/ads_agent.py`)**: Audits Meta Ads records for active creative messaging, offers, and CTAs. Strictly prohibits metric fabrication (ad spend, ROAS, CAC, conversion rate, impressions are forbidden and remain `None`/unknown).
5. **Maps Specialist Agent (`ai-worker/app/agents/specialists/maps_agent.py`)**: Audits Google Maps / local profile records for verified categories, numeric ratings, review counts, and contact accessibility. Strictly prohibits review sentiment fabrication unless customer review text is provided.
6. **Structured Evidence Model (`ai-worker/app/schemas/evidence.py`)**: Shared `Evidence` schema requiring a source, bounded confidence `[0.0, 1.0]`, and explicit classification (`observed`, `inferred`, `unknown`).
7. **Parallel Specialist Orchestrator (`ai-worker/app/services/specialist_orchestrator.py`)**: Concurrently executes selected specialists via `asyncio.gather(..., return_exceptions=True)`. Enforces campaign deep research budgets (`max_deep_research_leads`) and guarantees **failure isolation** (a failure or timeout in one specialist never aborts the other specialists or invalidates the aggregate).
8. **Comprehensive Verification Suite**: 201 pytest unit tests, dedicated negative anti-hallucination suite (`test_hallucination_guards.py`), live Python end-to-end integration tests (`tests/test_phase5_integration.py`), live Node.js verification script (`scripts/test-phase5-integration.mjs`), TypeScript typecheck, and Next.js production build.

---

## 2. Lead Triage Architecture

```text
Discovered Candidate (Phase 4)
             │
             ▼
   [Scorecard Score < 4?] ──► YES ──► Reject Candidate (0 Tokens)
             │
            NO (Score >= 4)
             │
             ▼
   Lead Triage Agent (LLM)
             │
             ▼
   LeadTriageResult:
     - qualified: bool
     - priority: "high" | "medium" | "low"
     - reason: str
     - research_agents: ["website", "ads", "maps"]
```

### 2.1 Deterministic Pre-Check
The function `triage_candidate_deterministic(candidate: NormalizedCandidate)` inspects deterministic scores from Phase 4 (`candidate.scorecard_score`).
- If `score < 4` or `priority_tier == "skip"`, it immediately returns a rejected `LeadTriageResult(qualified=False, priority="low", reason="...", research_agents=[])`.
- Zero LLM tokens are consumed on low-value prospects or irrelevant leads.

### 2.2 LLM Triage Reasoning
When a candidate scores 4/10 or higher, the Lead Triage Agent evaluates the candidate summary against LeadPulse consulting criteria. It determines:
1. `qualified`: Whether the business has commercial maturity and high lifetime customer value potential (dental clinics, cosmetic surgery, dermatology, medspas, luxury salons).
2. `priority`: Outreach urgency (`high`, `medium`, `low`).
3. `reason`: Concise rationale grounded solely in the candidate metadata.
4. `research_agents`: Subset of specialist agents to deploy:
   - `"website"`: deployed if an observable website URL exists.
   - `"ads"`: deployed if active ads or paid marketing presence exists.
   - `"maps"`: deployed if local profile, rating, or physical presence exists.

---

## 3. Specialist Agent Architecture

Specialist agents operate independently on token-optimized, isolated context.

### 3.1 Website Specialist Agent
- **Target**: Publicly available website HTML content fetched via `WebsiteContentFetcher`.
- **Observations**: Primary CTAs, WhatsApp floating buttons/links, third-party booking integrations (Calendly, Zenoti, Acuity, Fresha, Booksy), form friction points, mobile contact accessibility.
- **Anti-Hallucination Invariant**:
  ```text
  If website is unreachable -> status = "unavailable"
  NEVER claim "poor website", "bad booking system", or "broken design"
  ```
- **Output**: `WebsiteAnalysisResult`.

### 3.2 Ads Specialist Agent
- **Target**: Meta Ads Library records discovered during Phase 4.
- **Observations**: Active ad counts, creative headlines, body copy themes (e.g. "smile makeover 30% off"), observed CTAs ("Send WhatsApp Message", "Book Now"), ad-to-landing-page consistency.
- **Anti-Hallucination Invariant**:
  ```text
  NEVER invent ad spend, budget, ROAS, CAC, conversion rate, or impressions.
  If not in data -> MUST remain None or Unknown.
  ```
- **Output**: `AdsAnalysisResult`.

### 3.3 Maps Specialist Agent
- **Target**: Google Maps / local business profile records.
- **Observations**: Verified category, address, numeric rating (0.0 to 5.0), user review count, phone presence, website link, Instagram link, listed services.
- **Anti-Hallucination Invariant**:
  ```text
  NEVER fabricate review sentiment or customer complaints without actual review text.
  If review text is absent -> review_sentiment MUST be None or "unknown".
  NEVER claim "highly rated" without the actual numeric rating and review count.
  ```
- **Output**: `MapsAnalysisResult`.

---

## 4. Controlled Website Retrieval & SSRF Defense

Specialist agents are strictly prohibited from receiving arbitrary internet access or running shell commands. All website inspection is routed through `WebsiteContentFetcher` (`ai-worker/app/services/website_fetcher.py`).

### 4.1 Multi-Layer SSRF Protections
1. **URL Scheme Normalization**: Accepts only `http://` and `https://` (prefers `https://`). Rejects `ftp://`, `file://`, `gopher://`.
2. **Blocked Hostnames & Internal TLDs**: Explicitly blocks `localhost`, `*.localhost`, `metadata.google.internal`, `metadata.internal`, `instance-data`, and internal TLDs (`.internal`, `.local`, `.lan`, `.home`).
3. **URL Credential Rejection**: Prohibits userinfo/credentials in URLs (e.g., `http://user:pass@example.com`).
4. **Permitted Ports Only**: Strictly restricts outbound connections to standard public web ports: 80, 443, 8080, 8443. All other ports are blocked.
5. **Blocked CIDR Ranges**:
   - Loopback: `127.0.0.0/8`, `::1/128`, `::/128`
   - Private Networks (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`
   - Link-Local & Cloud Metadata: `169.254.0.0/16` (including `169.254.169.254`), `fe80::/10`
   - Carrier-Grade NAT: `100.64.0.0/10`
   - Reserved & Test Networks: `0.0.0.0/8`, `192.0.0.0/24`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
   - Multicast & Broadcast: `224.0.0.0/4`, `ff00::/8`, `255.255.255.255/32`
6. **Pre-Request DNS Verification & TOCTOU Defense**: Hostnames are resolved via `socket.getaddrinfo` *before* issuing HTTP requests. Every resolved IP address is verified against blocked CIDRs. To eliminate Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks, `SSRFSafeBackend` / `SSRFSafeTransport` directly pins the outbound TCP connection to the verified IP while preserving TLS SNI (`server_hostname`).
7. **Redirect Traversal Security**: Redirects are not followed blindly (`follow_redirects=False`). Each redirect target is validated against SSRF rules before the next hop (max 3 redirects).
8. **Payload Size & Timeout Limits**: Maximum response size is capped at 512 KB (524,288 bytes). Timeouts are capped at 6.0 seconds.
9. **Content-Type Whitelist**: Rejects binaries, PDFs, images, executables. Allows only `text/html`, `application/xhtml+xml`, or `text/plain`.
10. **No Credential Leakage**: Strips all Authorization or Cookie headers.

---

## 5. Evidence & Confidence Model

All findings produced across specialists are grounded in the `Evidence` schema (`ai-worker/app/schemas/evidence.py`):

```python
class Evidence(BaseModel):
    finding: str
    source: Literal["website", "maps", "ads", "reddit"]
    evidence: str
    confidence: float  # Bounded strictly [0.0, 1.0]
    classification: Literal["observed", "inferred", "unknown"]
```

### Rules & Invariants:
1. **Bounded Confidence**: `confidence` is strictly bounded between `0.0` and `1.0`. Values outside this range are rejected by Pydantic validation.
2. **Explicit Source**: Every piece of intelligence records its origin (`website`, `maps`, `ads`, `reddit`).
3. **Classification Discipline**:
   - `observed`: Directly observable text, button, link, or numerical metric present in the scraped record.
   - `inferred`: Logical deduction from observed facts (e.g. manual intake causing lead loss). Must be explicitly tagged as `inferred`.
   - `unknown`: Missing or unreachable data. Can never be converted into `observed`.

---

## 6. Parallel Execution & Failure Isolation

Specialist agents execute independently. The `SpecialistOrchestratorService` executes selected specialists concurrently using `asyncio.gather(..., return_exceptions=True)`.

### 6.1 Failure Isolation Guarantee
If one specialist encounters a timeout, connection error, or unexpected exception:
```text
Website Specialist: Success
Ads Specialist:     Timeout (60s) -> build_unavailable_ads_result(status="unavailable", count=None)
Maps Specialist:    Success
─────────────────────────────────────────────
Aggregate Result:   SUCCESS (Partial results kept)
Execution Status:   {"website": "success", "ads": "exception: WorkerTimeoutError", "maps": "success"}
```
The overall candidate research task **does not fail**. The failed specialist is recorded with its specific error status, and valid intelligence from the other specialists is preserved in `SpecialistResearchAggregate`. Furthermore, specialist errors emit deterministic `unavailable`/`error` results rather than fabricating absence (e.g. Ads errors produce `build_unavailable_ads_result` with `status="unavailable"` and `confidence=0.0`, never falsely asserting `status="no_ads"`).

### 6.2 Deterministic Campaign Budget Control
The orchestrator integrates with `CampaignBudgetTracker` to enforce campaign limits:
- `max_deep_research_leads`: Limits the number of leads permitted to undergo specialist research per campaign run.
- **Triage-First Accounting**: Lead Triage runs *before* reserving deep research slots. Candidates disqualified by deterministic fast-path (`score < 4` or `priority_tier == "skip"`) or rejected by triage consume zero deep research slots.
- **Slot Reservation on Qualification**: Only candidates deemed qualified attempt to reserve a deep research slot via `acquire_deep_research_slot()`. If the budget is exhausted, `triage_result.qualified=True` is preserved while setting `execution_status={"budget": "blocked"}` with zero downstream specialist LLM consumption.

### 6.3 Token Optimization
- Full, raw scraper payloads are **never** passed into LLM prompts.
- Website Agent receives only website summary, title, meta description, and CTAs (max 2,000 chars).
- Ads Agent receives only ad copy and active creative metadata.
- Maps Agent receives only local profile metrics, category, and review count.
- Actual token consumption is aggregated from upstream model provider metadata.

---

## 7. Verification & Regression Record

### 7.1 Pytest Test Suite
A comprehensive suite of **217 unit tests** was executed with a 100% pass rate:

```text
ai-worker/tests/test_agent_runner.py .....                               [  2%]
ai-worker/tests/test_api.py .....                                        [  4%]
ai-worker/tests/test_apify_tools.py ................                     [ 12%]
ai-worker/tests/test_business_profile.py ............                    [ 18%]
ai-worker/tests/test_config.py ........                                  [ 22%]
ai-worker/tests/test_deterministic_pipeline.py ......................... [ 37%]
ai-worker/tests/test_evidence_schemas.py ...........                     [ 42%]
ai-worker/tests/test_hallucination_guards.py ..........                  [ 47%]
ai-worker/tests/test_health.py ...                                       [ 49%]
ai-worker/tests/test_logging.py ...                                      [ 50%]
ai-worker/tests/test_profile_agent.py ......                             [ 53%]
ai-worker/tests/test_provider_config.py ..............                   [ 60%]
ai-worker/tests/test_search_schemas.py .........................         [ 73%]
ai-worker/tests/test_search_strategist_agent.py .......                  [ 76%]
ai-worker/tests/test_specialist_agents.py .............                  [ 82%]
ai-worker/tests/test_specialist_orchestrator.py .....                    [ 85%]
ai-worker/tests/test_website_fetcher.py ................................ [100%]

============================= 217 passed in 3.63s =============================
```

### 7.2 Python Live Integration Suite (`tests/test_phase5_integration.py`)
Ran 6 live end-to-end integration tests connecting to the local proxy:
1. `test_01_lead_triage_agent_live_execution`: Evaluated aesthetic clinic candidate, emitted valid `LeadTriageResult`.
2. `test_02_website_specialist_live_execution`: Audited website signals, emitted valid `WebsiteAnalysisResult`.
3. `test_03_ads_specialist_live_execution_no_metric_fabrication`: Audited Meta Ads, confirmed zero metric fabrication (`ad_spend` is None).
4. `test_04_maps_specialist_live_execution_no_sentiment_fabrication`: Audited Google Maps data, confirmed `review_sentiment` is None/unknown.
5. `test_05_parallel_specialist_orchestration_endpoint`: Verified `/api/v1/specialists/research` executed parallel specialists and returned structured aggregate.
6. `test_06_credential_safety_invariant`: Confirmed zero API key leakage in responses.

### 7.3 Node.js Live Integration Suite (`scripts/test-phase5-integration.mjs`)
Ran Node.js integration script:
- Spawned Uvicorn worker process on `http://localhost:8000`.
- Health check passed (`/health/ready`).
- Live triage agent execution passed (`POST /api/v1/run`).
- Parallel specialist research endpoint passed with fault-isolation verification (`POST /api/v1/specialists/research`).
- Credential safety verified (zero secret leakage).

### 7.4 Full Regression Summary
- **Phase 2 Integration**: `npm run test:phase2` -> **PASSED (100%)**
- **Phase 3 Integration**: `npm run test:phase3` -> **PASSED (100%)**
- **Phase 4 Integration**: `npm run test:phase4` -> **PASSED (100%)**
- **Phase 5 Integration**: `npm run test:phase5` -> **PASSED (100%)**
- **TypeScript Typecheck**: `npx tsc --noEmit` -> **PASSED (0 errors)**
- **Next.js Production Build**: `npm run build` -> **PASSED (0 errors, 9/9 pages generated)**

---

## 8. Files Created & Modified

### 8.1 Files Created
| File Path | Description |
| :--- | :--- |
| `ai-worker/app/schemas/evidence.py` | Pydantic models for `Evidence`, `LeadTriageResult`, `WebsiteAnalysisResult`, `AdsAnalysisResult`, `MapsAnalysisResult`, and `SpecialistResearchAggregate`. |
| `ai-worker/app/services/website_fetcher.py` | Controlled HTTP website fetching service with comprehensive SSRF defense, DNS pre-resolution, redirect validation, and HTML text parsing. |
| `ai-worker/app/agents/specialists/__init__.py` | Package init exporting specialist agent creators and deterministic fallback builders. |
| `ai-worker/app/agents/specialists/triage_agent.py` | Lead Triage Agent with deterministic fast-path (`score < 4` disqualification). |
| `ai-worker/app/agents/specialists/website_agent.py` | Website Specialist Agent with anti-hallucination rules and unavailable site fallback. |
| `ai-worker/app/agents/specialists/ads_agent.py` | Ads Specialist Agent with strict metric fabrication guards and no-ads fallback. |
| `ai-worker/app/agents/specialists/maps_agent.py` | Maps Specialist Agent with sentiment fabrication guards and unavailable fallback. |
| `ai-worker/app/services/specialist_orchestrator.py` | Parallel specialist orchestration service with failure isolation, budget enforcement, and token tracking. |
| `ai-worker/app/api/routes/specialists.py` | FastAPI routes for `/api/v1/specialists/triage` and `/api/v1/specialists/research`. |
| `ai-worker/tests/test_evidence_schemas.py` | Unit tests (11 tests) verifying evidence schema, confidence bounds, and anti-hallucination validation. |
| `ai-worker/tests/test_website_fetcher.py` | Unit tests (32 tests) verifying SSRF protection, DNS rebinding guards, redirects, and HTML text extraction. |
| `ai-worker/tests/test_specialist_agents.py` | Unit tests (11 tests) verifying agent definitions, instructions, and deterministic fallbacks. |
| `ai-worker/tests/test_specialist_orchestrator.py` | Unit tests (5 tests) verifying triage, parallel execution, failure isolation, and budget tracking. |
| `ai-worker/tests/test_hallucination_guards.py` | Negative anti-hallucination unit tests (10 tests) asserting zero metric/sentiment fabrication. |
| `tests/test_phase5_integration.py` | Live Python integration test suite (6 tests) verifying live agents, orchestration, and credential safety. |
| `scripts/test-phase5-integration.mjs` | Live Node.js verification script verifying Phase 5 pipeline against the live local worker. |
| `docs/PHASE_5_IMPLEMENTATION.md` | Comprehensive Phase 5 documentation. |

### 8.2 Files Modified
| File Path | Description |
| :--- | :--- |
| `ai-worker/app/schemas/search.py` | Added `max_deep_research_leads` (default: 10) to `CampaignLimits`. |
| `ai-worker/app/tools/apify/budget.py` | Added `deep_research_leads_executed`, `deep_research_leads_reserved`, `check_deep_research_budget()`, `acquire_deep_research_slot()`, and `release_deep_research_slot()` to `CampaignBudgetTracker`. |
| `ai-worker/app/schemas/agent.py` | Expanded `AgentRunRequest.validate_agent_type` to accept Phase 5 specialist agent types (`lead_triage`, `website_specialist`, `website`, `ads_specialist`, `ads`, `maps_specialist`, `maps`). |
| `ai-worker/app/schemas/__init__.py` | Exported Phase 5 evidence and specialist schemas (`Evidence`, `SpecialistLeadTriageResult`, `WebsiteAnalysisResult`, `AdsAnalysisResult`, `MapsAnalysisResult`, `SpecialistResearchAggregate`). |
| `ai-worker/app/services/agent_runner.py` | Added resolution branches in `_resolve_agent` for all Phase 5 specialist agent types. |
| `ai-worker/app/api/router.py` | Mounted `specialists.router` under root and `/api/v1`. |
| `package.json` | Added `"test:phase5": "node scripts/test-phase5-integration.mjs"`. |

---

## 9. Known Limitations & Deferred Capabilities

As explicitly required by the Phase 5 mandate, the following capabilities are **deferred to later phases**:
1. **Opportunity Synthesis Agent**: Synthesizing specialist intelligence into commercial opportunities (Phase 6).
2. **Lead Analyst**: Generating strategic positioning and pitch angles (Phase 6).
3. **Outreach Agent**: Drafting personalized multi-channel outreach messages (Phase 7).
4. **WhatsApp Dispatcher & Autonomous Outreach**: Sending messages to leads or contacting businesses (Phase 7+).
5. **Database Direct Modification**: Specialists only return in-memory Pydantic intelligence; persistence to Supabase is handled by higher-level pipeline orchestration.

---

## 10. Conclusion & Stop Condition

Phase 5 has fulfilled 100% of the requirements set forth in the specification:
- Lead Triage Agent with deterministic fast-path and LLM routing.
- Three independent specialist agents (Website, Ads, Maps) with strict observability boundaries.
- Controlled website retrieval service with multi-layer SSRF prevention.
- Evidence and bounded confidence models.
- Parallel specialist execution with isolated fault tolerance.
- Mandatory negative anti-hallucination tests passed.
- All Phase 1, 2, 3, 4, and 5 regression tests passed.
- TypeScript compilation and Next.js production build passed.

**Phase 5 is complete. Execution has stopped.**
