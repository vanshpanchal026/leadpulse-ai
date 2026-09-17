-- LeadPulse V2: Campaigns Table
-- Persists campaign configurations for autonomous research runs

CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    goal text DEFAULT 'Find high-ticket prospects likely to buy automation services',
    locations jsonb DEFAULT '["Delhi", "Gurgaon", "Noida"]'::jsonb,
    verticals jsonb DEFAULT '["Dermatology", "Med Spa", "Hair Transplant", "Dental", "Luxury Salon", "Interior Design"]'::jsonb,
    limits jsonb DEFAULT '{"max_search_queries": 4, "max_businesses_per_query": 15, "max_apify_calls": 6, "max_deep_research_leads": 10}'::jsonb,
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    total_runs integer DEFAULT 0,
    total_qualified_leads integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read access on campaigns" ON public.campaigns
    FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on campaigns" ON public.campaigns
    FOR UPDATE USING (true);
