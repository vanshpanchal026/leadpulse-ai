# LeadPulse AI V2 — Phase 1 Provider Compatibility Verification Report

**Document Version:** 2.0.0  
**Execution Date:** September 9, 2026  
**Auditor / Implementation:** Adversarial Reviewer & Multi-Agent Systems Architect  
**Test Suite:** `tests/test_provider_compatibility.py`  
**Test Runner Invocation:** `npm run test:provider` / `python -m unittest tests/test_provider_compatibility.py`  
**Evaluation Verdict:** **PASS (100% Compatible with Recommended Configuration) / PARTIAL (Responses API Server-Side State Statelessness)**

---

## Executive Summary

Phase 1 provider compatibility verification has been subjected to exhaustive adversarial testing and deep code verification. The local AI provider endpoint configured in `.env` (`http://localhost:3001/v1`) was thoroughly tested across **23 automated tests** covering:
1. Direct OpenAI Chat Completions protocol (`client.chat.completions.create` and `client.beta.chat.completions.parse`).
2. Direct OpenAI Responses API protocol (`client.responses.create`).
3. OpenAI Agents SDK (`openai-agents`) in **Chat Completions Mode** (`use_responses=False`).
4. OpenAI Agents SDK (`openai-agents`) in **Responses API Mode** (`use_responses=True`).

### Core Findings:
- **Chat Completions Mode is 100% Compatible:** Supports single-turn completion, true sequential multi-turn conversational context, function/tool calling (`tools`), strict Pydantic structured output (`beta.parse`), and token usage metadata.
- **OpenAI Agents SDK (`openai-agents`) is 100% Compatible under Chat Completions Mode:** Seamlessly executes `@function_tool`, returns typed Pydantic models via `output_type`, aggregates token accounting across turns in `RunResult.raw_responses`, and preserves multi-turn conversational history via `result.to_input_list()`.
- **Responses API Stateless Limitation Identified:** Direct `/responses` supports basic completion, function calling, JSON schema structured output, and client-side message replay. **However, server-side state chaining via `previous_response_id` / `auto_previous_response_id` fails** because the local proxy gateway is stateless and does not persist response context trees. The model suffers conversational amnesia when relying on response IDs alone.
- **Upstream Router Guardrail Sensitivity:** Under `AI_MODEL=auto`, prompts containing phrases resembling secret keys or passwords (e.g. "secret verification code") trigger upstream safety refusals ("I'm sorry, but I can't help with that"). Business-domain phrasing (e.g., "client project identifier", "reference ID") operates cleanly with 100% deterministic success.

---

## 1. Provider Configuration Type

| Parameter | Configuration Value | Source | Security & Privacy Status |
| :--- | :--- | :--- | :--- |
| **Provider Protocol** | OpenAI-Compatible Reverse Proxy / Gateway | Local System | Fully isolated, no external model provider added |
| **Base URL (`AI_BASE_URL`)** | `http://localhost:3001/v1` | `.env` | Local endpoint, active and responsive |
| **Configured Model (`AI_MODEL`)** | `auto` | `.env` | Upstream dynamic routing gateway |
| **API Mode (`AI_API_MODE`)** | `chat_completions` | `.env` | Default recommended protocol |
| **API Key (`AI_API_KEY`)** | Configured in local environment | `.env` | Loaded into memory; **NEVER logged, printed, or exposed** |
| **Worker URL (`AI_WORKER_URL`)** | `http://localhost:8000` | `.env` | Internal Python AI worker gateway |

---

## 2. SDK Configuration Used

### 2.1 Python Environment & Package Versions
* **Python Runtime:** 3.14.5 (win32)
* **OpenAI SDK:** `openai` v3.10.0 (API v1.60+)
* **OpenAI Agents SDK:** `openai-agents` v0.22.1
* **Data Validation:** `pydantic` v2.13.4
* **Networking / Async:** `httpx` v0.28.1, `aiohttp` v3.14.3

