"""Configurable Business Profile Pydantic Schemas for LeadPulse AI.

Defines the business identity, consultant persona, technical capabilities,
services offered, target customer profile (ICP), business characteristics,
geographies, seed verticals, qualification preferences, exclusions, and
outreach constraints.

All models are frozen and immutable to prevent accidental runtime state drift.
"""

from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BusinessIdentity(BaseModel):
    """Core identity of the LeadPulse consulting practice."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str = Field(default="LeadPulse", description="Business or platform brand name")
    consultant_name: str = Field(default="Vansh Panchal", description="Lead consultant and owner name")
    title: str = Field(
        default="Solo Developer & Automation Consultant",
        description="Professional title"
    )
    experience_level: str = Field(
        default="~1 year of practical coding experience",
        description="Honest practical development experience"
    )
    implementation_tools: list[str] = Field(
        default_factory=lambda: ["Antigravity", "Claude Code", "Cursor", "Gemini CLI"],
        description="AI coding agents used for fast production implementation"
    )
    portfolio_status: str = Field(
        default="Solo freelance developer; no existing client portfolio yet; working toward first real paying client. Not an agency.",
        description="Client portfolio reality"
    )
    bio: str = Field(
        default=(
            "Solo freelance developer based in India with ~1 year of practical coding experience. "
            "Builds fast using AI coding agents (Antigravity, Claude Code, Cursor, Gemini CLI). "
            "Not an agency — working toward the first real paying client. Helps established local service businesses "
            "capture missed customer inquiries, automate qualification, and convert them into calendar bookings 24/7."
        ),
        description="Concise professional biography"
    )

    @field_validator("name", "consultant_name", "title")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Identity fields cannot be empty")
        return v.strip()


class AgentPersona(BaseModel):
    """Consultant persona guidelines for agent interactions and tone."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    role: str = Field(
        default="Solo local technology and automation consultant",
        description="Perspective and role adopted during research and communication"
    )
    perspective: str = Field(
        default="Solo technical consultant typing directly from a laptop or phone, acting as an expert peer",
        description="Operational communication perspective"
    )
    voice_tone: str = Field(
        default="Direct, casual, concise, helpful, pragmatic, non-salesy, peer-to-peer",
        description="Voice and tone guidelines"
    )
    core_value_proposition: str = Field(
        default=(
            "Capturing missed customer inquiries, 24/7 after-hours WhatsApp lead capture, "
            "frictionless calendar booking, and operational workflow automation."
        ),
        description="Core value proposition communicated to prospects"
    )
    client_facing_framing: str = Field(
        default=(
            "Never describe this as 'AI chatbot' or 'automation' in anything client-facing. "
            "Reframe entirely around outcomes: capturing missed customer inquiries and converting more of them into "
            "bookings/leads, primarily via WhatsApp, working 24/7 including after hours. The technical implementation "
            "(WhatsApp Business API + n8n + LLM + calendar integration) stays invisible to the client — they only hear about the result."
        ),
        description="Strict outcome-focused framing rule for all client-facing messages"
    )


class TechnicalCapabilities(BaseModel):
    """Technical skills and engineering stack mastered by the consultant."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    frontend_and_web: list[str] = Field(
        default_factory=lambda: ["React", "Next.js", "Web development"],
        description="Frontend web engineering capabilities"
    )
    automation_and_workflows: list[str] = Field(
        default_factory=lambda: ["n8n", "APIs", "CRM/workflows"],
        description="Workflow automation and API integration tools"
    )
    ai_and_conversational: list[str] = Field(
        default_factory=lambda: ["AI integrations", "AI agents", "WhatsApp automation"],
        description="AI models, agent frameworks, and conversational messaging"
    )
    infrastructure_and_devops: list[str] = Field(
        default_factory=lambda: ["VPS", "Docker"],
        description="Hosting, deployment, and infrastructure capabilities"
    )

    def all_skills(self) -> list[str]:
        """Return a flattened list of all technical skills."""
        return (
            self.frontend_and_web
            + self.automation_and_workflows
            + self.ai_and_conversational
            + self.infrastructure_and_devops
        )


class ServiceOffering(BaseModel):
    """Individual service package LeadPulse offers to clients."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str = Field(..., description="Unique machine-readable service identifier")
    name: str = Field(..., description="Human-readable service name")
    description: str = Field(..., description="What the service accomplishes for the client")
    deliverables: list[str] = Field(default_factory=list, description="Key technical deliverables")
    ideal_for_friction: list[str] = Field(
        default_factory=list,
        description="Friction points or signals that indicate this service is needed"
    )

    @field_validator("id", "name", "description")
    @classmethod
    def validate_service_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Service identification fields cannot be empty")
        return v.strip()


