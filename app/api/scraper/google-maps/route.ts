import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types/lead';
import { calculateProspectScore, detectFrictionPoints } from '@/lib/scorecard';
import { BANNED_PHRASES, countSentences, detectPlaceholders } from '@/lib/anti-spam-validator';

export const maxDuration = 300; // 5 minute timeout for Next.js / Vercel

interface IngestionRequest {
  runActor?: boolean;
  searchQueries?: string[];
  maxPlacesPerSearch?: number;
  items?: any[];
  places?: any[];
  hasActiveAdsOverride?: boolean;
}

const DEFAULT_SEARCH_QUERIES = [
  'skin clinic in Delhi',
  'dental clinic in South Delhi',
  'hair transplant clinic Delhi',
  'luxury salon Delhi',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes phone numbers to standard E.164 format (+91... for Indian numbers)
 */
function normalizePhoneNumber(rawPhone?: string | null): string | undefined {
  if (!rawPhone || typeof rawPhone !== 'string') return undefined;

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return undefined;

  // Handle international double-zero prefix (0091 -> +91)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Handle Indian local phone numbers without country code
  if (!cleaned.startsWith('+')) {
    // Strip single leading zero (e.g. 09810123456 -> 9810123456)
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

  // Validate digit count for E.164 (7 to 15 digits)
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return undefined;
  }

  return cleaned;
}

/**
 * Extracts Instagram URL or handle from Apify result
 */
function extractInstagramUrl(raw: any): string | undefined {
  if (raw.instagram && typeof raw.instagram === 'string') return raw.instagram;
  if (raw.instagramUrl && typeof raw.instagramUrl === 'string') return raw.instagramUrl;
  
  if (Array.isArray(raw.socialMedias)) {
    const ig = raw.socialMedias.find((s: any) => typeof s === 'string' && s.includes('instagram.com/'));
    if (ig) return ig;
  }

  if (raw.socialMedias && typeof raw.socialMedias === 'object' && raw.socialMedias.instagram) {
    return String(raw.socialMedias.instagram);
  }

  return undefined;
}

/**
 * Generates an operational WhatsApp audit pitch via Gemini 2.5 Flash
 */
async function generateAuditPitchWithGemini(
  model: any,
  business: {
    name: string;
    type: string;
    website?: string;
    phone?: string;
    reviewCount: number;
    rating: number;
    frictionPoints: string[];
  },
  maxRetries = 3
): Promise<{ draft_pitch: string; identified_problem: string } | null> {
  const frictionText = business.frictionPoints.length > 0
    ? business.frictionPoints.join('; ')
    : 'No direct WhatsApp booking button or automated inquiry response mechanism detected.';

  const systemPrompt = `
You are a solo local tech & operations consultant doing a direct operational audit for clinic and salon owners in Delhi NCR.
Write a direct, 2-to-3 sentence casual observation/pitch for WhatsApp.

RULES (STRICT PEER-TO-PEER TONE):
1. 2 to 3 sentences maximum (under 300 characters).
2. Write as an individual peer typing from a phone or laptop.
3. Reference the specific operational friction directly (e.g. missing WhatsApp booking link on website despite high review count).
4. Share a specific technical tip on capturing after-hours patients/clients without front-desk phone tag.
5. ZERO corporate or agency buzzwords:
   - NEVER use: "We help...", "We specialize in...", "Our team", "Game-changer", "Streamline", "Leverage", "Tailored solution", "Let's hop on a call", "Book a demo".
6. Do NOT include template bracket placeholders like [Name], [Company], or [Clinic].

Return strictly valid JSON:
{
  "identified_problem": string,
  "draft_pitch": string
}
`;

  const prompt = `
${systemPrompt}

Target Business Data:
- Business Name: ${business.name}
- Category: ${business.type}
- Google Reviews: ${business.reviewCount} (Rating: ${business.rating}★)
- Website: ${business.website || 'None'}
- Identified Operational Friction: ${frictionText}
`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await model.generateContent(prompt);
      const rawText = res.response.text();
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && typeof parsed.draft_pitch === 'string') {
        const pitch = parsed.draft_pitch.trim();
        const pitchLower = pitch.toLowerCase();

        // Anti-spam checks
        const hasBanned = BANNED_PHRASES.some((p) => pitchLower.includes(p));
        const placeholders = detectPlaceholders(pitch);
        const sentences = countSentences(pitch);

        if (!hasBanned && placeholders.length === 0 && sentences <= 3) {
          return {
            draft_pitch: pitch,
            identified_problem: parsed.identified_problem || frictionText,
          };
        } else {
          console.warn(`[Google Maps Pipeline] AI pitch failed tone checks (Attempt ${attempt}):`, {
            hasBanned,
            placeholders,
            sentences,
          });
        }
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < maxRetries) {
        const waitSec = 10 * attempt;
        console.warn(`⏳ Gemini rate limit encountered. Retrying in ${waitSec}s...`);
        await sleep(waitSec * 1000);
      } else {
        console.error(`Gemini pitch generation error (Attempt ${attempt}):`, errMsg);
        if (attempt === maxRetries) break;
      }
    }
  }

  // High-quality deterministic fallback pitch
  const fallbackPitch = business.reviewCount >= 50
    ? `Noticed ${business.name} has over ${business.reviewCount} reviews on Maps, but there's no direct 1-click WhatsApp booking button on your site. Most clinics lose 20-30% of after-hours appointment requests when patients have to call manual landlines instead of texting.`
    : `Hey ${business.name} team, saw your clinic listing and noticed there is no direct WhatsApp appointment capture on your page. Adding a direct wa.me scheduling link helps convert walk-in and search inquiries instantly without phone tag.`;

  return {
    draft_pitch: fallbackPitch,
    identified_problem: frictionText,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    const body: IngestionRequest = await req.json().catch(() => ({}));
    let rawItems: any[] = [];

    // 1. Ingest from Apify Actor or Payload
    if (body.runActor === true) {
      if (!apifyToken) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MISSING_APIFY_TOKEN',
              message: 'APIFY_API_TOKEN is required to trigger compass/crawler-google-places actor.',
            },
          },
          { status: 400 }
        );
      }

      console.log('[Google Maps Pipeline] Launching Apify actor compass/crawler-google-places...');
      const client = new ApifyClient({ token: apifyToken });
      const searchQueries = (body.searchQueries && body.searchQueries.length > 0)
        ? body.searchQueries
        : DEFAULT_SEARCH_QUERIES;

      const actorInput = {
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: Math.min(Math.max(1, body.maxPlacesPerSearch || 15), 30),
        language: 'en',
        scrapeWebSocialMedia: true,
        scrapePlaceDetails: true,
        skipClosedPlaces: true,
      };

      const run = await client.actor('compass/crawler-google-places').call(actorInput);
      console.log(`[Google Maps Pipeline] Apify run completed with status: ${run.status}`);

      const dataset = client.dataset(run.defaultDatasetId);
      const { items } = await dataset.listItems();
      rawItems = items;
    } else {
      rawItems = Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.places)
          ? body.places
          : [];
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_INPUT',
            message: 'No Google Places items provided. Pass "items": [...] or set "runActor": true.',
          },
        },
        { status: 400 }
      );
    }

    console.log(`[Google Maps Pipeline] Processing ${rawItems.length} raw place records...`);

    // 2. Load Existing Leads for Deduplication (Supabase + local leads.json)
    const trackedUrls = new Set<string>();
    const trackedPhones = new Set<string>();

    try {
      const { data: dbLeads } = await supabase
        .from('leads')
        .select('source_url, phone_number');

      if (dbLeads) {
        dbLeads.forEach((l) => {
          if (l.source_url) trackedUrls.add(l.source_url.toLowerCase().trim());
          if (l.phone_number) trackedPhones.add(l.phone_number.trim());
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Could not query existing leads from Supabase for deduplication:', e.message);
    }

    const localLeadsPath = path.join(process.cwd(), 'data', 'leads.json');
    let localLeads: Lead[] = [];
    if (fs.existsSync(localLeadsPath)) {
      try {
        const content = fs.readFileSync(localLeadsPath, 'utf-8');
        localLeads = JSON.parse(content);
        if (Array.isArray(localLeads)) {
          localLeads.forEach((l) => {
            if (l.source_url) trackedUrls.add(l.source_url.toLowerCase().trim());
            if (l.phone_number) trackedPhones.add(l.phone_number.trim());
          });
        }
      } catch (e) {
        console.warn('Could not parse local data/leads.json:', e);
      }
    }

    // 3. Normalization & Deduplication
    const normalizedCandidates: Array<{
      business_name: string;
      source_url: string;
      phone_number?: string;
      website_url?: string;
      instagram_url?: string;
      address?: string;
      rating: number;
      review_count: number;
      business_type: string;
      has_active_ads: boolean;
      frictionPoints: string[];
      scorecard: ReturnType<typeof calculateProspectScore>;
    }> = [];

    let duplicatesCount = 0;

    for (const raw of rawItems) {
      const businessName = (raw.title || raw.name || raw.businessName || '').trim();
      if (!businessName) continue;

      const sourceUrl = (
        raw.url ||
        raw.placeUrl ||
        raw.googleMapsUrl ||
        (raw.placeId ? `https://www.google.com/maps/place/?q=place_id:${raw.placeId}` : '')
      ).trim();

      const normalizedPhone = normalizePhoneNumber(raw.phone || raw.phoneNumber || raw.phoneUnformatted);

      // Deduplicate on source_url or phone_number
      const urlKey = sourceUrl.toLowerCase();
      if (sourceUrl && trackedUrls.has(urlKey)) {
        duplicatesCount++;
        continue;
      }
      if (normalizedPhone && trackedPhones.has(normalizedPhone)) {
        duplicatesCount++;
        continue;
      }

      const websiteUrl = (
        raw.website ||
        raw.websiteUrl ||
        (raw.url && !raw.url.includes('google.com/maps') ? raw.url : undefined)
      );

      const instagramUrl = extractInstagramUrl(raw);
      const address = (raw.address || raw.fullAddress || raw.street || '').trim();
      const rating = typeof raw.totalScore === 'number'
        ? raw.totalScore
        : typeof raw.rating === 'number'
          ? raw.rating
          : typeof raw.reviewsScore === 'number'
            ? raw.reviewsScore
            : 0;

      const reviewCount = typeof raw.reviewsCount === 'number'
        ? raw.reviewsCount
        : typeof raw.review_count === 'number'
          ? raw.review_count
          : typeof raw.userRatingsTotal === 'number'
            ? raw.userRatingsTotal
            : 0;

      const businessType = (
        raw.categoryName ||
        (Array.isArray(raw.categories) && raw.categories[0]) ||
        raw.businessType ||
        'Local Service'
      ).trim();

      const hasActiveAds = Boolean(raw.hasActiveAds || raw.has_active_ads || body.hasActiveAdsOverride);

      const candidateData: Partial<Lead> = {
        business_name: businessName,
        business_type: businessType,
        source_url: sourceUrl,
        phone_number: normalizedPhone,
        website_url: websiteUrl,
        instagram_url: instagramUrl,
        address,
        rating,
        review_count: reviewCount,
        has_active_ads: hasActiveAds,
      };

      // 4. Run Scorecard Calculation
      const scorecard = calculateProspectScore(candidateData);

      // Add to batch tracking to avoid intra-batch duplicates
      if (sourceUrl) trackedUrls.add(urlKey);
      if (normalizedPhone) trackedPhones.add(normalizedPhone);

      normalizedCandidates.push({
        business_name: businessName,
        source_url: sourceUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName)}`,
        phone_number: normalizedPhone,
        website_url: websiteUrl,
        instagram_url: instagramUrl,
        address,
        rating,
        review_count: reviewCount,
        business_type: businessType,
        has_active_ads: hasActiveAds,
        frictionPoints: scorecard.frictionPoints,
        scorecard,
      });
    }

    console.log(`[Google Maps Pipeline] Deduplication complete. ${normalizedCandidates.length} new candidates (${duplicatesCount} duplicates skipped).`);

    // 5. Gemini 2.5 Flash Pitch Generation (Filtered for Score >= 6)
    let geminiModel: any = null;
    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
    }

    const qualifiedLeads: Lead[] = [];

    for (let i = 0; i < normalizedCandidates.length; i++) {
      const cand = normalizedCandidates[i];
      const { scorecard } = cand;

      let draftPitch = '';
      let identifiedProblem = cand.frictionPoints.join('; ') || 'Missing direct appointment booking and WhatsApp funnel.';

      // Generate personalized Gemini pitch if qualified (Score >= 6)
      if (scorecard.score >= 6 && geminiModel) {
        console.log(`[Google Maps Pipeline] Generating pitch (${i + 1}/${normalizedCandidates.length}) for "${cand.business_name}" (Score: ${scorecard.score}/10)...`);
        const pitchResult = await generateAuditPitchWithGemini(geminiModel, {
          name: cand.business_name,
          type: cand.business_type,
          website: cand.website_url,
          phone: cand.phone_number,
          reviewCount: cand.review_count,
          rating: cand.rating,
          frictionPoints: cand.frictionPoints,
        });

        if (pitchResult) {
          draftPitch = pitchResult.draft_pitch;
          identifiedProblem = pitchResult.identified_problem;
        }

        // Brief delay between Gemini calls to respect rate limits
        if (i < normalizedCandidates.length - 1) {
          await sleep(1000);
        }
      } else if (scorecard.score >= 6) {
        // Fallback pitch when Gemini is not configured
        draftPitch = `Hey ${cand.business_name} team, noticed there is no direct WhatsApp booking link on your page despite your strong review count. Adding a 1-click wa.me scheduling link captures after-hours appointments without manual phone tag.`;
      }

      // Map Instagram handle or category for subreddit_or_handle
      let handleOrCategory = cand.business_type;
      if (cand.instagram_url) {
        const igMatch = cand.instagram_url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (igMatch && igMatch[1]) {
          handleOrCategory = `@${igMatch[1]}`;
        }
      }

      const leadRecord: Lead = {
        id: crypto.randomUUID(),
        source_platform: 'google_maps',
        source_url: cand.source_url,
        author: cand.business_name,
        subreddit_or_handle: handleOrCategory,
        title: cand.business_name,
        body_text: `${cand.business_name} - ${cand.business_type} in ${cand.address || 'Delhi NCR'}. Rating: ${cand.rating}★ (${cand.review_count} reviews). Website: ${cand.website_url || 'None'}. Phone: ${cand.phone_number || 'None'}.`,
        identified_problem: identifiedProblem,
        business_type: cand.business_type,
        confidence_score: scorecard.score,
        draft_pitch: draftPitch,
        status: 'new',
        created_at: new Date().toISOString(),

        // Local prospecting & multi-channel outreach properties
        business_name: cand.business_name,
        phone_number: cand.phone_number,
        website_url: cand.website_url,
        instagram_url: cand.instagram_url,
        google_maps_url: cand.source_url,
        address: cand.address,
        rating: cand.rating,
        review_count: cand.review_count,
        has_active_ads: cand.has_active_ads,
        prospect_score: scorecard.score,
        audit_friction_points: scorecard.frictionPoints,
        direct_contact_channel: 'whatsapp',
      };

      qualifiedLeads.push(leadRecord);
    }

    // 6. Database Upsert & Local JSON Backup
    if (qualifiedLeads.length > 0) {
      // 6a. Upsert into Supabase
      try {
        const { error: sbError } = await supabase
          .from('leads')
          .upsert(qualifiedLeads, { onConflict: 'source_url' });

        if (sbError) {
          console.error('[Google Maps Pipeline] Supabase upsert error:', sbError.message);
        } else {
          console.log(`[Google Maps Pipeline] Successfully upserted ${qualifiedLeads.length} leads to Supabase.`);
        }
      } catch (sbErr: any) {
        console.error('[Google Maps Pipeline] Exception during Supabase upsert:', sbErr.message);
      }

      // 6b. Append to local data/leads.json
      try {
        const seenUrls = new Set<string>();
        const dedupedLocal: Lead[] = [];

        for (const l of [...qualifiedLeads, ...localLeads]) {
          if (!seenUrls.has(l.source_url)) {
            seenUrls.add(l.source_url);
            dedupedLocal.push(l);
          }
        }

        fs.mkdirSync(path.dirname(localLeadsPath), { recursive: true });
        fs.writeFileSync(localLeadsPath, JSON.stringify(dedupedLocal, null, 2), 'utf-8');
        console.log(`[Google Maps Pipeline] Updated local backup ${localLeadsPath} (${dedupedLocal.length} total leads).`);
      } catch (fsErr: any) {
        console.error('[Google Maps Pipeline] Failed to sync local data/leads.json:', fsErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      total_ingested: rawItems.length,
      duplicates_skipped: duplicatesCount,
      evaluated: normalizedCandidates.length,
      qualified_leads_count: qualifiedLeads.length,
      leads: qualifiedLeads,
    });
  } catch (error: any) {
    console.error('[Google Maps Pipeline] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PIPELINE_ERROR',
          message: error.message || 'Google Places ingestion pipeline failed.',
        },
      },
      { status: 500 }
    );
  }
}