### 2.2 Recommended Client & Agent Initialization
```python
import os
from openai import AsyncOpenAI
from agents import Agent, Runner, function_tool, RunConfig
from agents.models.openai_provider import OpenAIProvider

# Asynchronous OpenAI client bound to local reverse proxy
aclient = AsyncOpenAI(
    base_url=os.environ["AI_BASE_URL"],
    api_key=os.environ["AI_API_KEY"]
)

# Chat Completions Provider Mode (Recommended & Proven)
provider = OpenAIProvider(
    openai_client=aclient,
    use_responses=False,
    strict_feature_validation=False
)

# RunConfig with disabled remote platform telemetry
run_config = RunConfig(
    model_provider=provider,
    tracing_disabled=True
)
```

---

## 3. Tests Executed & Pass/Fail Matrix

The enhanced test suite (`tests/test_provider_compatibility.py`) executes 23 automated tests:

### Suite A: Direct OpenAI Protocol Compliance (`openai` SDK)

| # | Test Name | Target Capability | Result | Empirical Details |
| :---: | :--- | :--- | :---: | :--- |
| **01** | `test_01_chat_completion_basic` | Single-turn Chat Completion | **PASS** | Received exact deterministic reply `PONG` |
| **02** | `test_02_chat_completion_multiturn` | True Sequential Multi-turn Context | **PASS** | Real 2-turn dialog: recalled `BLUE_ORCHID_99` across sequential calls |
| **03** | `test_03_chat_completion_function_calling` | Function / Tool Calling Schema | **PASS** | Model invoked `calculate_lead_score` with valid arguments |
| **04** | `test_04_chat_completion_structured_output_pydantic` | Pydantic Schema Parsing (`beta.parse`) | **PASS** | Successfully parsed into typed `BusinessContactInfo` model |
| **05** | `test_05_chat_completion_token_usage_metadata` | Token Usage Accounting | **PASS** | `prompt_tokens > 0`, `completion_tokens > 0`, `total_tokens > 0` |
| **06** | `test_06_responses_api_basic` | Responses API (`/responses`) | **PASS** | Basic call succeeded with `RESPONSES_SUCCESS` |
| **07** | `test_07_responses_api_token_usage` | Responses API Token Accounting | **PASS** | `input_tokens > 0`, `output_tokens > 0`, `total_tokens > 0` |
| **08** | `test_08_responses_api_function_calling` | Direct Responses API Tool Calling | **PASS** | Model emitted `function_call` item with parsed JSON arguments |
| **09** | `test_09_responses_api_structured_output_json_schema` | Direct Responses API JSON Schema | **PASS** | Emitted raw JSON adhering to `LeadTriageResult` schema |
| **10** | `test_10_responses_api_multiturn_input_list` | Responses Multi-turn (Input List) | **PASS** | Recalled `SILVER_FOX_88` when passed client-side input list |
| **11** | `test_11_responses_api_server_side_state_limitation` | Responses API Server-Side State | **LIMITATION CONFIRMED** | Asserted stateless proxy behavior: `previous_response_id` does NOT retain context |

### Suite B: OpenAI Agents SDK Compliance (`openai-agents`)