def _get_default_services() -> list[ServiceOffering]:
    """Factory returning the 7 canonical LeadPulse V2 service offerings."""
    return [
        ServiceOffering(
            id="website_development",
            name="Website Development & Redesign",
            description="High-performance, mobile-responsive Next.js web application focused on conversion and fast load times.",
            deliverables=[
                "Modern mobile-first website",
                "Conversion-optimized landing pages",
                "Speed & Core Web Vitals optimization"
            ],
            ideal_for_friction=[
                "No website",
                "Non-responsive mobile UX",
                "Slow website load time",
                "No clear call-to-action"
            ]
        ),
        ServiceOffering(
            id="ai_agents",
            name="AI Agents & Custom Assistants",
            description="Custom AI agents for intelligent lead handling, triage, and customer inquiry response.",
            deliverables=[
                "Custom AI agent pipeline",
                "Structured lead extraction",
                "Contextual FAQ assistant"
            ],
            ideal_for_friction=[
                "High volume of repetitive inquiries",
                "Complex triage requirements",
                "Slow manual response to common questions"
            ]
        ),
        ServiceOffering(
            id="whatsapp_automation",
            name="WhatsApp Lead & Inquiry Automation",
            description="24/7 automated WhatsApp lead capture, instant response to inquiries, and missed call re-engagement.",
            deliverables=[
                "Instant WhatsApp auto-responder",
                "24/7 after-hours lead capture",
                "Automated intake & qualification flow"
            ],
            ideal_for_friction=[
                "No WhatsApp CTA on website or ads",
                "Missed after-hours leads",
                "Slow customer response time",
                "Manual inquiry handling"
            ]
        ),
        ServiceOffering(
            id="lead_automation",
            name="Lead Capture & Speed-to-Lead Automation",
            description="Automated routing, instant notifications, and immediate follow-up to convert inbound prospects within seconds.",
            deliverables=[
                "Speed-to-lead webhook triggers",
                "Real-time lead notification alerts",
                "Multi-channel lead routing"
            ],
            ideal_for_friction=[
                "Leads sitting uncontacted for hours",
                "Leads slipping through the cracks",
                "Disorganized lead intake across platforms"
            ]
        ),
        ServiceOffering(
            id="booking_automation",
            name="Frictionless Calendar & Booking Automation",
            description="Automated calendar scheduling, appointment booking, reminder notifications, and no-show reduction.",
            deliverables=[
                "Calendar booking integration",
                "Automated WhatsApp/SMS reminders",
                "Rescheduling and cancellation workflows"
            ],
            ideal_for_friction=[
                "Back-and-forth manual scheduling",
                "High appointment no-show rates",
                "Complex booking friction"
            ]
        ),
        ServiceOffering(
            id="crm_workflow_automation",
            name="CRM & Operational Workflow Automation",
            description="Custom n8n and API integrations syncing leads, booking data, and customer records across business tools.",
            deliverables=[
                "n8n workflow pipelines",
                "Two-way CRM sync",
                "Custom webhook integrations"
            ],
            ideal_for_friction=[
                "Manual data entry across spreadsheets",
                "Fragmented software tools",
                "Disconnected customer data"
            ]
        ),
        ServiceOffering(
            id="business_automation",
            name="End-to-End Business Operations Automation",
            description="Custom automation architecture connecting marketing, customer intake, operations, and follow-ups.",
            deliverables=[
                "Comprehensive operational audit",
                "Integrated automations connecting ops to sales",
                "Scalable backend pipelines"
            ],
            ideal_for_friction=[
                "Chaotic operational bottlenecks",
                "Manual administrative overhead",
                "Scalability constraints"
            ]
        ),
    ]


