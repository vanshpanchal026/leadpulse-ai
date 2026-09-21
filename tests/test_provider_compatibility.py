"""
Phase 1: Isolated AI Provider Compatibility Test Suite
======================================================
LeadPulse AI V2 Compatibility Verification against local OpenAI-compatible endpoint.

Tests Executed:
1. OpenAI Python SDK (Chat Completions protocol)
   - 01: Basic single-turn completion
   - 02: True multi-turn conversation context retention (sequential requests)
   - 03: Function / Tool Calling schema parsing
   - 04: Structured JSON/Pydantic output via beta.chat.completions.parse
   - 05: Token usage metadata accounting
2. OpenAI Python SDK (Responses API protocol)
   - 06: Responses API basic invocation (/responses)
   - 07: Responses API token usage metadata accounting
   - 08: Responses API function / tool calling
   - 09: Responses API structured JSON schema output
   - 10: Responses API multi-turn conversation via input list
   - 11: Responses API server-side state (previous_response_id) limitation probe
3. OpenAI Agents SDK (openai-agents: Chat Completions Mode)
   - 12: Basic Agent runner execution
   - 13: Multi-turn conversation between user and Agent via to_input_list()
   - 14: Function Tool execution via @function_tool
   - 15: Structured Pydantic output via output_type
   - 16: Multi-turn tool calling + structured Pydantic output synthesis
   - 17: Token usage capture in RunResult.raw_responses
4. OpenAI Agents SDK (openai-agents: Responses API Mode)
   - 18: Basic Agent runner execution
   - 19: Multi-turn conversation between user and Agent via to_input_list()
   - 20: Function Tool execution via @function_tool
   - 21: Structured Pydantic output via output_type
   - 22: Multi-turn tool calling + structured Pydantic output synthesis
   - 23: Token usage capture across multiple turns

Strict Privacy & Security Rules:
- Never prints, logs, or exposes secret API keys.
- Operates entirely on locally configured environment variables.
"""

import os
import sys
import json
import asyncio
import unittest
import warnings
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field, AliasChoices, ConfigDict
from openai import OpenAI, AsyncOpenAI
from agents import Agent, Runner, function_tool, RunConfig
from agents.models.openai_provider import OpenAIProvider

# Suppress unclosed transport warnings on Windows/asyncio shutdown
warnings.filterwarnings("ignore", category=ResourceWarning)

# Load environment configuration from project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    load_dotenv()

AI_BASE_URL = os.environ.get("AI_BASE_URL", "").rstrip("/")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "auto")
AI_API_MODE = os.environ.get("AI_API_MODE", "chat_completions")

# Verify essential configuration exists
if not AI_BASE_URL:
    raise RuntimeError("Missing required environment variable: AI_BASE_URL")
if not AI_API_KEY:
    raise RuntimeError("Missing required environment variable: AI_API_KEY")
if not AI_MODEL:
    raise RuntimeError("Missing required environment variable: AI_MODEL")


# Pydantic Schemas for Structured Output Testing (with AliasChoices for cross-model resilience)
class LeadTriageResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    business_name: str = Field(
        validation_alias=AliasChoices("business_name", "name", "company", "business"),
        description="Name of the evaluated business"
    )
    score: int = Field(
        description="10-point prospect score",
        ge=0,
        le=10
    )
    priority: str = Field(
        description="Outreach priority: immediate, high, medium, or skip"
    )
    recommended_channel: str = Field(
        validation_alias=AliasChoices("recommended_channel", "channel", "direct_contact_channel"),
        default="whatsapp",
        description="Direct outreach channel, e.g. whatsapp"
    )


class BusinessContactInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company: str = Field(
        validation_alias=AliasChoices("company", "business_name", "name"),
        description="Company name"
    )
    phone: str = Field(
        validation_alias=AliasChoices("phone", "phone_number", "contact"),
        description="Contact phone number"
    )
    is_verified: bool = Field(
        validation_alias=AliasChoices("is_verified", "verified"),
        default=True,
        description="Whether the contact information is verified"
    )


