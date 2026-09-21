🚀 LeadPulse AI — V2 Final System Architecture
1. V2 ka actual objective
V1

Abhi system roughly:

Fixed Keywords
      ↓
Apify
      ↓
Google Maps / Reddit / Meta Ads
      ↓
Raw Businesses
      ↓
Hardcoded Filters
      ↓
Score
      ↓
AI Pitch
      ↓
Dashboard

Problem:

System ko khud nahi pata ki kis type ke business ko dhoondhna chahiye.

Hum usse bol rahe hain:

"Skin Clinic Delhi search kar."

Instead V2 mein hum chahte hain:

"Mere business, skills, services aur ideal customer profile ko samajhkar khud decide kar ki aaj kaunse businesses ko target karna valuable hoga."

So:

V2 = AI decides WHAT to search
     +
     AI decides WHO deserves research
     +
     AI investigates WHY they are a lead
     +
     Code guarantees FACTUAL / SAFE execution
2. Final High-Level Architecture
                         ┌─────────────────────────┐
                         │     LEADPULSE UI        │
                         │     Next.js 15          │
                         └────────────┬────────────┘
                                      │
                                      │ Start Research
                                      ▼
                    ┌──────────────────────────────────┐
                    │       AI ORCHESTRATOR             │
                    │      OpenAI Agents SDK            │
                    │                                  │
                    │     Main LeadPulse Agent          │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────┴─────────────────┐
                    │                                  │
                    ▼                                  ▼
          ┌─────────────────┐                ┌─────────────────┐
          │ Search Strategist│                │ Lead Triage     │
          │     Agent        │                │     Agent       │
          └────────┬─────────┘                └────────┬────────┘
                   │                                   │
                   ▼                                   ▼
             TOOL LAYER                         Candidate Leads
                   │                                   │
       ┌───────────┼───────────┐             ┌─────────┼─────────┐
       ▼           ▼           ▼             ▼         ▼         ▼
   Google Maps   Reddit    Meta Ads      Website     Ads      Maps
      Tool        Tool       Tool         Agent      Agent     Agent
       │           │           │             │         │         │
       └───────────┴───────────┘             └─────────┼─────────┘
                                                       ▼
                                             Opportunity Agent
                                                       │
                                                       ▼
                                               Lead Analyst
                                                       │
                                                       ▼
                                              Outreach Agent
                                                       │
                                                       ▼
                                             Deterministic
                                               Validator
                                                       │
                                                       ▼
                                                   Supabase
                                                       │
                                                       ▼
                                              LeadPulse Dashboard
                                                       │
                                                       ▼
                                              👤 HUMAN APPROVAL
                                                       │
                                                       ▼
                                                  WhatsApp
3. Sabse important architecture principle

Bhai, AI ko poora system control nahi dena hai.

Hum 2 layers rakhenge:

🧠 AI = Intelligence

AI decide karega:

kya search karna hai
kis market ko explore karna hai
kis business ko investigate karna hai
website mein kya problem hai
ads mein kya signal hai
business ke liye opportunity kya hai
kaunsi service relevant hai
outreach angle kya hona chahiye
⚙️ Code = Control

Code decide karega:

API calls
Apify execution
database writes
deduplication
validation
scoring constraints
rate limits
budgets
permissions
retries
logging
token tracking
WhatsApp actually send karna hai ya nahi

Ye separation V2 ka backbone hai.

4. Model Provider Layer

Yahan Antigravity completely remove.

OpenAI Agents SDK
        │
        ▼
Your OpenAI-Compatible API
        │
        ▼
Your available model

Agents SDK normally Responses API use karta hai, but custom OpenAI-compatible endpoint ke liye OPENAI_BASE_URL / custom client configure kiya ja sakta hai, aur provider compatibility ke case mein Chat Completions mode bhi select kiya ja sakta hai.

So architecture:

┌─────────────────────────────┐
│     OpenAI Agents SDK       │
│                             │
│ Agent                       │
│ Runner                      │
│ Tools                       │
│ Sub-agents                  │
│ Guardrails                  │
│ Structured Output           │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Your OpenAI-Compatible API  │
│                             │
│ API Key                     │
│ Base URL                    │
│ Model                       │
└─────────────────────────────┘

