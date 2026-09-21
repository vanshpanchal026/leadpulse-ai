import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function migrateLeads() {
  const rootDir = process.cwd();
  const leadsPath = path.join(rootDir, 'data', 'leads.json');

  if (!fs.existsSync(leadsPath)) {
    console.error(`❌ Could not find data/leads.json at: ${leadsPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading leads from: ${leadsPath}`);
  let rawLeads = [];
  try {
    const content = fs.readFileSync(leadsPath, 'utf-8');
    rawLeads = JSON.parse(content);
    if (!Array.isArray(rawLeads)) {
      throw new Error('data/leads.json does not contain an array.');
    }
  } catch (err) {
    console.error('❌ Failed to parse data/leads.json:', err.message);
    process.exit(1);
  }

  console.log(`📊 Found ${rawLeads.length} leads in data/leads.json.`);

  // Deduplicate by source_url
  const seenUrls = new Set();
  const records = [];

  for (const item of rawLeads) {
    if (!item.source_url) {
      console.warn('⚠️ Skipping lead without source_url:', item.title || 'Untitled');
      continue;
    }

    if (seenUrls.has(item.source_url)) {
      console.log(`⏩ Skipping duplicate URL: ${item.source_url}`);
      continue;
    }
    seenUrls.add(item.source_url);

    const record = {
      source_platform: item.source_platform || 'reddit',
      source_url: item.source_url,
      author: item.author || 'u/reddit_user',
      subreddit_or_handle: item.subreddit_or_handle || 'r/smallbusiness',
      title: item.title || 'Untitled Lead',
      body_text: item.body_text || '',
      identified_problem: item.identified_problem || '',
      business_type: item.business_type || 'Small Business',
      confidence_score: Number(item.confidence_score) || 0,
      draft_pitch: item.draft_pitch || '',
      status: item.status || 'new',
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Local Prospecting & Multi-Channel Specific Columns
      business_name: item.business_name || null,
      phone_number: item.phone_number || null,
      website_url: item.website_url || null,
      instagram_url: item.instagram_url || null,
      google_maps_url: item.google_maps_url || null,
      address: item.address || null,
      rating: item.rating ? Number(item.rating) : null,
      review_count: typeof item.review_count === 'number' ? item.review_count : 0,
      has_active_ads: Boolean(item.has_active_ads),
      prospect_score: typeof item.prospect_score === 'number' ? item.prospect_score : 0,
      audit_friction_points: Array.isArray(item.audit_friction_points) ? item.audit_friction_points : [],
      direct_contact_channel: item.direct_contact_channel || 'whatsapp',
      notes: item.notes || null,
    };

    // Include id only if it is already a valid UUID so Postgres uuid column doesn't error
    if (item.id && UUID_REGEX.test(item.id)) {
      record.id = item.id;
    }

    records.push(record);
  }

  console.log(`🚀 Upserting ${records.length} unique records into Supabase 'leads' table (on conflict source_url)...`);

  const { data, error } = await supabase
    .from('leads')
    .upsert(records, { onConflict: 'source_url' })
    .select();

  if (error) {
    console.error('❌ Supabase upsert error:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }

  const migratedCount = data ? data.length : records.length;
  console.log(`\n======================================================`);
  console.log(`🎉 Supabase Migration Completed Successfully!`);
  console.log(`✨ Total records processed: ${rawLeads.length}`);
  console.log(`💾 Total unique records upserted into Supabase: ${migratedCount}`);
  console.log(`======================================================\n`);
}

migrateLeads().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