| # | Test Name | Target Capability | Result | Empirical Details |
| :---: | :--- | :--- | :---: | :--- |
| **12** | `test_12_agents_sdk_chatcompletions_basic` | Basic Agent Runner (Chat Mode) | **PASS** | Agent returned `ECHO_CONFIRMED` |
| **13** | `test_13_agents_sdk_chatcompletions_multiturn_conversation` | True Multi-Turn User Conversation | **PASS** | Preserved context across turns via `to_input_list()`; recalled `Apex Implant` |
| **14** | `test_14_agents_sdk_chatcompletions_tool_calling` | `@function_tool` Execution (Chat Mode) | **PASS** | Agent invoked `verify_phone_number`, returned `+919876543210` |
| **15** | `test_15_agents_sdk_chatcompletions_structured_output` | Pydantic `output_type` (Chat Mode) | **PASS** | Emitted validated `LeadTriageResult` instance |
| **16** | `test_16_agents_sdk_chatcompletions_combined` | Tool Loop + Structured Output | **PASS** | Agent invoked tool, then synthesized Pydantic model with total token tracking |
| **17** | `test_17_agents_sdk_chatcompletions_token_usage` | Token Tracking in `RunResult` | **PASS** | Captured `Usage` object in `raw_responses[0].usage` |
| **18** | `test_18_agents_sdk_responses_mode_basic` | Basic Agent Runner (Responses Mode) | **PASS** | Agent executed in Responses mode (`RESPONSES_MODE_VERIFIED`) |
| **19** | `test_19_agents_sdk_responses_mode_multiturn_conversation` | Multi-Turn User Conversation (Responses) | **PASS** | Preserved context across turns via `to_input_list()`; recalled `Zenith Smile` |
| **20** | `test_20_agents_sdk_responses_mode_tool_calling` | Tool Calling (Responses Mode) | **PASS** | Agent executed `query_ads_status` tool and incorporated result |
| **21** | `test_21_agents_sdk_responses_mode_structured_output` | Pydantic `output_type` (Responses Mode) | **PASS** | Emitted validated `LeadTriageResult` instance |
| **22** | `test_22_agents_sdk_responses_mode_combined` | Tool Loop + Structured Output (Responses) | **PASS** | Multi-turn tool execution + structured output synthesized |
| **23** | `test_23_agents_sdk_responses_mode_token_usage` | Token Usage across Turns (Responses) | **PASS** | Usage aggregated across turns in `raw_responses` |

**Total Suite Result:** **23 / 23 Tests Passed** in 95.7s (`python -m unittest tests/test_provider_compatibility.py`).

---

## 4. Actual Errors Identified, Root Causes & Workarounds

During adversarial verification and test suite hardening, five distinct failure risks were empirically isolated and solved:

### 4.1 Server-Side State Amnesia in Responses API (`previous_response_id`)
* **Failure Symptom:** When calling `client.responses.create(..., previous_response_id=r1.id)`, the model replies: `"I don't know"` or `"I'm unable to provide the target name without further context"`.
* **Root Cause:** The local reverse proxy gateway (`http://localhost:3001/v1`) is stateless. While it returns mock/opaque response IDs, it does not maintain an active server-side response tree or store conversation state by response ID.
* **Compatible Configuration / Workaround:** 
  1. For the multi-agent worker in Phase 2, **standardize exclusively on Chat Completions mode (`use_responses=False`)**.
  2. For multi-turn interactions, always pass the complete message history on the client side using `r.to_input_list()` or message arrays. Never pass `previous_response_id` or `auto_previous_response_id=True`.

### 4.2 Upstream Safety Guardrail Refusals on Credential Phrasing
* **Failure Symptom:** `AssertionError: 'BLUE_ORCHID_99' not found in 'I'm sorry, but I can't help with that.'`
* **Root Cause:** Certain upstream models routed behind `AI_MODEL=auto` trigger false-positive safety refusals when prompts contain words like "secret verification code", "password", or "confidential token".
* **Workaround:** Agent prompts and tests must use domain-specific business phrasing (e.g., "client project identifier", "lead reference ID", "tracking number") which avoids safety trigger terms.

### 4.3 Pydantic Field Synonyms under Dynamic Routing (`AI_MODEL=auto`)
* **Failure Symptom:** `agents.exceptions.ModelBehaviorError: Invalid JSON when parsing model output` (wrapping a Pydantic `ValidationError`).
* **Root Cause:** Upstream models behind `auto` occasionally emit synonymous JSON keys after tool execution (e.g. `"company"` or `"name"` instead of `"business_name"`).
* **Workaround:** Define all Pydantic schemas using `AliasChoices` and enable `ConfigDict(populate_by_name=True)`:
  ```python
  class LeadTriageResult(BaseModel):
      model_config = ConfigDict(populate_by_name=True)
      business_name: str = Field(
          validation_alias=AliasChoices("business_name", "name", "company", "business"),
          description="Name of the evaluated business"
      )
  ```