Groq nahi. Antigravity nahi.

Only:

OpenAI Agents SDK + your OpenAI-compatible API

5. LeadPulse Main Agent

Ye system ka brain hoga.

Isko hum random chatbot nahi banayenge.

Iske paas ek permanent business context hoga.

Main Agent ko pata hoga:
WHO WE ARE
↓
Solo developer / automation consultant

SKILLS
↓
React
Next.js
n8n
AI integrations
AI agents
WhatsApp automation
APIs
VPS
Docker
Web development

SERVICES
↓
Website development
AI agents
WhatsApp automation
Lead automation
Booking automation
CRM/workflows
Business automation

TARGET MARKET
↓
Local businesses

TARGET LOCATIONS
↓
Delhi
Gurgaon
Noida

IDEAL CLIENT
↓
High-ticket
Growth-oriented
Already marketing
Already receiving leads
Operational/conversion problems
Able to pay

TARGET VERTICALS
↓
Dermatology
Med Spa
Hair Transplant
Dental
Luxury Salon
Interior Design
etc.

But important:

Verticals fixed list nahi honge.

Ye seed categories hongi.

AI related adjacent opportunities discover kar sakta hai.

6. Search Strategist Agent

Ye V2 ka sabse bada upgrade hai.

V1:

Developer:
"Skin Clinic Delhi"

Apify:
"Okay sir."

V2:

Main Agent
    ↓
Search Strategist
    ↓
"Where is the best opportunity?"
    ↓
Search plan

Example:

Agent observe karta hai:

Delhi
+
High-ticket
+
Heavy Meta advertising
+
Poor booking UX

Toh woh decide kar sakta hai:

premium aesthetic clinic Delhi
cosmetic dermatology South Delhi
laser clinic Gurgaon
hair transplant clinic Delhi
aesthetic medicine clinic Noida

Instead of manually defining every keyword.

7. But AI ko unlimited search freedom nahi milegi

Ye bahut important hai.

Hum AI ko bolenge:

You may explore.
But you must remain inside:
- approved geography
- approved business profile
- approved vertical boundaries
- daily query limit
- Apify budget
- max results

For example:

{
  "allowed_locations": [
    "Delhi",
    "Gurgaon",
    "Noida"
  ],
  "seed_verticals": [
    "Dermatology",
    "Med Spa",
    "Dental",
    "Hair Transplant",
    "Luxury Salon",
    "Interior Design"
  ],
  "max_search_queries": 20,
  "max_businesses_per_query": 50,
  "max_research_candidates": 100
}

AI freedom:

high

System risk:

bounded

8. Search Plan Output

Search Strategist ko free-text return nahi karna.

Structured output:

{
  "research_goal": "...",
  "queries": [
    {
      "query": "premium aesthetic clinic",
      "location": "South Delhi",
      "reason": "High-ticket service + likely paid acquisition"
    }
  ],
  "priority": "high",
  "expected_lead_profile": "...",
  "max_results": 50
}

Isse code easily validate karega.

9. Apify = Tool, Agent nahi

Ye distinction yaad rakhna.

Agent:

"Mujhe South Delhi mein premium aesthetic clinics search karni hain."

Agent calls:

search_google_maps(
    query="premium aesthetic clinic",
    location="South Delhi",
    max_results=50
)

Tool internally:

search_google_maps()
        ↓
Apify API
        ↓
Google Places Actor
        ↓
results
        ↓
tool returns JSON

So:

AI
 ↓
Tool
 ↓
Apify
 ↓
Data

AI directly Apify API manage nahi karega.

10. Tool Layer

V2 mein dedicated tool layer banegi.

Google Maps
search_google_maps()
get_business_details()
Reddit
search_reddit()
get_reddit_post()
Meta Ads
search_meta_ads()
get_business_ads()
Website
fetch_website()
extract_website_data()
Database
get_lead()
save_analysis()
update_lead()
System
get_search_budget()
get_current_campaign()
get_business_profile()

OpenAI Agents SDK Python functions ko tools ke form mein expose kar sakta hai, including Pydantic validation.

11. Raw Data Processing Layer

Agent ko raw garbage directly nahi dena.

Apify se:

10,000 businesses

aa sakte hain.

