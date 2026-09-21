-- ====================================================================
-- LeadPulse AI V2 — Phase 8 Migration: Research Persistence & Campaign Runs
-- Migration: 20260909_v2_research.sql
-- Description: Extends public.leads with V2 multi-agent intelligence columns
--              and creates the public.research_runs table.
-- Preserves all existing V1 data and columns intact.
-- ====================================================================

-- 1. Create research_runs table for tracking campaign run lifecycles
create table if not exists public.research_runs (
  run_id text primary key,
  campaign_id text,
  status text not null default 'pending', -- pending, running, completed, partial, failed, cancelled
  started_at timestamptz default now(),
  completed_at timestamptz,
  queries_generated integer default 0,
  businesses_found integer default 0,
  businesses_filtered integer default 0,
  businesses_triaged integer default 0,
  businesses_researched integer default 0,
  qualified_leads integer default 0,
  total_tokens integer default 0,
  tool_calls integer default 0,
  apify_calls integer default 0,
  errors jsonb default '[]'::jsonb,
  configuration jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fast Indexing for research_runs
create index if not exists idx_research_runs_status on public.research_runs(status);
create index if not exists idx_research_runs_campaign_id on public.research_runs(campaign_id);
create index if not exists idx_research_runs_created_at on public.research_runs(created_at desc);

-- 2. Extend public.leads with V2 Research & Intelligence Columns
alter table public.leads 
  add column if not exists research_status text default 'pending',
  add column if not exists research_priority text default 'medium',
  add column if not exists opportunity_score numeric(5,2) default 0.0,
  add column if not exists confidence_score numeric(5,2) default 0.0,
  add column if not exists recommended_service text,
  add column if not exists primary_problem text,
  add column if not exists why_this_service text,
  add column if not exists evidence jsonb default '[]'::jsonb,
  add column if not exists research_sources jsonb default '[]'::jsonb,
  add column if not exists specialist_results jsonb default '{}'::jsonb,
  add column if not exists lead_analysis jsonb default '{}'::jsonb,
  add column if not exists outreach_draft jsonb default '{}'::jsonb,
  add column if not exists outreach_status text default 'draft',
  add column if not exists agent_version text,
  add column if not exists prompt_version text,
  add column if not exists model_name text,
  add column if not exists token_usage jsonb default '{}'::jsonb,
  add column if not exists research_timestamp timestamptz,
  add column if not exists research_run_id text;

-- Add fast indexing for V2 queries
create index if not exists idx_leads_research_status on public.leads(research_status);
create index if not exists idx_leads_research_run_id on public.leads(research_run_id);
create index if not exists idx_leads_opportunity_score on public.leads(opportunity_score desc);
create index if not exists idx_leads_outreach_status on public.leads(outreach_status);
create index if not exists idx_leads_phone_number on public.leads(phone_number);

-- 3. Row Level Security Policies (safe defaults)
alter table public.research_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'research_runs' and policyname = 'Allow read access to research_runs'
  ) then
    create policy "Allow read access to research_runs" on public.research_runs for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'research_runs' and policyname = 'Allow insert access to research_runs'
  ) then
    create policy "Allow insert access to research_runs" on public.research_runs for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'research_runs' and policyname = 'Allow update access to research_runs'
  ) then
    create policy "Allow update access to research_runs" on public.research_runs for update using (true);
  end if;
end $$;