class IdealCustomerProfile(BaseModel):
    """Ideal Customer Profile (ICP) defining qualified target businesses."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    business_type: str = Field(
        default="Local high-ticket established service businesses with ongoing customer inquiry volume",
        description="Core category of target clients"
    )
    min_headcount_criteria: str = Field(
        default="Roughly 15+ employees, or clear evidence of high inquiry volume regardless of headcount. Avoid 1-5 person micro shops.",
        description="Scale and operational maturity threshold"
    )
    growth_orientation: str = Field(
        default="Established appointment-driven or booking-driven operational business seeking inquiry conversion",
        description="Client mindset and operational posture"
    )
    marketing_activity: str = Field(
        default="Already investing in commercial marketing (Meta Ads, Google Ads, or active social media)",
        description="Evidence of commercial spending"
    )
    inbound_flow: str = Field(
        default="Already receiving regular customer calls, walk-ins, or inbound digital inquiries",
        description="Inbound inquiry posture"
    )
    operational_friction: str = Field(
        default="Experiencing conversion friction, missed inquiries, slow response, or weak booking UX",
        description="Operational problem to solve"
    )
    ability_to_pay: str = Field(
        default="High customer lifetime value (LTV) able to comfortably fund custom automation",
        description="Financial qualification"
    )
    estimated_min_customer_ltv: str = Field(
        default="High ticket (>INR 15,000 / >$500 per customer transaction or lifetime)",
        description="Customer transaction threshold"
    )


class TargetBusinessCharacteristics(BaseModel):
    """Quantitative thresholds and signals for lead qualification."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    min_rating: float = Field(default=4.0, ge=1.0, le=5.0, description="Minimum Google Maps rating")
    min_review_count: int = Field(default=20, ge=0, description="Minimum Google Maps review count")
    prefers_active_ads: bool = Field(default=True, description="Preference for businesses running Meta or Google Ads")
    prefers_website_present: bool = Field(default=True, description="Preference for businesses with an existing website")
    prefers_phone_number: bool = Field(default=True, description="Preference for businesses with a valid contact phone")