Pehle deterministic processing:

Raw Data
   ↓
Normalize
   ↓
Clean
   ↓
Deduplicate
   ↓
Validate
   ↓
Basic Filter

Example:

"Dr XYZ Clinic"
"Dr. XYZ Clinic"
"Dr XYZ Aesthetic Clinic"

Potentially same business.

Code dedupe karega.

12. Cheap Deterministic Pre-Filter

AI se pehle cheap filters.

Example:

No website
AND
No phone
AND
No reviews
AND
Not high-ticket

→ discard.

Another:

Reviews > 50
+
Website exists
+
Instagram exists
+
Meta Ads active

→ high priority.

13. Existing Scorecard stays

Ye V1 ka useful part hai, isko delete nahi karna.

Existing:

Signal	Score
Active Meta Ads	+3
Google Reviews ≥ 50	+2
Instagram	+1
Website	+1
Booking friction	+2
High-ticket vertical	+1

Total:

10 points

Categories:

8–10 = Immediate
6–7  = High Potential
4–5  = Medium
0–3  = Skip
V2 difference

AI scorecard ko replace nahi karega.

AI scorecard ko contextualize karega.

14. Candidate Funnel

Main architecture:

10,000 raw businesses
        ↓
Deterministic filtering
        ↓
3,000 candidates
        ↓
Basic AI triage
        ↓
500 promising
        ↓
Deep research
        ↓
100 strong opportunities
        ↓
Lead Analyst
        ↓
20–50 outreach-worthy
        ↓
Human approval

This is much cheaper than:

10,000 × 5 agents
15. Lead Triage Agent

Ye decide karega:

"Is business ko deeper research deni chahiye?"

Inputs:

business info
+
scorecard
+
ads
+
website existence
+
reviews
+
social signals

Output:

{
  "qualified": true,
  "priority": "high",
  "reason": "Strong paid acquisition but poor conversion infrastructure",
  "research_agents": [
    "website",
    "ads",
    "maps"
  ]
}
16. Specialist Agent Architecture

Ab actual multi-agent system.

1. Website Agent

Check:

Website quality
Mobile UX
CTA
Booking flow
Page speed signals
Lead forms
Trust signals
Pricing transparency
Conversion friction

Output:

{
  "website_score": 4,
  "frictions": [
    "...",
    "..."
  ],
  "evidence": [
    "..."
  ]
}
2. Ads Agent

Check:

Active campaigns
Creative frequency
Offers
CTA
Landing page
Messaging
Funnel
Potential ad → website mismatch

Example:

Business spending money on Meta Ads
BUT
landing page has no obvious booking CTA.

That's a strong opportunity.

3. Maps Agent

Check:

rating
reviews
review velocity if available
photos
business positioning
services
location
competitive positioning
17. Reddit / Market Intelligence Agent

Reddit ko direct business identification ke liye blindly use nahi karna.

Instead:

Reddit
   ↓
Market pain discovery
   ↓
Common problems
   ↓
Search strategy improvement

Example:

Reddit signals:

"Patients don't respond after consultation."

"Too many no-shows."

"Leads aren't converting."

"WhatsApp follow-ups are manual."

Then Search Strategist:

Find businesses likely to suffer from these problems.

This makes Reddit a market intelligence layer.

18. Opportunity Agent

Ab specialists ka data combine hoga.

Website Agent
      +
Ads Agent
      +
Maps Agent
      +
Business data
      +
Market intelligence
          ↓
   Opportunity Agent

Iska question:

"Where can Vansh realistically create value for this business?"

Example:

Business:
Premium Dermatology Clinic

Signals:
- Active Meta Ads
- 1,000+ reviews
- Strong Instagram
- Website exists
- Booking flow weak
- WhatsApp CTA missing
- Ads drive traffic to generic homepage

Opportunity:
Lead → WhatsApp → qualification → booking automation
19. Service Matching

Agent ko ye bhi decide karna hoga:

What should we sell?

Possible services:

Website redesign
WhatsApp automation
AI receptionist
Lead qualification
Booking automation
CRM automation
Follow-up automation
Custom AI agent

Output:

{
  "recommended_service": "WhatsApp + lead follow-up automation",
  "fit_score": 9,
  "reason": "..."
}
20. Lead Analyst