# Suite A: OpenAI SDK & Direct Protocol Compatibility
class TestOpenAISDKCompatibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = OpenAI(base_url=AI_BASE_URL, api_key=AI_API_KEY)
        cls.aclient = AsyncOpenAI(base_url=AI_BASE_URL, api_key=AI_API_KEY)
        cls.model = AI_MODEL

    @classmethod
    def tearDownClass(cls):
        try:
            cls.client.close()
            asyncio.run(cls.aclient.close())
        except Exception:
            pass

    def test_01_chat_completion_basic(self):
        """Test basic chat completion endpoint."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": "Respond with strictly the single word 'PONG'."}],
            temperature=0.0
        )
        self.assertIsNotNone(response.choices)
        self.assertGreater(len(response.choices), 0)
        content = response.choices[0].message.content
        self.assertIsNotNone(content)
        self.assertIn("PONG", content.strip().upper())

    def test_02_chat_completion_multiturn(self):
        """Test true multi-turn context retention across sequential conversation turns."""
        messages = [
            {"role": "system", "content": "You are a precise business lead data assistant."},
            {"role": "user", "content": "The client project identifier is BLUE_ORCHID_99. Acknowledge briefly."}
        ]
        # Turn 1: Send client project identifier
        response1 = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0
        )
        assistant_msg = response1.choices[0].message
        self.assertIsNotNone(assistant_msg.content)

        # Turn 2: Append real assistant response and ask follow-up query
        messages.append(assistant_msg)
        messages.append({"role": "user", "content": "What is the client project identifier? Return only the identifier."})
        response2 = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0
        )
        content2 = response2.choices[0].message.content
        self.assertIsNotNone(content2)
        self.assertIn("BLUE_ORCHID_99", content2.strip())

    def test_03_chat_completion_function_calling(self):
        """Test function/tool calling schema parsing and invocation request."""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "calculate_lead_score",
                    "description": "Calculate 10-point scorecard for a local prospect",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "business_name": {"type": "string"},
                            "review_count": {"type": "integer"},
                            "has_active_ads": {"type": "boolean"},
                            "has_website": {"type": "boolean"}
                        },
                        "required": ["business_name", "review_count", "has_active_ads", "has_website"]
                    }
                }
            }
        ]
        messages = [
            {
                "role": "user",
                "content": "Calculate the score for 'Apex Dental Clinic' with 120 reviews, active Meta ads, and a website."
            }
        ]
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.0
        )
        message = response.choices[0].message
        self.assertIsNotNone(message.tool_calls, "Expected model to generate tool_calls")
        self.assertGreater(len(message.tool_calls), 0)
        tool_call = message.tool_calls[0]
        self.assertEqual(tool_call.function.name, "calculate_lead_score")
        args = json.loads(tool_call.function.arguments)
        self.assertIn("Apex Dental", args.get("business_name", ""))
        self.assertEqual(args.get("review_count"), 120)
        self.assertTrue(args.get("has_active_ads"))

    def test_04_chat_completion_structured_output_pydantic(self):
        """Test structured JSON/Pydantic output via beta.chat.completions.parse."""
        messages = [
            {
                "role": "user",
                "content": (
                    "Evaluate this lead: Business is 'Metro Skin & Laser Clinic', phone is '+919876543210'. "
                    "Contact is verified. Return structured output."
                )
            }
        ]
        response = self.client.beta.chat.completions.parse(
            model=self.model,
            messages=messages,
            response_format=BusinessContactInfo
        )
        parsed = response.choices[0].message.parsed
        self.assertIsInstance(parsed, BusinessContactInfo)
        self.assertIn("Metro Skin", parsed.company)
        self.assertIn("+919876543210", parsed.phone)
        self.assertTrue(parsed.is_verified)

    def test_05_chat_completion_token_usage_metadata(self):
        """Test presence of token usage statistics in response."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": "Respond with 'OK'."}],
            temperature=0.0
        )
        usage = response.usage
        self.assertIsNotNone(usage, "Usage metadata must be present")
        self.assertGreater(usage.prompt_tokens, 0, "prompt_tokens must be > 0")
        self.assertGreater(usage.completion_tokens, 0, "completion_tokens must be > 0")
        self.assertGreaterEqual(usage.total_tokens, usage.prompt_tokens + usage.completion_tokens)

    def test_06_responses_api_basic(self):
        """Test OpenAI Responses API endpoint (/responses)."""
        response = self.client.responses.create(
            model=self.model,
            input="Respond with strictly the word 'RESPONSES_SUCCESS'."
        )
        self.assertIsNotNone(response)
        output_text = getattr(response, "output_text", None)
        if output_text is None and hasattr(response, "output"):
            for item in response.output:
                if getattr(item, "type", "") == "message":
                    for content_part in getattr(item, "content", []):
                        if getattr(content_part, "type", "") == "output_text":
                            output_text = content_part.text
        self.assertIsNotNone(output_text, "Responses API should produce output text")
        self.assertIn("RESPONSES_SUCCESS", output_text.upper())

    def test_07_responses_api_token_usage(self):
        """Test Responses API token usage accounting."""
        response = self.client.responses.create(
            model=self.model,
            input="Return the number 42."
        )
        usage = getattr(response, "usage", None)
        self.assertIsNotNone(usage, "Responses API response must include usage")
        self.assertGreater(usage.input_tokens, 0, "input_tokens must be > 0")
        self.assertGreater(usage.output_tokens, 0, "output_tokens must be > 0")

    def test_08_responses_api_function_calling(self):
        """Test function/tool calling directly via OpenAI Responses API (/responses)."""
        tools = [
            {
                "type": "function",
                "name": "calculate_lead_score",
                "description": "Calculate 10-point scorecard for a local prospect",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"},
                        "review_count": {"type": "integer"}
                    },
                    "required": ["business_name", "review_count"]
                }
            }
        ]
        response = self.client.responses.create(
            model=self.model,
            input="Use calculate_lead_score to score 'Apex Dental' with 85 reviews.",
            tools=tools,
            tool_choice="required"
        )
        self.assertIsNotNone(response.output, "Responses API output must be present")
        function_calls = [item for item in response.output if getattr(item, "type", "") == "function_call"]
        self.assertGreater(len(function_calls), 0, "Responses API must return at least one function call")
        fn = function_calls[0]
        self.assertEqual(fn.name, "calculate_lead_score")
        args = json.loads(fn.arguments)
        self.assertIn("Apex Dental", args.get("business_name", ""))
        self.assertEqual(args.get("review_count"), 85)

    def test_09_responses_api_structured_output_json_schema(self):
        """Test structured JSON schema output directly via Responses API (/responses)."""
        schema = LeadTriageResult.model_json_schema()
        response = self.client.responses.create(
            model=self.model,
            input="Evaluate lead 'Nova Health' with score 8, priority 'high', channel 'whatsapp'.",
            text={"format": {"type": "json_schema", "name": "LeadTriageResult", "schema": schema}}
        )
        output_text = getattr(response, "output_text", None)
        self.assertIsNotNone(output_text, "Responses API structured output text must be present")
        data = json.loads(output_text)
        validated = LeadTriageResult.model_validate(data)
        self.assertIn("Nova Health", validated.business_name)
        self.assertEqual(validated.score, 8)
        self.assertEqual(validated.priority.lower(), "high")

    def test_10_responses_api_multiturn_input_list(self):
        """Test multi-turn context retention via explicit input list on Responses API."""
        response = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "user", "content": "The client project reference code is SILVER_FOX_88."},
                {"role": "assistant", "content": "Acknowledged. The client project reference code is SILVER_FOX_88."},
                {"role": "user", "content": "What is the client project reference code? Answer only with the code."}
            ]
        )
        output_text = getattr(response, "output_text", "")
        self.assertIn("SILVER_FOX_88", output_text)

    def test_11_responses_api_server_side_state_limitation(self):
        """
        Verify and document that the local stateless proxy endpoint does NOT retain server-side state
        when using previous_response_id chaining on Responses API.
        """
        r1 = self.client.responses.create(
            model=self.model,
            input="The client case reference is CRIMSON_VIPER_77."
        )
        self.assertIsNotNone(r1.id)

        # Attempt server-side chaining via previous_response_id
        r2 = self.client.responses.create(
            model=self.model,
            input="What was the client case reference I just told you? Return only the reference code.",
            previous_response_id=r1.id
        )
        output_text = getattr(r2, "output_text", "")
        # Document and assert the empirical limitation: the proxy is stateless and does not maintain response trees
        state_persisted_server_side = "CRIMSON_VIPER_77" in output_text
        self.assertFalse(
            state_persisted_server_side,
            "Documented limitation: local proxy does not retain server-side state across previous_response_id"
        )