class GeographicScope(BaseModel):
    """Geographic boundaries authorized for lead prospecting."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    primary_region: str = Field(default="Delhi NCR", description="Primary metropolitan region")
    allowed_cities: list[str] = Field(
        default_factory=lambda: ["Delhi", "Gurgaon", "Noida"],
        description="Authorized target cities"
    )
    seed_micro_markets: list[str] = Field(
        default_factory=lambda: [
            "South Delhi",
            "Central Delhi",
            "West Delhi",
            "Gurgaon",
            "Noida"
        ],
        description="Seed sub-regions and high-density commercial hubs"
    )
    country: str = Field(default="India", description="Country name")

    @field_validator("allowed_cities")
    @classmethod
    def validate_cities(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("allowed_cities cannot be empty")
        return [c.strip() for c in v if c.strip()]


class VerticalScope(BaseModel):
    """Commercial verticals and industries targeted for automation services."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    seed_verticals: list[str] = Field(
        default_factory=lambda: [
            "Dermatology",
            "Med Spa",
            "Hair Transplant",
            "Dental",
            "Luxury Salon",
            "Interior Design",
            "Restaurants",
            "Real Estate",
            "Gyms"
        ],
        description="Seed high-ticket commercial verticals with booking/inquiry models"
    )
    allow_adjacent_discovery: bool = Field(
        default=True,
        description="Whether AI may discover adjacent high-ticket local service categories"
    )

    @field_validator("seed_verticals")
    @classmethod
    def validate_verticals(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("seed_verticals cannot be empty")
        return [vert.strip() for vert in v if vert.strip()]


class QualificationPreferences(BaseModel):
    """Lead qualification score tiers and priority routing rules."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    immediate_score_threshold: int = Field(
        default=9,
        ge=0,
        le=10,
        description="Score threshold for 'immediate' outreach priority (9-10)"
    )
    high_score_threshold: int = Field(
        default=7,
        ge=0,
        le=10,
        description="Score threshold for 'high' outreach priority (7-8)"
    )
    medium_score_threshold: int = Field(
        default=5,
        ge=0,
        le=10,
        description="Score threshold for 'medium' outreach priority (5-6)"
    )
    skip_score_threshold: int = Field(
        default=4,
        ge=0,
        le=10,
        description="Score threshold at or below which leads are marked 'skip' (<=4)"
    )
    primary_channel: str = Field(
        default="whatsapp",
        description="Primary outreach channel preference"
    )
    secondary_channels: list[str] = Field(
        default_factory=lambda: ["phone", "email", "instagram_dm"],
        description="Fallback outreach channels"
    )
    priority_signals: list[str] = Field(
        default_factory=lambda: [
            "active_meta_ads",
            "high_review_count",
            "missing_whatsapp_cta",
            "weak_mobile_booking",
            "traffic_to_generic_homepage"
        ],
        description="Signals indicating high conversion opportunity"
    )

    @model_validator(mode="after")
    def validate_threshold_hierarchy(self) -> "QualificationPreferences":
        if self.immediate_score_threshold < self.high_score_threshold:
            raise ValueError("immediate_score_threshold must be >= high_score_threshold")
        if self.high_score_threshold < self.medium_score_threshold:
            raise ValueError("high_score_threshold must be >= medium_score_threshold")
        if self.medium_score_threshold < self.skip_score_threshold:
            raise ValueError("medium_score_threshold must be >= skip_score_threshold")
        return self


class ExclusionRules(BaseModel):
    """Explicit exclusions specifying what LeadPulse does NOT sell or target."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    excluded_business_types: list[str] = Field(
        default_factory=lambda: [
            "Low-ticket e-commerce dropshippers",
            "Commodity retail shops without appointment or inquiry flows",
            "Solo/micro 1-5 person shops with no inquiry volume or budget",
            "Pre-revenue startups or zero-budget micro-enterprises",
            "Businesses without contact phone or digital footprint",
            "Other freelancers or developers self-promoting their own services",
            "Students or generic educational posts",
            "Government or non-profit entities",
            "B2B enterprise software with multi-month procurement cycles"
        ],
        description="Business types LeadPulse explicitly does not prospect"
    )
    excluded_services: list[str] = Field(
        default_factory=lambda: [
            "Manual cold calling agency services",
            "Generic social media management and regular posting",
            "Graphic design and logo branding packages",
            "SEO content writing mills",
            "Media buying / paid ad spend management as a standalone agency service"
        ],
        description="Services LeadPulse explicitly does NOT offer or sell"
    )
    disqualification_signals: list[str] = Field(
        default_factory=lambda: [
            "Permanently closed business",
            "Rating below 3.5 stars with repeated service complaints",
            "No phone number or contact channel found",
            "Explicit 'not accepting new clients' notice",
            "Developer/freelancer portfolio or self-promotion post"
        ],
        description="Signals that immediately disqualify a prospect"
    )