Ye final business-level analysis banayega.

Example:

{
  "business": "XYZ Clinic",

  "qualification": {
    "score": 9,
    "tier": "immediate"
  },

  "business_profile": "...",

  "pain_points": [
    "...",
    "..."
  ],

  "opportunity": "...",

  "recommended_service": "...",

  "why_now": "...",

  "evidence": [],

  "confidence": 0.87
}
21. Outreach Agent

Outreach Agent ka job:

salesman banna nahi.

Uska job:

Research ko short, natural, non-spammy opening message mein convert karna.

Example concept:

"Hey, noticed you're running ads for [service], but the traffic lands on a fairly generic page. There's a small conversion gap there that might be worth fixing."

But generated pitch must pass deterministic validator.

22. Deterministic Outreach Validator

Ye mandatory hai.

Check:

2–3 sentences
<300 characters
No fake claims
No fake testimonials
No placeholders
No "We help..."
No "We specialize..."
No "Game changer"
No "Leverage"
No aggressive CTA

If fail:

❌ Reject
      ↓
Regenerate

If pass:

✅ Store
23. Human Approval Layer

AI automatically WhatsApp nahi karega.

Final:

AI finds lead
      ↓
AI researches
      ↓
AI writes pitch
      ↓
Validator approves
      ↓
Dashboard
      ↓
👤 USER REVIEWS
      ↓
[Approve]
      ↓
WhatsApp

This is important because V2 autonomous research hai, autonomous spam engine nahi.

24. Supabase Architecture

Existing leads table remains.

But V2 mein richer fields add karenge.

Example:

leads
├── id
├── source_platform
├── source_url
├── business_name
├── phone_number
├── website_url
├── instagram_url
├── google_maps_url
├── rating
├── review_count
├── has_active_ads
├── prospect_score
├── status
├── draft_pitch
├── created_at

Add:

ai_analysis JSONB

research_status

research_priority

recommended_service

opportunity_score

confidence_score

research_sources JSONB

agent_version

model_name

token_usage JSONB

research_timestamp
25. AI Analysis JSON

Instead of 15 database columns for everything:

{
  "business_profile": {},
  "website_analysis": {},
  "ads_analysis": {},
  "maps_analysis": {},
  "market_signals": {},
  "pain_points": [],
  "opportunities": [],
  "recommended_service": {},
  "outreach": {},
  "confidence": 0.87
}

Supabase PostgreSQL JSONB is perfect for this.

26. Next.js + Python Architecture

Because current LeadPulse Next.js 15 based hai, main AI runtime ko Python service mein isolate karna better rahega.

                    ┌──────────────────┐
                    │    Next.js 15    │
                    │   LeadPulse UI   │
                    └────────┬─────────┘
                             │
                             │ HTTP
                             ▼
                    ┌──────────────────┐
                    │   Python Worker  │
                    │                  │
                    │ OpenAI Agents SDK│
                    └────────┬─────────┘
                             │
                 ┌───────────┼───────────┐
                 ▼           ▼           ▼
              Apify       Supabase    AI Provider

Why?

Because Agents SDK Python-first hai and Python mein Pydantic/tooling ecosystem bhi strong hai. Official SDK Python installation and agent/tool workflow support karta hai.

27. Recommended Repository Structure

Main is tarah structure karunga:

leadpulse/
│
├── app/
│   ├── api/
│   │   ├── leads/
│   │   ├── scraper/
│   │   ├── research/
│   │   └── campaigns/
│   │
│   └── dashboard/
│
├── components/
│
├── lib/
│   ├── scoring/
│   ├── normalization/
│   ├── deduplication/
│   ├── validators/
│   ├── supabase/
│   └── apify/
│
├── ai-worker/
│   │
│   ├── main.py
│   │
│   ├── agents/
│   │   ├── main_agent.py
│   │   ├── search_strategist.py
│   │   ├── triage_agent.py
│   │   ├── website_agent.py
│   │   ├── ads_agent.py
│   │   ├── maps_agent.py
│   │   ├── opportunity_agent.py
│   │   ├── lead_analyst.py
│   │   └── outreach_agent.py
│   │
│   ├── tools/
│   │   ├── google_maps.py
│   │   ├── reddit.py
│   │   ├── meta_ads.py
│   │   ├── website.py
│   │   ├── database.py
│   │   └── campaign.py
│   │
│   ├── schemas/
│   │   ├── search.py
│   │   ├── business.py
│   │   ├── analysis.py
│   │   └── outreach.py
│   │
│   ├── prompts/
│   │   ├── main.md
│   │   ├── search.md
│   │   ├── website.md
│   │   ├── ads.md
│   │   └── outreach.md
│   │
│   ├── guardrails/
│   │   ├── search.py
│   │   ├── research.py
│   │   └── outreach.py
│   │
│   └── config/
│       ├── profile.py
│       ├── limits.py
│       └── settings.py
│
├── supabase/
│   └── migrations/
│
├── docker-compose.yml
└── README.md
28. Main Agent ka role

