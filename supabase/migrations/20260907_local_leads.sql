-- Expand leads table for local prospecting & multi-channel outreach
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

-- Add index on prospect_score & business_name for instant filtering
create index if not exists idx_leads_prospect_score on public.leads(prospect_score desc);
create index if not exists idx_leads_business_name on public.leads(business_name);
