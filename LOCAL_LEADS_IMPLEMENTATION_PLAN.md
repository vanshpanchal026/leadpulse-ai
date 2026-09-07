LOCAL_LEADS_IMPLEMENTATION_PLAN.md

Target: Local High-Ticket Deal Hunting Engine (Google Maps $\rightarrow$ Instagram $\rightarrow$ Meta Ads $\rightarrow$ WhatsApp Audit)Author / Lead: Vansh PanchalStatus: Ready for Execution (Sprint 6)1. Executive ObjectiveTransition the pipeline from purely reactive social monitoring (waiting for Reddit posts) to proactive local prospecting.Extract local high-ticket service businesses (Clinics, Med Spas, Luxury Salons, Interior Designers in Delhi NCR), automatically verify their marketing spending via Meta Ad Library / Instagram, calculate a 10-Point Prospect Score, and generate direct 1-click WhatsApp audit pitches.2. Database Migration (Supabase Schema Update)Run this SQL migration in the Supabase SQL Editor to support Google Maps metadata, social handles, and the scorecard engine:SQL-- Expand leads table for local prospecting & multi-channel outreach
alter table public.leads 
  add column if not exists business_name text,
  add column if not exists phone_number text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists google_maps_url text,
  add column if not exists address text,
  add column if not exists rating numeric(2,1),
  add column if not exists review_count integer default 0,
  add column if not exists has_active_ads boolean default false,
  add column if not exists prospect_score integer default 0,
  add column if not exists audit_friction_points jsonb default '[]'::jsonb,
  add column if not exists direct_contact_channel text default 'whatsapp';

-- Add index on prospect_score & platform for instant filtering
create index if not exists idx_leads_prospect_score on public.leads(prospect_score desc);
create index if not exists idx_leads_business_name on public.leads(business_name);
3. Apify Google Places Actor ConfigurationActor ID: compass/crawler-google-placesWhy this actor: Google Places se phone number, official website, aur reviews nikaalta hai, aur website ko automatically crawl karke Instagram, Facebook, aur email handles extract karta hai.Actor Input Payload TemplateJSON{
  "searchStringsArray": [
    "skin clinic in Delhi",
    "dental clinic in South Delhi",
    "hair transplant clinic Delhi",
    "luxury salon Delhi"
  ],
  "maxCrawledPlacesPerSearch": 20,
  "language": "en",
  "scrapeWebSocialMedia": true,
  "scrapePlaceDetails": true,
  "skipClosedPlaces": true
}
4. 10-Point Scorecard Logic (lib/scorecard.ts)Automated calculation engine jo har business ko score dega:DimensionConditionPointsMarketing ActivityActive Meta Ads found+3Google Review Count $\ge 50$ (Active offline customer flow)+2Verified Instagram handle extracted+1Friction & OpportunityHas official website listed+1Website audit friction (no WhatsApp button, slow, no direct booking)+2Business EconomicsHigh-ticket vertical (Dental Implant, Skin/Hair Clinic, Interior, Luxury Salon)+1Tiers8–10 Points: 🔥 Immediate Outreach (High-priority call/WhatsApp)6–7 Points: 🟢 High Potential4–5 Points: 🟡 Low Priority0–3 Points: ⚪ Skip / Discard5. Architecture & Pipeline Flow[Apify: compass/crawler-google-places]
                 │
                 ▼
     (Raw Place + Social Payload)
                 │
                 ▼
[Stage 1: Normalizer & Deduplication]
  - Deduplicate on `phone_number` or `website_url`
  - Extract: Business Name, Phone, Website, Instagram, Reviews
                 │
                 ▼
[Stage 2: Lightweight Website & Ad Audit (Node.js)]
  - Headless check: Does homepage have "wa.me" / WhatsApp link?
  - Meta Ad Library query check (or manual toggle flag)
                 │
                 ▼
[Stage 3: Gemini 2.5 Flash Pitch Generator]
  - Role: Solo local tech consultant
  - Input: Business type + Specific identified friction
  - Output: 3-sentence casual audit note for WhatsApp/Instagram DM
                 │
                 ▼
[Supabase Upsert & Command Center Sync]
  - Table: `leads`
  - 1-Click WhatsApp Direct Link: `https://wa.me/<phone>?text=<pitch>`
6. Antigravity Execution SprintsSprint 6.1: Data Types & Supabase Client UpdateUpdate types/lead.ts with new fields (business_name, phone_number, website_url, instagram_url, prospect_score, audit_friction_points).Update lib/supabase.ts schema typings.Sprint 6.2: Google Maps Ingestion Route (app/api/scraper/google-maps/route.ts)Endpoint jo Apify compass/crawler-google-places ko trigger kare ya local run dataset ingest kare.Raw output ko normalize karke scorecard calculate kare (lib/scorecard.ts).Gemini se personalized WhatsApp audit note generate karwa ke Supabase me upsert kare.Sprint 6.3: UI Dashboard Enhancements (app/page.tsx)Platform Filter: Add filter chips for All, Google Maps, Reddit, X.Lead Row / Card Overhaul:Show Business Name (e.g. "Dr. Batra Clinic", "Luxe Salon").Show Phone Number pill + Instagram handle link.Show Score badge (🔥 9/10).Direct Action Toolbar:Direct "Open WhatsApp" button: Opens [https://wa.me/](https://wa.me/)<phone>?text=... with pre-filled pitch.Direct "View Website" & "View Instagram" buttons.