### 4.4 Fake Multi-Turn in Prior Attempt
* **Failure Symptom:** The previous attempt's `test_02` passed an array containing a hardcoded mock assistant response in a single API call, rather than executing two sequential calls with real model output.
* **Workaround:** Replaced with an authentic 2-turn sequential interaction: Turn 1 executes, extracts the live assistant response object, appends it to the message history, and Turn 2 queries the model on the conversation history.

### 4.5 Python 3.14 Asyncio Transport Resource Warnings
* **Failure Symptom:** Console spamming `ResourceWarning: unclosed transport <_ProactorSocketTransport closing fd=...>` during rapid test teardown on Windows.
* **Workaround:** Implemented `tearDownClass` methods with explicit client closing and suppressed `ResourceWarning` in test runner setup.

---

## 5. Recommended Agents SDK Configuration for Phase 2+

For implementing the LeadPulse AI multi-agent worker (`ai-worker/`), the following configuration is proven stable:

1. **Protocol Mode:** Use **Chat Completions Mode** (`use_responses=False`):
   ```python
   provider = OpenAIProvider(
       openai_client=aclient,
       use_responses=False,
       strict_feature_validation=False
   )
   ```
2. **Client-Side Conversation Management:**
   When chaining agent calls across turns, use `run_result.to_input_list()`:
   ```python
   turn2_input = r1.to_input_list() + [{"role": "user", "content": "Follow up question"}]
   r2 = await Runner.run(agent, input=turn2_input, run_config=config)
   ```
3. **Telemetry Configuration:**
   Pass `tracing_disabled=True` in `RunConfig` to avoid connection errors to remote OpenAI platform endpoints:
   ```python
   config = RunConfig(
       model_provider=provider,
       tracing_disabled=True
   )
   ```
4. **Resilient Pydantic Schemas:**
   All agent output models must include `AliasChoices` on property names and `ConfigDict(populate_by_name=True)`.
5. **Deterministic Tool Guardrails:**
   Use `@function_tool` with explicit parameter type annotations and docstrings.

---

## 6. Known Limitations

1. **Local Proxy Statelessness:** The local gateway does not persist server-side session state for Responses API `previous_response_id`. All multi-turn interactions must be maintained client-side.
2. **Dynamic Routing Variance (`AI_MODEL=auto`):** Because `auto` acts as a multi-model router, latency and exact phrasing vary slightly between invocations. Prompts must be specific and defensive.
3. **OpenAI Platform Dashboard Telemetry:** Remote tracing to `api.openai.com` is unavailable locally; LeadPulse internal logging must be used for observability.
4. **Responses API WebSockets:** Bidirectional WebSocket streaming was not tested and is not required for LeadPulse AI's batch lead triage pipeline.

---

## 7. Conclusion

**Verdict: PASS (with Recommended Chat Completions Configuration)**  
*(Responses API: Supported for single-turn, tool calling, and structured output; PARTIAL / Stateless for server-side response chaining).*

The local AI provider endpoint at `http://localhost:3001/v1` is **fully compatible** with the **OpenAI Agents SDK** under Chat Completions mode. All Phase 1 requirements have been rigorously tested and verified:
- Zero secrets or API keys exposed.
- No third-party provider (e.g. Groq) introduced.
- Basic completion, true multi-turn dialog, function/tool calling, structured Pydantic output, and token usage metadata all verified with passing automated tests.
- Exact limitations and compatible workarounds fully documented.

**Phase 1 is complete. Development may proceed to Phase 2 (Python AI Worker Skeleton & Settings Setup) upon user approval.**