Main Agent ko har kaam khud nahi karna.

It is the manager.

Main Agent
│
├── Search Strategist
│
├── Lead Triage
│
├── Website Agent
│
├── Ads Agent
│
├── Maps Agent
│
├── Opportunity Agent
│
├── Lead Analyst
│
└── Outreach Agent

Agents SDK mein manager-style pattern — jahan central agent specialized agents ko tools ki tarah invoke karta hai — directly supported hai.

Mere hisaab se LeadPulse ke liye:

Manager pattern > random handoffs

Kyunki humein ek central orchestrator chahiye jo:

budget
+
priority
+
research order
+
final decision

control kare.

Handoffs SDK mein available hain, but LeadPulse ke research pipeline mein specialists ko agents-as-tools ki tarah expose karna cleaner rahega.

29. Agent Execution Example

Let's say daily run start hua.

Step 1

Main Agent:

What should we search today?

↓

Step 2

Search Strategist:

Delhi premium dermatology
Gurgaon hair transplant
South Delhi aesthetic clinic
Noida luxury dental

↓

Step 3

Apify tools:

Google Maps
Meta Ads
Reddit

↓

Step 4

Raw:

2,000 businesses

↓

Step 5

Code:

normalize
dedupe
filter
score

↓

300 candidates

↓

Step 6

Triage Agent:

300
 ↓
100 worth researching

↓

Step 7

Parallel:

Website Agent ─┐
Ads Agent ─────┼──→ Opportunity Agent
Maps Agent ────┘

↓

Step 8

Lead Analyst:

100
 ↓
35 strong opportunities

↓

Step 9

Outreach:

35 pitches

↓

Step 10

Validator:

35
 ↓
31 valid

↓

Step 11

Supabase:

31 leads

↓

Step 12

Dashboard:

🔥 31 NEW HIGH-VALUE LEADS
30. Parallelization

Website, Ads and Maps independent hain.

Therefore:

                Candidate
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
       Website     Ads       Maps
       Agent      Agent      Agent
          │         │         │
          └─────────┼─────────┘
                    ↓
             Opportunity

Sequential:

Website → Ads → Maps

nahi.

Parallel:

Website
Ads
Maps
   ↓
Merge

Latency dramatically reduce hogi.

31. Token Optimization

Ye architecture expensive ban sakta hai agar galat design kiya.

Wrong
Every business
 ×
Every agent
 ×
Full raw Apify data
Correct
Raw data
 ↓
Code filter
 ↓
Cheap triage
 ↓
Only promising businesses
 ↓
Deep research

Aur agents ko:

only required data

denge.

Website Agent ko pura Maps JSON nahi chahiye.

Ads Agent ko pura Reddit dump nahi chahiye.

32. Research Context

Har agent ko focused context:

Website Agent
{
  "business_name": "...",
  "website": "...",
  "services": [...],
  "maps_summary": "..."
}
Ads Agent
{
  "business_name": "...",
  "active_ads": [...],
  "landing_pages": [...]
}
Opportunity Agent
{
  "business": {},
  "website_analysis": {},
  "ads_analysis": {},
  "maps_analysis": {}
}

No unnecessary context.

33. Guardrails

OpenAI Agents SDK mein input/output/tool guardrails available hain.

LeadPulse mein guardrails:

Search Guardrail

Reject:

location outside target
irrelevant industry
excessive queries
invalid query
Research Guardrail