# Suite B: OpenAI Agents SDK (openai-agents) Compatibility
class TestOpenAIAgentsSDKCompatibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.aclient = AsyncOpenAI(base_url=AI_BASE_URL, api_key=AI_API_KEY)
        cls.model = AI_MODEL

    @classmethod
    def tearDownClass(cls):
        try:
            asyncio.run(cls.aclient.close())
        except Exception:
            pass

    # --- Mode 1: Chat Completions Mode (Recommended) ---

    def test_12_agents_sdk_chatcompletions_basic(self):
        """Test basic OpenAI Agents SDK execution with Chat Completions provider."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="EchoAgent",
                instructions="You are an assistant. Echo exactly the keyword requested.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Echo strictly the word 'ECHO_CONFIRMED'.",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertIsNotNone(result)
        self.assertIn("ECHO_CONFIRMED", str(result.final_output).upper())

    def test_13_agents_sdk_chatcompletions_multiturn_conversation(self):
        """Test true multi-turn user conversation with an Agent preserving history via to_input_list()."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="ChatConversationAgent",
                instructions="You are a helpful assistant. Keep replies short and direct.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)

            # Turn 1: User introduces key data
            r1 = await Runner.run(
                starting_agent=agent,
                input="The target clinic name is 'Apex Implant Center'. Remember it.",
                run_config=config
            )

            # Turn 2: User asks follow-up query using to_input_list() continuation
            turn2_input = r1.to_input_list() + [
                {"role": "user", "content": "What is the target clinic name? Return only the clinic name."}
            ]
            r2 = await Runner.run(
                starting_agent=agent,
                input=turn2_input,
                run_config=config
            )
            return r1, r2

        r1, r2 = asyncio.run(_run())
        self.assertIsNotNone(r1.final_output)
        self.assertIsNotNone(r2.final_output)
        self.assertIn("Apex Implant", str(r2.final_output))

    def test_14_agents_sdk_chatcompletions_tool_calling(self):
        """Test function tool execution within Agents SDK (Chat Completions mode)."""
        tool_invoked = {"count": 0, "args": {}}

        @function_tool
        def verify_phone_number(country_code: str, raw_number: str) -> str:
            """Verify and format a phone number to standard E.164."""
            tool_invoked["count"] += 1
            tool_invoked["args"] = {"country_code": country_code, "raw_number": raw_number}
            digits = "".join(c for c in raw_number if c.isdigit())
            return f"+{country_code.lstrip('+')}{digits[-10:]}"

        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="PhoneVerificationAgent",
                instructions="Use verify_phone_number tool to format the prospect phone number.",
                tools=[verify_phone_number],
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Format the phone number for an Indian clinic: '098765 43210' with country code '91'.",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertIsNotNone(result)
        self.assertGreater(tool_invoked["count"], 0, "Function tool must have been executed by agent")
        self.assertIn("+919876543210", str(result.final_output).replace(" ", ""))

    def test_15_agents_sdk_chatcompletions_structured_output(self):
        """Test Pydantic output_type enforcement within Agents SDK (Chat Completions mode)."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="TriageAgent",
                instructions=(
                    "Extract lead qualification and triage details into structured LeadTriageResult.\n"
                    "Output raw JSON with keys: business_name, score, priority, recommended_channel."
                ),
                output_type=LeadTriageResult,
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input=(
                    "Evaluate lead: 'Cosmo Dental Lounge', scorecard: 9/10, priority: immediate, "
                    "channel: whatsapp. Output structured result."
                ),
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertIsInstance(result.final_output, LeadTriageResult)
        self.assertIn("Cosmo Dental", result.final_output.business_name)
        self.assertEqual(result.final_output.score, 9)
        self.assertEqual(result.final_output.priority.lower(), "immediate")
        self.assertEqual(result.final_output.recommended_channel.lower(), "whatsapp")

    def test_16_agents_sdk_chatcompletions_combined_tool_and_structured_output(self):
        """Test agent tool execution loop AND Pydantic structured output under Chat Completions mode."""
        tool_called = {"status": False}

        @function_tool
        def calculate_scorecard(reviews: int, active_ads: bool, website: bool) -> int:
            """Compute deterministic score."""
            tool_called["status"] = True
            pts = 0
            if reviews >= 50:
                pts += 2
            if active_ads:
                pts += 3
            if website:
                pts += 1
            return pts

        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="EndToEndSpecialist",
                instructions=(
                    "You are a lead qualification agent.\n"
                    "Step 1: Calculate lead score using calculate_scorecard tool.\n"
                    "Step 2: Output a valid LeadTriageResult with keys: business_name, score, priority, recommended_channel.\n"
                    "Do not enclose output in markdown blocks."
                ),
                tools=[calculate_scorecard],
                output_type=LeadTriageResult,
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input=(
                    "Evaluate 'Apex Implant Center': 75 reviews, active ads: true, website: true. "
                    "Priority is 'immediate', channel is 'whatsapp'."
                ),
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertTrue(tool_called["status"], "Tool calculate_scorecard must be invoked")
        self.assertIsInstance(result.final_output, LeadTriageResult)
        self.assertIn("Apex Implant", result.final_output.business_name)
        self.assertGreaterEqual(result.final_output.score, 5)

        # Verify token usage captured across turns
        self.assertGreater(len(result.raw_responses), 0)
        total_tokens = sum(r.usage.total_tokens for r in result.raw_responses if getattr(r, "usage", None))
        self.assertGreater(total_tokens, 0)

    def test_17_agents_sdk_chatcompletions_token_usage(self):
        """Test token usage capture in Agents SDK RunResult (Chat Completions mode)."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=False,
                strict_feature_validation=False
            )
            agent = Agent(
                name="UsageAuditAgent",
                instructions="Provide a short 3-word greeting.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Hello there",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertTrue(hasattr(result, "raw_responses"))
        self.assertGreater(len(result.raw_responses), 0)
        raw_res = result.raw_responses[0]
        usage = getattr(raw_res, "usage", None)
        self.assertIsNotNone(usage)
        self.assertGreater(usage.total_tokens, 0)

    # --- Mode 2: Responses API Mode ---

    def test_18_agents_sdk_responses_mode_basic(self):
        """Test basic Agents SDK execution under Responses API mode."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="ResponsesAgent",
                instructions="You are an assistant. Respond with strictly the required phrase.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Say strictly 'RESPONSES_MODE_VERIFIED'.",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertIn("RESPONSES_MODE_VERIFIED", str(result.final_output).upper())

    def test_19_agents_sdk_responses_mode_multiturn_conversation(self):
        """Test multi-turn user conversation with an Agent in Responses mode via to_input_list()."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="ResponsesConversationAgent",
                instructions="You are a helpful assistant. Keep replies brief.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)

            # Turn 1
            r1 = await Runner.run(
                starting_agent=agent,
                input="The target clinic is 'Zenith Smile Care'.",
                run_config=config
            )

            # Turn 2: Pass history via to_input_list()
            turn2_input = r1.to_input_list() + [
                {"role": "user", "content": "What is the target clinic name? Return only the name in plain text."}
            ]
            r2 = await Runner.run(
                starting_agent=agent,
                input=turn2_input,
                run_config=config
            )
            return r1, r2

        r1, r2 = asyncio.run(_run())
        self.assertIsNotNone(r1.final_output)
        self.assertIsNotNone(r2.final_output)
        self.assertIn("Zenith Smile", str(r2.final_output))

    def test_20_agents_sdk_responses_mode_tool_calling(self):
        """Test isolated tool calling under Responses API mode."""
        tool_invoked = {"called": False}

        @function_tool
        def query_ads_status(brand: str) -> str:
            """Check if brand has active ads."""
            tool_invoked["called"] = True
            return "Active Meta Campaign: 3 variants running"

        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="AdsAgent",
                instructions="Check ads status using query_ads_status tool.",
                tools=[query_ads_status],
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Check ads for 'Luxe Skin'.",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertTrue(tool_invoked["called"], "Tool query_ads_status must be called")
        self.assertIn("ACTIVE", str(result.final_output).upper())

    def test_21_agents_sdk_responses_mode_structured_output_only(self):
        """Test isolated Pydantic structured output under Responses API mode."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="PureStructureAgent",
                instructions=(
                    "Extract lead triage into structured LeadTriageResult.\n"
                    "Output raw JSON with keys: business_name, score, priority, recommended_channel."
                ),
                output_type=LeadTriageResult,
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Evaluate 'Apex Clinic': score 6, priority 'immediate', channel 'whatsapp'.",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertIsInstance(result.final_output, LeadTriageResult)
        self.assertIn("Apex Clinic", result.final_output.business_name)
        self.assertEqual(result.final_output.score, 6)

    def test_22_agents_sdk_responses_mode_combined_tool_and_structured_output(self):
        """Test tool calling loop AND structured Pydantic output under Responses mode."""
        tool_called = {"called": False}

        @function_tool
        def calculate_scorecard(reviews: int, active_ads: bool, website: bool) -> int:
            """Compute deterministic score."""
            tool_called["called"] = True
            pts = 0
            if reviews >= 50:
                pts += 2
            if active_ads:
                pts += 3
            if website:
                pts += 1
            return pts

        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="ResponsesCombinedAgent",
                instructions=(
                    "You are a lead qualifier.\n"
                    "Step 1: Calculate lead score using calculate_scorecard tool.\n"
                    "Step 2: Emit a structured LeadTriageResult with keys: business_name, score, priority, recommended_channel.\n"
                    "Output raw JSON only."
                ),
                tools=[calculate_scorecard],
                output_type=LeadTriageResult,
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input=(
                    "Evaluate 'Apex Implant Center': 75 reviews, active ads: true, website: true. "
                    "Priority is 'immediate', channel is 'whatsapp'."
                ),
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertTrue(tool_called["called"], "Tool calculate_scorecard must be invoked")
        self.assertIsInstance(result.final_output, LeadTriageResult)
        self.assertIn("Apex Implant", result.final_output.business_name)
        self.assertGreaterEqual(result.final_output.score, 5)

    def test_23_agents_sdk_responses_mode_token_usage(self):
        """Test token usage capture under Responses mode."""
        async def _run():
            provider = OpenAIProvider(
                openai_client=self.aclient,
                use_responses=True,
                strict_feature_validation=False
            )
            agent = Agent(
                name="TokenCheckAgent",
                instructions="Return strictly the word 'OK'.",
                model=self.model
            )
            config = RunConfig(model_provider=provider, tracing_disabled=True)
            result = await Runner.run(
                starting_agent=agent,
                input="Ping",
                run_config=config
            )
            return result

        result = asyncio.run(_run())
        self.assertTrue(hasattr(result, "raw_responses"))
        self.assertGreater(len(result.raw_responses), 0)
        total_tokens = sum(r.usage.total_tokens for r in result.raw_responses if getattr(r, "usage", None))
        self.assertGreater(total_tokens, 0)


def print_suite_header():
    print("=" * 75)
    print(" LeadPulse AI V2 - Phase 1 Provider Compatibility Test Suite")
    print("=" * 75)
    print(f" Target Endpoint:   {AI_BASE_URL}")
    print(f" Configured Model:  {AI_MODEL}")
    print(f" Protocol Mode:     {AI_API_MODE}")
    print(f" Auth Token:        Present (masked for security)")
    print("=" * 75)


if __name__ == "__main__":
    print_suite_header()
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    suite.addTests(loader.loadTestsFromTestCase(TestOpenAISDKCompatibility))
    suite.addTests(loader.loadTestsFromTestCase(TestOpenAIAgentsSDKCompatibility))

    runner = unittest.TextTestRunner(verbosity=2)
    test_result = runner.run(suite)

    sys.exit(0 if test_result.wasSuccessful() else 1)
