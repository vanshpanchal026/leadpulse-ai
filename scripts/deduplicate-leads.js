import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Supabase credentials are missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Normalizes business names for deduplication:
 * - Lowercase and trimmed
 * - Strip punctuation, special characters, and excess whitespace
 * - Strip common legal/business/industry suffixes like "Clinic", "Dental", "Pvt Ltd", etc.
 */
function normalizeBusinessName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';

  let normalized = rawName.toLowerCase().trim();

  // Replace separators with spaces
  normalized = normalized.replace(/[-_/\\|&+,]/g, ' ');

  // Remove non-alphanumeric characters (keep letters, digits, spaces)
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Strip leading 'the '
  normalized = normalized.replace(/^the\s+/, '');

  // Strip common suffixes & corporate indicators (as standalone words)
  const suffixes = [
    'pvt ltd',
    'private limited',
    'pvt',
    'ltd',
    'llp',
    'llc',
    'inc',
    'corp',
    'corporation',
    'clinic',
    'clinics',
    'dental',
    'dentistry',
    'hospital',
    'hospitals',
    'centre',
    'center',
    'care',
    'healthcare',
    'studio',
    'solutions',
    'services',
    'salon',
    'spa',
  ];

  for (const suffix of suffixes) {
    const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
    normalized = normalized.replace(regex, ' ');
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes phone numbers to standard E.164 format (+91... for Indian numbers)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return undefined;

  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return undefined;

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = `+${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }

  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return undefined;
  }

  return cleaned;
}

/**
 * Calculates a completeness score for a lead record to select the single best keeper
 */
function calculateCompleteness(lead) {
  let score = 0;

  const pScore = Number(lead.prospect_score) || Number(lead.confidence_score) || 0;
  score += pScore * 10;

  if (lead.phone_number && lead.phone_number.trim() && lead.phone_number !== 'None') score += 25;
  if (lead.website_url && lead.website_url.trim() && lead.website_url !== 'None') score += 20;
  if (lead.google_maps_url && lead.google_maps_url.trim()) score += 15;
  if (lead.address && lead.address.trim()) score += 15;
  if (typeof lead.rating === 'number' && lead.rating > 0) score += 10;
  if (typeof lead.review_count === 'number' && lead.review_count > 0) score += 10;
  if (Array.isArray(lead.audit_friction_points) && lead.audit_friction_points.length > 0) score += 5;
  if (lead.draft_pitch && lead.draft_pitch.trim()) score += 5;
  if (lead.body_text && lead.body_text.length > 60) score += 5;

  return score;
}

/**
 * Merge complementary information from duplicate into keeper
 */
function mergeLeadData(keeper, duplicate) {
  if (!keeper.phone_number && duplicate.phone_number) {
    keeper.phone_number = duplicate.phone_number;
  }
  if (!keeper.website_url && duplicate.website_url) {
    keeper.website_url = duplicate.website_url;
  }
  if (!keeper.google_maps_url && duplicate.google_maps_url) {
    keeper.google_maps_url = duplicate.google_maps_url;
  }
  if (!keeper.address && duplicate.address) {
    keeper.address = duplicate.address;
  }
  if ((!keeper.rating || keeper.rating === 0) && duplicate.rating) {
    keeper.rating = duplicate.rating;
  }
  if ((!keeper.review_count || keeper.review_count === 0) && duplicate.review_count) {
    keeper.review_count = duplicate.review_count;
  }
  if (
    (!keeper.prospect_score || keeper.prospect_score === 0) &&
    duplicate.prospect_score
  ) {
    keeper.prospect_score = duplicate.prospect_score;
  }
  if (
    (!keeper.confidence_score || keeper.confidence_score === 0) &&
    duplicate.confidence_score
  ) {
    keeper.confidence_score = duplicate.confidence_score;
  }
  if (
    (!keeper.audit_friction_points || keeper.audit_friction_points.length === 0) &&
    duplicate.audit_friction_points
  ) {
    keeper.audit_friction_points = duplicate.audit_friction_points;
  }
  return keeper;
}

/**
 * Determines grouping key for deduplication
 */
function getLeadGroupKey(lead) {
  if (lead.source_platform === 'reddit') {
    return `reddit:${(lead.source_url || '').toLowerCase().trim()}`;
  }

  const normalizedName = normalizeBusinessName(lead.business_name || lead.title);
  if (normalizedName) {
    return `biz:${normalizedName}`;
  }

  return `url:${(lead.source_url || '').toLowerCase().trim()}`;
}

async function deduplicateLeads() {
  console.log('\n======================================================');
  console.log('🧹 Starting Database & Cache Deduplication Migration');
  console.log('======================================================\n');

  // 1. Clean up Supabase Database Leads
  console.log('🔍 Fetching all leads from Supabase `leads` table...');
  const { data: dbLeads, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to query Supabase leads:', fetchError.message);
    process.exit(1);
  }

  console.log(`📊 Found ${dbLeads.length} leads in Supabase.`);

  // Group Supabase leads
  const dbGroups = new Map();
  for (const lead of dbLeads) {
    const key = getLeadGroupKey(lead);
    if (!dbGroups.has(key)) {
      dbGroups.set(key, []);
    }
    dbGroups.get(key).push(lead);
  }

  const redundantIdsToDelete = [];
  const keepersToUpdate = [];

  for (const [key, group] of dbGroups.entries()) {
    if (group.length > 1) {
      console.log(`\n⚠️ Found duplicate group [${key}] with ${group.length} rows:`);
      group.forEach((item, idx) => {
        const score = calculateCompleteness(item);
        console.log(`   [${idx + 1}] ID: ${item.id} | Name: "${item.business_name || item.title}" | Phone: ${item.phone_number || 'N/A'} | Completeness: ${score} pts`);
      });

      // Sort by completeness score descending, then by created_at ascending
      group.sort((a, b) => {
        const scoreDiff = calculateCompleteness(b) - calculateCompleteness(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const keeper = group[0];
      const redundant = group.slice(1);

      console.log(`   ✅ Preserving single most complete row: ID ${keeper.id} ("${keeper.business_name || keeper.title}")`);

      // Merge data from redundant rows into keeper
      for (const red of redundant) {
        mergeLeadData(keeper, red);
        redundantIdsToDelete.push(red.id);
        console.log(`   🗑️ Queued redundant row for deletion: ID ${red.id}`);
      }

      keepersToUpdate.push(keeper);
    }
  }

  // Execute Deletions in Supabase
  if (redundantIdsToDelete.length > 0) {
    console.log(`\n🚀 Deleting ${redundantIdsToDelete.length} redundant duplicate rows from Supabase...`);
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .in('id', redundantIdsToDelete);

    if (deleteError) {
      console.error('❌ Failed to delete duplicate rows from Supabase:', deleteError.message);
      process.exit(1);
    }
    console.log(`✅ Successfully deleted ${redundantIdsToDelete.length} redundant rows from Supabase.`);

    // Update keepers in Supabase if enriched
    for (const keeper of keepersToUpdate) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          phone_number: keeper.phone_number,
          website_url: keeper.website_url,
          google_maps_url: keeper.google_maps_url,
          address: keeper.address,
          rating: keeper.rating,
          review_count: keeper.review_count,
          prospect_score: keeper.prospect_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', keeper.id);

      if (updateError) {
        console.warn(`⚠️ Warning: Could not update keeper ${keeper.id} in Supabase:`, updateError.message);
      }
    }
  } else {
    console.log('✨ No duplicate rows needed deletion in Supabase.');
  }

  // 2. Clean up local data/leads.json
  const leadsJsonPath = path.join(process.cwd(), 'data', 'leads.json');
  console.log(`\n📂 Reading local leads cache from: ${leadsJsonPath}`);

  let localLeads = [];
  if (fs.existsSync(leadsJsonPath)) {
    try {
      localLeads = JSON.parse(fs.readFileSync(leadsJsonPath, 'utf-8'));
    } catch (err) {
      console.warn('⚠️ Could not parse data/leads.json:', err.message);
    }
  }

  console.log(`📊 Found ${localLeads.length} leads in data/leads.json.`);

  // Group local leads
  const localGroups = new Map();
  for (const lead of localLeads) {
    const key = getLeadGroupKey(lead);
    if (!localGroups.has(key)) {
      localGroups.set(key, []);
    }
    localGroups.get(key).push(lead);
  }

  const cleanLocalLeads = [];
  let localDuplicatesRemoved = 0;

  for (const [key, group] of localGroups.entries()) {
    if (group.length > 1) {
      localDuplicatesRemoved += group.length - 1;
      // Sort by completeness descending
      group.sort((a, b) => {
        const scoreDiff = calculateCompleteness(b) - calculateCompleteness(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const keeper = group[0];
      for (const red of group.slice(1)) {
        mergeLeadData(keeper, red);
      }
      cleanLocalLeads.push(keeper);
    } else {
      cleanLocalLeads.push(group[0]);
    }
  }

  // Write cleanly deduplicated array back to data/leads.json
  fs.writeFileSync(leadsJsonPath, JSON.stringify(cleanLocalLeads, null, 2), 'utf-8');
  console.log(`💾 Overwrote ${leadsJsonPath} with ${cleanLocalLeads.length} cleanly deduplicated leads (${localDuplicatesRemoved} duplicates pruned).`);

  // 3. Final Verification Gate
  console.log('\n======================================================');
  console.log('🔍 Performing Verification Check...');
  console.log('======================================================');

  const { data: verifyDbLeads } = await supabase
    .from('leads')
    .select('id, business_name, title, source_platform, source_url, phone_number, prospect_score');

  const dbBizCounts = {};
  verifyDbLeads.forEach((l) => {
    if (l.source_platform !== 'reddit') {
      const name = normalizeBusinessName(l.business_name || l.title);
      dbBizCounts[name] = (dbBizCounts[name] || 0) + 1;
    }
  });

  const dbDuplicates = Object.entries(dbBizCounts).filter(([_, count]) => count > 1);

  const localBizCounts = {};
  cleanLocalLeads.forEach((l) => {
    if (l.source_platform !== 'reddit') {
      const name = normalizeBusinessName(l.business_name || l.title);
      localBizCounts[name] = (localBizCounts[name] || 0) + 1;
    }
  });

  const localDuplicates = Object.entries(localBizCounts).filter(([_, count]) => count > 1);

  console.log(`Supabase Leads Count: ${verifyDbLeads.length}`);
  console.log(`Supabase Duplicate Businesses: ${dbDuplicates.length}`);
  console.log(`data/leads.json Leads Count: ${cleanLocalLeads.length}`);
  console.log(`data/leads.json Duplicate Businesses: ${localDuplicates.length}`);

  if (dbDuplicates.length === 0 && localDuplicates.length === 0) {
    console.log('\n🎉 SUCCESS: 0 duplicate business names in Supabase & data/leads.json!');
    console.log('Enforced: 1 Business = Exactly 1 Lead Card.\n');
  } else {
    console.error('❌ Verification failed. Duplicates still detected:', { dbDuplicates, localDuplicates });
    process.exit(1);
  }
}

deduplicateLeads().catch((err) => {
  console.error('Fatal error during deduplication:', err);
  process.exit(1);
});