class OutreachConstraints(BaseModel):
    """Deterministic constraints and guardrails for outreach messaging."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    min_sentences: int = Field(default=2, ge=1, description="Minimum sentence count")
    max_sentences: int = Field(default=3, ge=1, description="Maximum sentence count")
    max_characters: int = Field(default=300, ge=50, description="Recommended character target (<300 chars)")
    hard_max_characters: int = Field(default=400, ge=100, description="Absolute hard character cap")
    tone: str = Field(
        default="Casual, helpful, conversational, non-salesy, peer-to-peer",
        description="Communication tone"
    )
    banned_phrases: list[str] = Field(
        default_factory=lambda: [
            "we help",
            "we specialize",
            "our team",
            "our agency",
            "our clients",
            "we offer",
            "reach out anytime",
            "feel free to reach out",
            "feel free to dm",
            "feel free to message",
            "would you be open to a quick chat",
            "would you be open to a brief chat",
            "would you be open to a quick call",
            "would you be open to a call",
            "hop on a call",
            "jump on a call",
            "book a call",
            "schedule a call",
            "schedule a demo",
            "book a demo",
            "let's connect",
            "game-changer",
            "game changer",
            "streamline",
            "streamlining",
            "leverage",
            "leveraging",
            "tailored solution",
            "cutting-edge",
            "synergy",
            "all-in-one solution",
            "seamlessly integrate",
            "transform your business",
            "10x",
            "skyrocket",
            "guaranteed results"
        ],
        description="Strictly forbidden marketing buzzwords and agency phrases"
    )
    banned_placeholder_patterns: list[str] = Field(
        default_factory=lambda: [
            r"\[[^\]]{2,30}\]",
            r"\{[^}]{2,30}\}",
            r"<[^>]{2,30}>"
        ],
        description="Regex patterns for unreplaced template placeholders"
    )
    no_fake_claims: bool = Field(
        default=True,
        description="NEVER fabricate past clients, projects, or testimonials. There is no live client yet — never imply otherwise."
    )
    no_pricing_in_first_contact: bool = Field(
        default=True,
        description="NEVER mention pricing in first contact — not finalized yet, and premature in a first message."
    )
    no_meeting_requests: bool = Field(
        default=True,
        description="First-contact messages must NOT include meeting or call requests (e.g. 'book a call', 'hop on a call')."
    )
    lead_with_technical_observation: bool = Field(
        default=True,
        description="Lead with a genuine technical observation or perspective on their stated problem — never open with a pitch."
    )
    require_human_approval: bool = Field(
        default=True,
        description="Outreach drafts require operator review before dispatch"
    )

    @model_validator(mode="after")
    def validate_outreach_bounds(self) -> "OutreachConstraints":
        if self.max_characters > self.hard_max_characters:
            raise ValueError("max_characters cannot exceed hard_max_characters")
        if self.min_sentences > self.max_sentences:
            raise ValueError("min_sentences cannot exceed max_sentences")
        return self


class CampaignScope(BaseModel):
    """Optional campaign overlay scoping a research run without altering global defaults."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: Optional[str] = None
    campaign_name: Optional[str] = None
    target_cities: Optional[list[str]] = None
    target_verticals: Optional[list[str]] = None
    focus_service_ids: Optional[list[str]] = None
    min_rating: Optional[float] = None
    min_review_count: Optional[int] = None
    prefers_active_ads_only: Optional[bool] = None

    @field_validator("focus_service_ids")
    @classmethod
    def validate_focus_service_ids(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None:
            cleaned = [s.strip() for s in v if s.strip()]
            if not cleaned:
                raise ValueError("focus_service_ids cannot be empty when specified")
            return cleaned
        return v


class LeadPulseProfile(BaseModel):
    """Structured, configurable business profile for LeadPulse AI.
    
    Serves as the single source of truth for business identity, capabilities,
    services, ICP, geography, verticals, exclusions, and outreach constraints.
    Future agents obtain their business context dynamically from this model.
    """
    model_config = ConfigDict(frozen=True)

    identity: BusinessIdentity = Field(default_factory=BusinessIdentity)
    persona: AgentPersona = Field(default_factory=AgentPersona)
    capabilities: TechnicalCapabilities = Field(default_factory=TechnicalCapabilities)
    services: list[ServiceOffering] = Field(default_factory=_get_default_services)
    target_customer: IdealCustomerProfile = Field(default_factory=IdealCustomerProfile)
    target_business: TargetBusinessCharacteristics = Field(default_factory=TargetBusinessCharacteristics)
    geography: GeographicScope = Field(default_factory=GeographicScope)
    verticals: VerticalScope = Field(default_factory=VerticalScope)
    qualification: QualificationPreferences = Field(default_factory=QualificationPreferences)
    exclusions: ExclusionRules = Field(default_factory=ExclusionRules)
    outreach: OutreachConstraints = Field(default_factory=OutreachConstraints)

    @field_validator("services")
    @classmethod
    def validate_services_non_empty(cls, v: list[ServiceOffering]) -> list[ServiceOffering]:
        if not v:
            raise ValueError("LeadPulse profile must include at least one authorized service offering")
        return v

    def get_service_by_id(self, service_id: str) -> Optional[ServiceOffering]:
        """Find a service offering by its identifier."""
        clean_id = service_id.strip().lower()
        for svc in self.services:
            if svc.id == clean_id:
                return svc
        return None

    def get_all_service_names(self) -> list[str]:
        """Return the names of all authorized services."""
        return [svc.name for svc in self.services]

    def get_services_summary(self) -> str:
        """Format a concise summary of all authorized services."""
        lines = []
        for svc in self.services:
            lines.append(f"- {svc.name} (`{svc.id}`): {svc.description}")
        return "\n".join(lines)

    def get_skills_summary(self) -> str:
        """Format a concise summary of consultant skills."""
        caps = self.capabilities
        return (
            f"- Frontend & Web: {', '.join(caps.frontend_and_web)}\n"
            f"- Automation & Workflows: {', '.join(caps.automation_and_workflows)}\n"
            f"- AI & Messaging: {', '.join(caps.ai_and_conversational)}\n"
            f"- Infrastructure: {', '.join(caps.infrastructure_and_devops)}"
        )

    def get_target_summary(self) -> str:
        """Format a concise summary of the target market and geographic scope."""
        cities = ", ".join(self.geography.allowed_cities)
        seed_verts = ", ".join(self.verticals.seed_verticals)
        return (
            f"- Target Customer: {self.target_customer.business_type} ({self.target_customer.growth_orientation})\n"
            f"- Region: {self.geography.primary_region} (Cities: {cities})\n"
            f"- Seed Verticals: {seed_verts}\n"
            f"- Target Criteria: Rating >= {self.target_business.min_rating}, Reviews >= {self.target_business.min_review_count}"
        )

    def get_outreach_rules_summary(self) -> str:
        """Format a concise summary of outreach constraints and banned phrases."""
        return (
            f"- Sentence Length: Strictly {self.outreach.min_sentences} to {self.outreach.max_sentences} sentences\n"
            f"- Character Cap: Target <{self.outreach.max_characters} characters (hard cap {self.outreach.hard_max_characters})\n"
            f"- Tone: {self.outreach.tone}\n"
            f"- Forbidden Phrases: No 'we help', 'we specialize', 'our team', 'our agency', 'our clients', 'hop on a call', 'book a call', 'book a demo', 'game-changer', 'streamline', 'leverage', 'reach out anytime', 'feel free to DM'\n"
            f"- Rule 1 (No Fabrication): NEVER fabricate past clients, projects, or testimonials. No live client yet — never imply otherwise.\n"
            f"- Rule 2 (No Pricing): NEVER mention pricing — not finalized yet, premature in first contact.\n"
            f"- Rule 3 (Individual Peer): Write as an individual solo peer typing from laptop/phone, never as an agency.\n"
            f"- Rule 4 (No Buzzwords): Zero sales hype, buzzwords, or corporate jargon.\n"
            f"- Rule 5 (No Placeholders): No template placeholders like [Name], [Company], or <business>.\n"
            f"- Rule 6 (No Meeting Requests): No meeting or call requests (no 'jump on a call', 'book a call', 'quick chat').\n"
            f"- Rule 7 (Technical Observation): Lead with a genuine technical observation on their stated setup/problem — never open with a pitch.\n"
            f"- Guardrails: Human approval mandatory before any dispatch."
        )

    def get_agent_context(self, agent_role: str = "base") -> str:
        """Generate focused, role-specific context to inject into an agent's prompt.
        
        Prevents prompt bloating by delivering only the business facts relevant
        to the specific agent's function.
        """
        role = agent_role.strip().lower()

        if role == "triage":
            return (
                f"OPERATOR: {self.identity.consultant_name} ({self.identity.title})\n"
                f"IDEAL CLIENT PROFILE:\n{self.target_customer.business_type} — {self.target_customer.growth_orientation}\n"
                f"AUTHORIZED LOCATIONS: {', '.join(self.geography.allowed_cities)} ({self.geography.primary_region})\n"
                f"SEED VERTICALS: {', '.join(self.verticals.seed_verticals)}\n"
                f"QUALIFICATION TIERS:\n"
                f"- Immediate (Score 9-10): Active ad spend + strong reviews (>20) + clear conversion friction (e.g. no WhatsApp CTA / weak mobile booking)\n"
                f"- High (Score 7-8): Marketing-active high-ticket local business with operational gaps\n"
                f"- Medium (Score 5-6): Established local business with potential automation need\n"
                f"- Skip (Score <= 4): Rating < 3.5, permanently closed, low-ticket retail, or no contact info\n"
                f"EXCLUDED PROSPECTS: {', '.join(self.exclusions.excluded_business_types)}\n"
                f"PRIMARY OUTREACH CHANNEL: {self.qualification.primary_channel}"
            )

        elif role in ("opportunity", "specialist"):
            return (
                f"CONSULTANT: {self.identity.consultant_name} ({self.identity.title})\n"
                f"CORE VALUE PROPOSITION:\n{self.persona.core_value_proposition}\n\n"
                f"TECHNICAL STACK & CAPABILITIES:\n{self.get_skills_summary()}\n\n"
                f"AUTHORIZED SERVICES WE CAN SELL:\n{self.get_services_summary()}\n\n"
                f"SERVICES WE DO NOT OFFER (EXCLUDED):\n"
                + "\n".join(f"- {s}" for s in self.exclusions.excluded_services)
                + "\n\nOPPORTUNITY EVALUATION RULE: Identify where Vansh can realistically create high ROI value."
            )

        elif role == "outreach":
            return (
                f"SENDER PERSONA: {self.identity.consultant_name}, {self.persona.perspective}\n"
                f"OUTREACH TONE: {self.outreach.tone}\n\n"
                f"STRICT OUTREACH GUARDRAILS:\n{self.get_outreach_rules_summary()}\n\n"
                f"AUTHORIZED SERVICES REFERENCED:\n"
                + ", ".join(self.get_all_service_names())
            )

        elif role in ("search", "search_strategist"):
            return (
                f"TARGET REGION: {self.geography.primary_region} (Authorized Cities: {', '.join(self.geography.allowed_cities)})\n"
                f"SEED MICRO-MARKETS: {', '.join(self.geography.seed_micro_markets)}\n"
                f"SEED VERTICALS: {', '.join(self.verticals.seed_verticals)}\n"
                f"DISCOVERY POLICY: Adjacent high-ticket service verticals permitted: {self.verticals.allow_adjacent_discovery}\n"
                f"CRITERIA: Growth-oriented local businesses with high customer LTV and commercial ad spend."
            )

        else:
            # Base / General overview
            return (
                f"LEADPULSE BUSINESS IDENTITY:\n"
                f"- Brand: {self.identity.name}\n"
                f"- Consultant: {self.identity.consultant_name} ({self.identity.title})\n"
                f"- Persona: {self.persona.role} ({self.persona.voice_tone})\n\n"
                f"SERVICES:\n{self.get_services_summary()}\n\n"
                f"TARGET PROFILE:\n{self.get_target_summary()}\n\n"
                f"OUTREACH CONSTRAINTS:\n{self.get_outreach_rules_summary()}"
            )

    def inject_context(self, base_instructions: str, agent_role: str = "base") -> str:
        """Inject business profile context into base agent instructions without duplicating boilerplate."""
        context = self.get_agent_context(agent_role)
        return (
            f"{base_instructions.strip()}\n\n"
            f"--- Centralized LeadPulse Business Context ({agent_role.upper()}) ---\n"
            f"{context}\n"
            f"-----------------------------------------------------------------"
        )

    def with_campaign_scope(self, scope: CampaignScope) -> "LeadPulseProfile":
        """Produce an adapted copy of the business profile scoped to a specific campaign.
        
        Allows campaign-level filtering without mutating global defaults or agent code.
        """
        data = self.model_dump()

        if scope.target_cities is not None:
            data["geography"]["allowed_cities"] = scope.target_cities

        if scope.target_verticals is not None:
            data["verticals"]["seed_verticals"] = scope.target_verticals

        if scope.focus_service_ids is not None:
            allowed_ids = set(s.strip().lower() for s in scope.focus_service_ids)
            filtered_services = [svc for svc in data["services"] if svc["id"] in allowed_ids]
            if not filtered_services:
                available_ids = [s["id"] for s in data["services"]]
                raise ValueError(
                    f"None of the focus_service_ids {scope.focus_service_ids} matched available services: {available_ids}"
                )
            data["services"] = filtered_services

        if scope.min_rating is not None:
            data["target_business"]["min_rating"] = scope.min_rating

        if scope.min_review_count is not None:
            data["target_business"]["min_review_count"] = scope.min_review_count

        if scope.prefers_active_ads_only is not None:
            data["target_business"]["prefers_active_ads"] = scope.prefers_active_ads_only

        return LeadPulseProfile.model_validate(data)