Reject:

missing business identity
insufficient evidence
hallucinated facts
Outreach Guardrail

Reject:

fake claims
unsupported claims
spam
placeholders
too long
banned phrases
34. Evidence-Based AI

Ye V2 ka very important feature hai.

AI ko bolna:

Don't invent business problems.

Every important conclusion should have evidence.

Example:

{
  "finding": "Booking friction",
  "evidence": "Homepage requires navigation through 3 pages before appointment CTA",
  "source": "website"
}

Instead of:

"They probably lose leads."

No.

We want:

Observed:
X

Inference:
Y

Confidence:
Z
35. Confidence System

Each analysis:

confidence: 0–1

Example:

Website friction
0.91

Ads opportunity
0.83

WhatsApp opportunity
0.76

Then Lead Analyst can prioritize.

36. Campaign Engine

V2 ko ek "Research Campaign" concept dena chahiye.

Example:

Campaign:
Delhi High Ticket Healthcare

Goal:
Find businesses likely to buy automation

Locations:
Delhi
Gurgaon
Noida

Verticals:
Dermatology
Dental
Hair Transplant
Med Spa

Daily budget:
₹X Apify

Max businesses:
500

Max deep research:
100

Then AI operates inside this campaign.

This is much better than one giant global agent.

37. Dashboard mein new controls

V2 UI:

┌─────────────────────────────────────┐
│         RESEARCH CAMPAIGN           │
│                                     │
│ Goal: Find high-ticket prospects    │
│                                     │
│ Locations                           │
│ ☑ Delhi                             │
│ ☑ Gurgaon                           │
│ ☑ Noida                             │
│                                     │
│ Vertical Seeds                      │
│ ☑ Dermatology                       │
│ ☑ Dental                            │
│ ☑ Hair Transplant                   │
│ ☑ Med Spa                           │
│                                     │
│ [ START AUTONOMOUS RESEARCH ]       │
└─────────────────────────────────────┘

Then live status:

🤖 Search Strategist
Finding search opportunities...

🔎 Google Maps
Searching 7 queries...

🧹 Processing
2,381 businesses

🧠 AI Triage
412 candidates

🔬 Deep Research
87 businesses

🎯 Opportunities
24 high-value leads
38. Observability

Har run track karna hai.

research_run

Fields:

run_id
campaign_id
started_at
completed_at
queries_generated
businesses_found
businesses_filtered
businesses_researched
qualified_leads
tokens_used
tool_calls
apify_cost
errors
status

Then later we can answer:

"Last month AI ne kitna spend kiya aur kitne qualified leads diye?"

39. Token Tracking

Every model call:

input_tokens
output_tokens
total_tokens
model
agent
timestamp

Store.

Example:

{
  "agent": "website_agent",
  "model": "your-model",
  "input_tokens": 3200,
  "output_tokens": 800,
  "total_tokens": 4000
}

Then dashboard:

Today's AI usage

Tokens:
1.42M

Businesses researched:
87

Tokens / qualified lead:
48K
40. Failure Handling

Agent systems fail. Assume that.

Apify failure
retry
 ↓
backoff
 ↓
fallback
 ↓
log
LLM failure
retry
 ↓
fallback model if available
 ↓
skip expensive research
Agent timeout
mark partial
 ↓
continue other agents
Website unavailable
Website Agent:
"unavailable"

NOT:

"website has poor UX"

No hallucination.

41. State Machine

Research lifecycle:

DISCOVERED
    ↓
NORMALIZED
    ↓
QUALIFIED
    ↓
TRIAGED
    ↓
RESEARCHING
    ↓
ANALYZED
    ↓
OUTREACH_READY
    ↓
HUMAN_REVIEW
    ↓
APPROVED
    ↓
CONTACTED
    ↓
RESPONDED
    ↓
CONVERTED

Potential failure:

RESEARCH_FAILED

or

REJECTED
42. Human-in-the-loop

Dashboard actions:

[Approve]
[Reject]
[Edit Pitch]
[Open Website]
[Open Maps]
[Open Instagram]
[Open WhatsApp]

AI recommend karega.

Final business decision:

you.

43. V2 ka final responsibility split
Component	Responsibility
OpenAI Agents SDK	Agent orchestration
Main Agent	Overall strategy
Search Agent	Search planning
Apify	Data collection
Deterministic code	Processing + rules
Triage Agent	Candidate selection
Website Agent	Website research
Ads Agent	Ad research
Maps Agent	Local business research
Opportunity Agent	Opportunity discovery
Lead Analyst	Final analysis
Outreach Agent	Pitch generation
Validators	Safety/quality
Supabase	Persistence
Next.js	Dashboard
Human	Final outreach approval
44. Final V2 Architecture in one diagram
                         ┌───────────────────────┐
                         │      USER / VANSH     │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   LEADPULSE DASHBOARD │
                         │       Next.js 15      │
                         └───────────┬───────────┘
                                     │
                              Start Campaign
                                     │
                                     ▼
                ┌─────────────────────────────────────┐
                │       PYTHON AI WORKER               │
                │                                     │
                │       OpenAI Agents SDK             │
                │                                     │
                │ ┌─────────────────────────────────┐ │
                │ │       MAIN ORCHESTRATOR         │ │
                │ └───────────────┬─────────────────┘ │
                │                 │                   │
                │        ┌────────┴────────┐          │
                │        ▼                 ▼          │
                │ SEARCH STRATEGIST    LEAD TRIAGE    │
                │        │                 │          │
                └────────┼─────────────────┼──────────┘
                         │                 │
                         ▼                 ▼
              ┌─────────────────┐    Candidate Leads
              │    TOOL LAYER   │          │
              ├─────────────────┤          ▼
              │ Google Maps     │   ┌───────────────┐
              │ Reddit          │   │ SPECIALISTS   │
              │ Meta Ads        │   ├───────────────┤
              │ Website         │   │ Website Agent │
              │ Database        │   │ Ads Agent     │
              │ Campaign        │   │ Maps Agent    │
              └────────┬────────┘   └───────┬───────┘
                       │                    │
                       ▼                    ▼
                  ┌─────────┐       ┌──────────────┐
                  │  APIFY  │       │ OPPORTUNITY  │
                  └────┬────┘       │    AGENT     │
                       │             └──────┬───────┘
                       ▼                    │
                Raw Business Data           ▼
                       │             ┌──────────────┐
                       ▼             │ LEAD ANALYST │
              ┌─────────────────┐    └──────┬───────┘
              │ DETERMINISTIC   │           │
              │ PROCESSING      │           ▼
              │                 │    ┌──────────────┐
              │ Normalize       │    │ OUTREACH     │
              │ Deduplicate     │    │    AGENT     │
              │ Filter          │    └──────┬───────┘
              │ Score           │           │
              │ Validate        │           ▼
              └────────┬────────┘    ┌──────────────┐
                       │              │ FINAL        │
                       └─────────────►│ VALIDATOR    │
                                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  SUPABASE    │
                                      └──────┬───────┘
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  DASHBOARD   │
                                      └──────┬───────┘
                                             │
                                      👤 HUMAN REVIEW
                                             │
                                             ▼
                                          WHATSAPP
45. V2 ka golden rule

Bhai, ye line Antigravity ko sabse pehle samjha dena:

"We are not replacing our existing deterministic LeadPulse pipeline with AI. We are adding an AI orchestration layer on top of it."

Aur second:

"The AI decides what is worth investigating; deterministic code decides what is safe, valid, deduplicated, stored and executed."

Aur third:

"Apify remains the data acquisition engine. OpenAI Agents SDK becomes the intelligence/orchestration engine."

Ye 3 principles architecture ko bhatakne nahi denge.

46. Antigravity ko dene ke liye V2 implementation brief

Agar tu Antigravity mein project open karke implementation start karne wala hai, main usko next message mein ek single detailed V2_IMPLEMENTATION_SPEC.md style prompt de sakta hoon jisme:

current V1 ko inspect karne ke instructions
exact files modify/create karni hain
Python AI worker
OpenAI-compatible provider configuration
every agent ka prompt/role
Pydantic schemas
Apify tools
Supabase schema migration
API endpoints
campaign system
agent execution flow
retry/error handling
token tracking
guardrails
dashboard changes
testing checklist
"don't break existing V1 functionality" rules

sab kuch implementation-ready format mein hoga.