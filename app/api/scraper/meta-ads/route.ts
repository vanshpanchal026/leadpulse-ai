import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types/lead';
import { calculateProspectScore } from '@/lib/scorecard';
import { BANNED_PHRASES, countSentences, detectPlaceholders } from '@/lib/anti-spam-validator';
import { emitAgentEvent } from '@/lib/agent-telemetry';

export const maxDuration = 300; // 5 minute timeout for Next.js / Vercel

export interface MetaAdsScrapeRequest {
  searchQuery?: string; // e.g. "Skin Clinic Delhi", "Dental Clinic South Delhi"
  maxAds?: number;      // Default 10 (cost guardrail < $0.10)
  runActor?: boolean;
  items?: any[];
  testMode?: boolean;
}

const DEFAULT_SEARCH_QUERY = 'Skin Clinic Delhi';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes business names for deduplication:
 * - Lowercase and trimmed
 * - Strip punctuation, special characters, and excess whitespace
 * - Strip common legal/business/industry suffixes like "Clinic", "Dental", "Pvt Ltd", etc.
 */
function normalizeBusinessName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';

  let normalized = rawName.toLowerCase().trim();

  // Replace separators with spaces
  normalized = normalized.replace(/[-_/\\|&+,]/g, ' ');

  // Remove non-alphanumeric characters (keep letters, digits, and spaces)
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Strip leading 'the '
  normalized = normalized.replace(/^the\s+/, '');

  // Strip common business, medical & corporate suffixes
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
function normalizePhoneNumber(rawPhone?: string | null): string | undefined {
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
 * Extract 10-digit Indian mobile number from text (ad copy, captions, HTML)
 */
function extractIndianPhoneFromText(text?: string | null): string | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const regex = /(?:(?:\+?91|0)[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const normalized = normalizePhoneNumber(raw);
    if (normalized) return normalized;
  }
  return undefined;
}

/**
 * Fallback: Fetch destination landing page HTML and scan for wa.me, tel:, or phone strings
 */
async function fetchLandingPagePhoneAndFriction(websiteUrl?: string | null): Promise<{
  phone?: string;
  hasDirectWhatsApp: boolean;
}> {
  if (!websiteUrl || typeof websiteUrl !== 'string') {
    return { hasDirectWhatsApp: false };
  }

  try {
    const parsed = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { hasDirectWhatsApp: false };
    }

    const html = await res.text();

    // Check for WhatsApp links
    const waMatch =
      html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{10,15})/i) ||
      html.match(/href=["']https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{10,15})/i);

    const hasDirectWhatsApp = Boolean(waMatch || /wa\.me/i.test(html) || /api\.whatsapp\.com/i.test(html));
    let phone: string | undefined = undefined;

    if (waMatch && waMatch[1]) {
      phone = normalizePhoneNumber(waMatch[1]);
    }

    // Look for tel: link
    if (!phone) {
      const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
      if (telMatch && telMatch[1]) {
        phone = normalizePhoneNumber(telMatch[1]);
      }
    }

    // Scan body text for 10-digit Indian phone
    if (!phone) {
      phone = extractIndianPhoneFromText(html);
    }

    return { phone, hasDirectWhatsApp };
  } catch {
    return { hasDirectWhatsApp: false };
  }
}

/**
 * Extracts Instagram profile link or handle
 */
function extractInstagramUrl(raw: any): string | undefined {
  if (raw.instagram && typeof raw.instagram === 'string') return raw.instagram;
  if (raw.instagramUrl && typeof raw.instagramUrl === 'string') return raw.instagramUrl;
  if (raw.snapshot?.pageProfileUri && String(raw.snapshot.pageProfileUri).includes('instagram.com/')) {
    return String(raw.snapshot.pageProfileUri);
  }
  if (raw.ad_details?.advertiser_page_info?.instagram_url) {
    return String(raw.ad_details.advertiser_page_info.instagram_url);
  }
  if (raw.ad_details?.advertiser_page_info?.instagram_username) {
    return `https://instagram.com/${raw.ad_details.advertiser_page_info.instagram_username}`;
  }

  // Check extraLinks
  if (Array.isArray(raw.snapshot?.extraLinks)) {
    const ig = raw.snapshot.extraLinks.find((l: any) => typeof l === 'string' && l.includes('instagram.com/'));
    if (ig) return ig;
  }

  return undefined;
}

/**
 * Helper to detect if a URL is a WhatsApp or social link rather than a real business website
 */
function isWhatsAppOrSocialUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.includes('wa.me') ||
    lower.includes('whatsapp.com') ||
    lower.includes('api.whatsapp.com') ||
    lower.includes('fb.me') ||
    lower.includes('facebook.com')
  );
}

/**
 * Extract phone number from WhatsApp URL (e.g. wa.me/918795006097, api.whatsapp.com/send?phone=918795006097)
 */
function extractPhoneFromWhatsAppUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const waMatch =
    url.match(/(?:phone=|wa\.me\/|send\?phone=)(\+?\d{10,15})/i) ||
    url.match(/wa\.me\/(\+?\d{10,15})/i);
  if (waMatch && waMatch[1]) {
    return normalizePhoneNumber(waMatch[1]);
  }
  return undefined;
}

/**
 * Derives a clean, specific business niche/type, preventing "UNKNOWN" values
 */
function deriveBusinessType(options: {
  searchQuery?: string;
  rawCategory?: string;
  adCopy?: string;
  adOffer?: string;
  businessName?: string;
}): string {
  const combined = `${options.businessName || ''} ${options.adOffer || ''} ${options.adCopy || ''} ${options.searchQuery || ''}`.toLowerCase();

  // 1. Keyword classification
  if (
    combined.includes('dental') ||
    combined.includes('dentist') ||
    combined.includes('implant') ||
    combined.includes('orthodontic') ||
    combined.includes('root canal') ||
    combined.includes('teeth')
  ) {
    return 'Dental Clinic';
  }
  if (
    combined.includes('skin') ||
    combined.includes('derma') ||
    combined.includes('dermatolog') ||
    combined.includes('aesthetic') ||
    combined.includes('cosmetic') ||
    combined.includes('laser treatment')
  ) {
    return 'Skin & Aesthetic Clinic';
  }
  if (
    combined.includes('hair') ||
    combined.includes('transplant') ||
    combined.includes('follicle') ||
    combined.includes('hair restoration')
  ) {
    return 'Hair Transplant Clinic';
  }
  if (
    combined.includes('salon') ||
    combined.includes('spa') ||
    combined.includes('beauty parlour') ||
    combined.includes('haircut')
  ) {
    return 'Luxury Salon & Spa';
  }
  if (
    combined.includes('interior') ||
    combined.includes('architecture') ||
    combined.includes('architect') ||
    combined.includes('decor')
  ) {
    return 'Interior Design Studio';
  }

  // 2. Derive from searchQuery by removing location words
  if (options.searchQuery) {
    const cleanedQuery = options.searchQuery
      .replace(/\b(in|near|delhi|south delhi|ncr|mumbai|bangalore|gurgaon|noida|india)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedQuery.length > 2 && !/unknown|none|n\/a/i.test(cleanedQuery)) {
      return cleanedQuery;
    }
  }

  // 3. Check rawCategory if present and valid
  if (options.rawCategory && typeof options.rawCategory === 'string') {
    const trimmed = options.rawCategory.trim();
    if (trimmed && !/unknown|none|n\/a|other/i.test(trimmed)) {
      return trimmed;
    }
  }

  // 4. Default fallback (never UNKNOWN)
  return 'Specialist Clinic';
}

interface MetaLeadCandidate {
  business_name: string;
  source_url: string;
  website_url?: string;
  instagram_url?: string;
  google_maps_url?: string;
  address?: string;
  rating?: number;
  review_count?: number;
  phone_number?: string;
  ad_offer: string;
  ad_copy: string;
  ad_variations?: string[];
  business_type: string;
  frictionPoints: string[];
  scorecard: ReturnType<typeof calculateProspectScore>;
}

/**
 * Unified Auto-Enrichment: Performs background Google Places lookup for Meta Ad leads,
 * merges Google Maps listing URL, star rating, review count, physical address, real website,
 * and recalculates the 10-point scorecard.
 */
async function enrichMetaCandidatesWithGooglePlaces(
  candidates: MetaLeadCandidate[],
  apifyToken?: string,
  localLeads: Lead[] = [],
  skipApify: boolean = false
): Promise<void> {
  const uniqueBusinesses = Array.from(new Set(candidates.map((c) => c.business_name).filter(Boolean)));
  if (uniqueBusinesses.length === 0) return;

  const placesMap = new Map<string, {
    google_maps_url?: string;
    rating?: number;
    review_count?: number;
    address?: string;
    website_url?: string;
    instagram_url?: string;
  }>();

  // 1. Check existing localLeads for cached Google Maps data
  for (const name of uniqueBusinesses) {
    const lowerName = name.toLowerCase().trim();
    const existing = localLeads.find(
      (l) =>
        l.business_name &&
        (l.business_name.toLowerCase().trim() === lowerName ||
          lowerName.includes(l.business_name.toLowerCase().trim()) ||
          l.business_name.toLowerCase().trim().includes(lowerName)) &&
        (l.rating || l.google_maps_url)
    );
    if (existing) {
      placesMap.set(lowerName, {
        google_maps_url: existing.google_maps_url || (existing.source_platform === 'google_maps' ? existing.source_url : undefined),
        rating: existing.rating,
        review_count: existing.review_count,
        address: existing.address,
        website_url: existing.website_url && !isWhatsAppOrSocialUrl(existing.website_url) ? existing.website_url : undefined,
        instagram_url: existing.instagram_url,
      });
    }
  }

  // 2. Query Apify Google Places crawler for businesses needing lookup
  const needsLookup = uniqueBusinesses.filter((name) => !placesMap.has(name.toLowerCase().trim()));

  if (needsLookup.length > 0 && apifyToken && !skipApify) {
    try {
      console.log(`[Meta Ads Enrichment] Querying Google Places for: ${needsLookup.join(', ')}`);
      const client = new ApifyClient({ token: apifyToken });
      const searchQueries = needsLookup.map((name) => `${name} Delhi`);

      const actorInput = {
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: 1,
        language: 'en',
        scrapeWebSocialMedia: true,
        scrapePlaceDetails: true,
        skipClosedPlaces: true,
      };

      const run = await client.actor('compass/crawler-google-places').call(actorInput);
      if (run && run.defaultDatasetId) {
        const dataset = client.dataset(run.defaultDatasetId);
        const { items } = await dataset.listItems();
        console.log(`[Meta Ads Enrichment] Google Places returned ${items.length} records.`);

        for (const item of (items as any[])) {
          const itemTitle: string = String(item.title || item.name || '').trim();
          if (!itemTitle) continue;

          const rating: number | undefined =
            typeof item.totalScore === 'number'
              ? item.totalScore
              : typeof item.rating === 'number'
              ? item.rating
              : undefined;

          const reviewCount: number | undefined =
            typeof item.reviewsCount === 'number'
              ? item.reviewsCount
              : typeof item.review_count === 'number'
              ? item.review_count
              : undefined;

          const gMapUrl: string | undefined =
            (typeof item.url === 'string' && item.url) ||
            (typeof item.placeUrl === 'string' && item.placeUrl) ||
            (item.placeId ? `https://www.google.com/maps/place/?q=place_id:${item.placeId}` : undefined);

          const rawWebsite: string | undefined =
            (typeof item.website === 'string' && item.website) ||
            (typeof item.websiteUrl === 'string' && item.websiteUrl) ||
            undefined;

          const website: string | undefined =
            rawWebsite && !isWhatsAppOrSocialUrl(rawWebsite) ? rawWebsite : undefined;

          const instagram: string | undefined = extractInstagramUrl(item);
          const address: string | undefined =
            (typeof item.address === 'string' ? item.address : typeof item.fullAddress === 'string' ? item.fullAddress : '').trim() ||
            undefined;

          const enrichedData = {
            google_maps_url: gMapUrl,
            rating,
            review_count: reviewCount,
            address,
            website_url: website,
            instagram_url: instagram,
          };

          const matchedName =
            needsLookup.find((name) => {
              const n1 = name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const n2 = itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
              return n1.includes(n2) || n2.includes(n1);
            }) || needsLookup[0];

          if (matchedName) {
            placesMap.set(matchedName.toLowerCase().trim(), enrichedData);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Meta Ads Enrichment] Google Places actor lookup failed, continuing with available data:', err.message);
    }
  }

  // 3. Merge enriched data into each candidate and RECALCULATE 10-point scorecard
  for (const cand of candidates) {
    const lowerName = cand.business_name.toLowerCase().trim();
    const enriched = placesMap.get(lowerName);

    if (enriched) {
      if (enriched.google_maps_url) cand.google_maps_url = enriched.google_maps_url;
      if (typeof enriched.rating === 'number') cand.rating = enriched.rating;
      if (typeof enriched.review_count === 'number') cand.review_count = enriched.review_count;
      if (enriched.address) cand.address = enriched.address;
      if (!cand.website_url && enriched.website_url) cand.website_url = enriched.website_url;
      if (!cand.instagram_url && enriched.instagram_url) cand.instagram_url = enriched.instagram_url;
    }

    // Recalculate 10-Point Scorecard with enriched Google Maps assets
    const candidateData: Partial<Lead> = {
      business_name: cand.business_name,
      business_type: cand.business_type,
      source_url: cand.source_url,
      phone_number: cand.phone_number,
      website_url: cand.website_url,
      instagram_url: cand.instagram_url,
      google_maps_url: cand.google_maps_url,
      address: cand.address,
      rating: cand.rating,
      review_count: cand.review_count,
      has_active_ads: true, // +3 pts
      audit_friction_points: cand.frictionPoints,
    };

    const updatedScorecard = calculateProspectScore(candidateData);
    cand.scorecard = updatedScorecard;
    cand.frictionPoints = updatedScorecard.frictionPoints;
  }
}

/**
 * Generates an ad-specific operational WhatsApp audit pitch via Gemini 2.5 Flash
 */
async function generateMetaAdPitchWithGemini(
  model: any,
  adData: {
    businessName: string;
    adOffer: string;
    landingPage?: string;
    frictionPoints: string[];
    rating?: number;
    reviewCount?: number;
    address?: string;
    recommendedService?: string;
  },
  maxRetries = 3
): Promise<{ draft_pitch: string; identified_problem: string } | null> {
  const service = adData.recommendedService || 'lead_automation';
  const frictionText =
    adData.frictionPoints.length > 0
      ? adData.frictionPoints.join('; ')
      : 'Ad traffic routed to standard contact form without direct inquiry conversion or speed-to-lead workflow.';

  const systemPrompt = `
You are Vansh, a solo freelance developer doing an honest technical observation for a local business running paid Meta ads.
Tone: Exactly 2 to 3 casual peer sentences (under 300 characters). Write as an individual solo peer typing from a phone or laptop.
NEVER say "we", "our team", "our agency", or "our clients".

STRICT OUTREACH INVARIANTS:
1. OUTCOME REFRAMING: Never describe services as "AI chatbot" or "automation". Reframe entirely around concrete outcomes: capturing missed ad clickers, eliminating multi-step form abandonment, converting ad traffic directly into bookings 24/7.
2. NO MEETING REQUESTS: Never ask to "hop on a call", "book a call", "schedule a demo", or "quick chat".
3. NO PRICING: Never mention pricing or fees.
4. NO PAST CLIENT FABRICATION: Never fabricate past clients or case studies.
5. LEAD WITH TECHNICAL OBSERVATION: Open directly with a genuine observation on their active ad offer or landing page setup — never open with a sales pitch.
6. ZERO BUZZWORDS: Banned words: "streamline", "leverage", "game-changer", "tailored solution", "reach out anytime", "feel free to DM".
7. Do NOT include template bracket placeholders like [Name], [Company], or [Clinic].

Target Service Bottleneck: ${service}

Return strictly valid JSON:
{
  "identified_problem": string,
  "draft_pitch": string
}
`;

  const reviewsInfo = typeof adData.reviewCount === 'number' && adData.reviewCount > 0
    ? `\n- Google Reviews: ${adData.reviewCount} reviews (${adData.rating ? adData.rating.toFixed(1) : ''}★)`
    : '';
  const locationInfo = adData.address ? `\n- Clinic Location: ${adData.address}` : '';

  const prompt = `
${systemPrompt}

Target Business & Ad Data:
- Business Name: ${adData.businessName}
- Active Ad Offer: ${adData.adOffer}
- Landing Page URL: ${adData.landingPage || 'Standard landing page'}${reviewsInfo}${locationInfo}
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

        const hasBanned = BANNED_PHRASES.some((p) => pitchLower.includes(p));
        const placeholders = detectPlaceholders(pitch);
        const sentences = countSentences(pitch);

        if (!hasBanned && placeholders.length === 0 && sentences <= 3) {
          return {
            draft_pitch: pitch,
            identified_problem: parsed.identified_problem || frictionText,
          };
        } else {
          console.warn(`[Meta Ads Pipeline] AI pitch failed tone checks (Attempt ${attempt}):`, {
            hasBanned,
            placeholders,
            sentences,
          });
        }
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      const isRateLimit =
        errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('RESOURCE_EXHAUSTED');

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

  // Deterministic fallback pitch matching the exact peer-to-peer tone
  const fallbackPitch = `Hey, saw your active Instagram ad for ${adData.adOffer || adData.businessName}. Are incoming leads going to that standard form on your site or straight to WhatsApp? A lot of ad traffic drops off on forms — routing clickers straight into an automated WhatsApp booking flow usually doubles the booked consults without raising your ad budget.`;

  return {
    draft_pitch: fallbackPitch,
    identified_problem: frictionText,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    const body: MetaAdsScrapeRequest = await req.json().catch(() => ({}));
    const searchQuery = (body.searchQuery || DEFAULT_SEARCH_QUERY).trim();
    const maxAds = Math.min(Math.max(1, body.maxAds || 5), 15);

    let rawItems: any[] = [];

    // 1. Fast Test Mode or Apify Actor Execution
    if (body.testMode === true) {
      console.log('[Meta Ads Pipeline] Running Fast Test with verified Meta ad samples...');
      rawItems = [
        {
          pageName: "Luxe Skin & Aesthetics Delhi",
          pageProfilePicture: "",
          adCreativeBody: "Special Offer: 40% OFF HydraFacial & Laser Hair Reduction this week in South Delhi! Book via WhatsApp at +91 98112 34567.",
          adSnapshotUrl: "https://www.facebook.com/ads/library/?id=act_1010101",
          linkUrl: "https://luxeskinclinic.in",
          adDeliveryStartDate: new Date().toISOString(),
          category: "Health/beauty"
        },
        {
          pageName: "Apex Dental Implant Clinic South Delhi",
          pageProfilePicture: "",
          adCreativeBody: "Permanent Dental Implants starting at ₹19,999. Free consultation & 0% EMI options. Call or WhatsApp +91 98188 76543.",
          adSnapshotUrl: "https://www.facebook.com/ads/library/?id=act_1010102",
          linkUrl: "https://apexdentaldelhi.com",
          adDeliveryStartDate: new Date().toISOString(),
          category: "Dentist & Dental Clinic"
        }
      ];
    } else if (body.runActor === true || (Array.isArray(body.items) && body.items.length === 0 && !body.items)) {
      if (!apifyToken) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MISSING_APIFY_TOKEN',
              message: 'APIFY_API_TOKEN is required to scrape active Meta ads.',
            },
          },
          { status: 400 }
        );
      }

      console.log(`[Meta Ads Pipeline] Querying Meta Ad Library for "${searchQuery}" (limit: ${maxAds})...`);
      const client = new ApifyClient({ token: apifyToken });

      const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IN&q=${encodeURIComponent(searchQuery)}&search_type=keyword_unordered&media_type=all`;

      const actorInput = {
        startUrls: [{ url: adLibraryUrl }],
        searchTerms: [searchQuery],
        countryCode: 'IN',
        adActiveStatus: 'ACTIVE',
        activeStatus: 'active',
        resultsLimit: maxAds,
        maxItems: maxAds,
        includeAboutPage: true,
        isDetailsPerAd: true,
      };

      const run = await client.actor('apify/facebook-ads-scraper').call(actorInput);
      console.log(`[Meta Ads Pipeline] Apify run completed with status: ${run.status}`);

      const dataset = client.dataset(run.defaultDatasetId);
      const { items } = await dataset.listItems();
      rawItems = items;
    } else {
      rawItems = Array.isArray(body.items) ? body.items : [];
    }

    if (rawItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No active Meta ads found for "${searchQuery}".`,
        total_ingested: 0,
        duplicates_skipped: 0,
        evaluated: 0,
        qualified_leads_count: 0,
        leads: []
      });
    }

    console.log(`[Meta Ads Pipeline] Processing ${rawItems.length} raw ad records...`);

    // 2. Load Existing Leads for Deduplication (Supabase + local leads.json)
    const trackedUrls = new Set<string>();
    const trackedPhones = new Set<string>();
    const trackedBusinessNames = new Map<string, Lead>();

    try {
      const { data: dbLeads } = await supabase
        .from('leads')
        .select('id, business_name, title, source_url, phone_number, prospect_score, website_url, address, rating, review_count, body_text');

      if (dbLeads) {
        dbLeads.forEach((l) => {
          if (l.source_url) trackedUrls.add(l.source_url.toLowerCase().trim());
          if (l.phone_number) {
            const normPhone = normalizePhoneNumber(l.phone_number);
            if (normPhone) trackedPhones.add(normPhone);
          }
          const normName = normalizeBusinessName(l.business_name || l.title);
          if (normName) trackedBusinessNames.set(normName, l as Lead);
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
            if (l.phone_number) {
              const normPhone = normalizePhoneNumber(l.phone_number);
              if (normPhone) trackedPhones.add(normPhone);
            }
            const normName = normalizeBusinessName(l.business_name || l.title);
            if (normName) trackedBusinessNames.set(normName, l);
          });
        }
      } catch (e) {
        console.warn('Could not parse local data/leads.json:', e);
      }
    }

    // 3. Data Normalization, Phone Extraction & Business Niche Derivation
    const candidates: MetaLeadCandidate[] = [];

    let duplicatesCount = 0;

    for (const raw of rawItems) {
      // Extract business name (Page name)
      const businessName = (
        raw.pageName ||
        raw.snapshot?.pageName ||
        raw.pageTitle ||
        raw.businessName ||
        raw.publisherName ||
        raw.title ||
        ''
      ).trim();

      if (!businessName) continue;

      const normalizedBusiness = normalizeBusinessName(businessName);

      // Extract landing page / destination website
      const rawDestinationUrl = (
        raw.snapshot?.linkUrl ||
        raw.snapshot?.cards?.[0]?.linkUrl ||
        raw.linkUrl ||
        raw.link_url ||
        raw.website ||
        raw.websiteUrl ||
        (raw.url && !raw.url.includes('facebook.com') ? raw.url : undefined)
      );

      // Bug 1 Fix: Separate real websites from WhatsApp / Facebook links
      let websiteUrl: string | undefined = undefined;
      let phoneFromDestination: string | undefined = undefined;

      if (rawDestinationUrl) {
        if (isWhatsAppOrSocialUrl(rawDestinationUrl)) {
          phoneFromDestination = extractPhoneFromWhatsAppUrl(rawDestinationUrl);
          websiteUrl = undefined; // Will be filled by Google Places lookup if available
        } else {
          websiteUrl = rawDestinationUrl.trim();
        }
      }

      // Extract ad archive or reference URL
      const adArchiveId = raw.adArchiveID || raw.adArchiveId || raw.adId || raw.id;
      const sourceUrl = (
        raw.url ||
        raw.adSnapshotUrl ||
        (adArchiveId ? `https://www.facebook.com/ads/library/?id=${adArchiveId}` : '') ||
        websiteUrl ||
        `https://www.facebook.com/ads/library/?q=${encodeURIComponent(businessName)}`
      ).trim();

      const urlKey = sourceUrl.toLowerCase();

      // Extract ad copy & offer
      const adCopy = (
        raw.snapshot?.body?.text ||
        raw.snapshot?.caption ||
        raw.snapshot?.cards?.[0]?.body ||
        raw.ad_copy ||
        raw.body_text ||
        raw.body ||
        ''
      ).trim();

      const adOffer = (
        raw.snapshot?.title ||
        raw.snapshot?.cards?.[0]?.title ||
        raw.title ||
        raw.snapshot?.linkDescription ||
        adCopy.slice(0, 80) ||
        `${searchQuery} offer`
      ).trim();

      // Phone Extraction Strategy:
      // 1. Check ad copy, title, or destination WhatsApp link for Indian phone
      let extractedPhone =
        extractIndianPhoneFromText(adCopy) ||
        extractIndianPhoneFromText(raw.snapshot?.title) ||
        phoneFromDestination;

      // 2. Fallback: Fetch destination landing page HTML and scan for wa.me / phone strings
      let hasDirectWhatsApp = Boolean(
        phoneFromDestination ||
        (rawDestinationUrl && /wa\.me|whatsapp\.com/i.test(rawDestinationUrl))
      );

      if (!extractedPhone && websiteUrl) {
        const enriched = await fetchLandingPagePhoneAndFriction(websiteUrl);
        if (enriched.phone) {
          extractedPhone = enriched.phone;
        }
        if (enriched.hasDirectWhatsApp) {
          hasDirectWhatsApp = true;
        }
      }

      const normalizedPhone = normalizePhoneNumber(extractedPhone);
      const instagramUrl = extractInstagramUrl(raw);

      // --- Deduplication Check: Current Batch ---
      const existingCandidateIndex = candidates.findIndex((c) => {
        const cNormName = normalizeBusinessName(c.business_name);
        const cNormPhone = c.phone_number ? normalizePhoneNumber(c.phone_number) : undefined;
        const nameMatch = normalizedBusiness && cNormName && (
          cNormName === normalizedBusiness ||
          (cNormName.length >= 4 && normalizedBusiness.length >= 4 && (cNormName.includes(normalizedBusiness) || normalizedBusiness.includes(cNormName)))
        );
        const phoneMatch = Boolean(normalizedPhone && cNormPhone && cNormPhone === normalizedPhone);
        return Boolean(nameMatch || phoneMatch);
      });

      if (existingCandidateIndex !== -1) {
        duplicatesCount++;
        const existing = candidates[existingCandidateIndex];

        // Merge ad info: retain strongest ad copy / offer
        if (adCopy && (!existing.ad_copy || adCopy.length > existing.ad_copy.length)) {
          existing.ad_copy = adCopy;
        }
        if (adOffer && (!existing.ad_offer || adOffer.length > existing.ad_offer.length)) {
          existing.ad_offer = adOffer;
        }
        if (!existing.ad_variations) existing.ad_variations = [];
        if (adOffer && !existing.ad_variations.includes(adOffer)) {
          existing.ad_variations.push(adOffer);
        }
        if (!existing.phone_number && normalizedPhone) {
          existing.phone_number = normalizedPhone;
        }
        if (!existing.website_url && websiteUrl) {
          existing.website_url = websiteUrl;
        }
        if (!existing.instagram_url && instagramUrl) {
          existing.instagram_url = instagramUrl;
        }
        continue;
      }

      // --- Deduplication Check: Supabase & Local leads.json (bypassed in testMode) ---
      const isAlreadyInDbOrLocal = Boolean(
        (normalizedBusiness && trackedBusinessNames.has(normalizedBusiness)) ||
        (normalizedPhone && trackedPhones.has(normalizedPhone)) ||
        (sourceUrl && trackedUrls.has(urlKey))
      );

      if (isAlreadyInDbOrLocal && !body.testMode) {
        duplicatesCount++;
        continue;
      }

      // Dynamic Business Niche Classification (never UNKNOWN)
      const rawCategory = (Array.isArray(raw.categories) && raw.categories[0]) || raw.categoryName;
      const businessType = deriveBusinessType({
        searchQuery,
        rawCategory,
        adCopy,
        adOffer,
        businessName,
      });

      // Custom friction points for active paid advertisers
      const customFriction: string[] = [];
      if (!hasDirectWhatsApp) {
        customFriction.push('Ad traffic routed to standard contact form without direct 1-click WhatsApp booking button');
        customFriction.push('Ad spend at risk: high clicker drop-off on static web forms');
      } else {
        customFriction.push('High ad traffic volume without 24/7 automated inquiry qualification');
      }

      const candidateData: Partial<Lead> = {
        business_name: businessName,
        business_type: businessType,
        source_url: sourceUrl,
        phone_number: normalizedPhone || extractedPhone,
        website_url: websiteUrl,
        instagram_url: instagramUrl,
        has_active_ads: true, // Guaranteed +3 pts
        audit_friction_points: customFriction,
      };

      // Initial Scorecard calculation
      const scorecard = calculateProspectScore(candidateData);

      if (sourceUrl) trackedUrls.add(urlKey);
      if (normalizedPhone) trackedPhones.add(normalizedPhone);
      if (normalizedBusiness) trackedBusinessNames.set(normalizedBusiness, candidateData as any);

      candidates.push({
        business_name: businessName,
        source_url: sourceUrl,
        website_url: websiteUrl,
        instagram_url: instagramUrl,
        phone_number: normalizedPhone || extractedPhone,
        ad_offer: adOffer,
        ad_copy: adCopy,
        ad_variations: [adOffer],
        business_type: businessType,
        frictionPoints: scorecard.frictionPoints,
        scorecard,
      });
    }

    console.log(`[Meta Ads Pipeline] Normalization complete. ${candidates.length} candidates (${duplicatesCount} duplicates skipped).`);

    // 4. Unified Auto-Enrichment: Background Google Places Lookup & Scorecard Recalculation
    if (candidates.length > 0) {
      console.log(`[Meta Ads Pipeline] Triggering Google Places enrichment for ${candidates.length} candidates...`);
      await enrichMetaCandidatesWithGooglePlaces(candidates, apifyToken, localLeads, Boolean(body.testMode));
    }

    // 5. Gemini 2.5 Flash Pitch Generation
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

    await Promise.all(
      candidates.map(async (cand) => {
        const { scorecard } = cand;
        let draftPitch = '';
        let identifiedProblem = cand.frictionPoints.join('; ');

        if (scorecard.score >= 6 && geminiModel) {
          try {
            console.log(`[Meta Ads Pipeline] Generating pitch for "${cand.business_name}" (${scorecard.recommendedService}, Score: ${scorecard.score}/10)...`);
            const pitchRes = await generateMetaAdPitchWithGemini(geminiModel, {
              businessName: cand.business_name,
              adOffer: cand.ad_offer,
              landingPage: cand.website_url,
              frictionPoints: cand.frictionPoints,
              rating: cand.rating,
              reviewCount: cand.review_count,
              address: cand.address,
              recommendedService: scorecard.recommendedService,
            });

            if (pitchRes) {
              draftPitch = pitchRes.draft_pitch;
              identifiedProblem = pitchRes.identified_problem;
            }
          } catch (e: any) {
            console.warn(`[Meta Ads Pipeline] Gemini pitch fallback for "${cand.business_name}":`, e.message);
          }
        }

        if (!draftPitch) {
          switch (scorecard.recommendedService) {
            case 'booking_automation':
              draftPitch = `Hey, saw your active Instagram ad for ${cand.ad_offer || cand.business_name}. Directing high-intent ad clickers to telephone lines often loses bookings after hours — a self-serve calendar booking link usually captures double the consults.`;
              break;
            case 'website_development':
              draftPitch = `Hey, saw your active Instagram ad for ${cand.ad_offer || cand.business_name}. Noticed traffic lands on a slow or non-responsive page — upgrading to a fast mobile web application eliminates clicker bounce and boosts conversions.`;
              break;
            default:
              draftPitch = `Hey, saw your active Instagram ad for ${cand.ad_offer || cand.business_name}. Are incoming leads going to that standard form on your site or straight to an instant inquiry route? A lot of ad traffic drops off on forms — instant qualification usually doubles consults without raising your ad budget.`;
              break;
          }
        }

        let handleOrPage = cand.business_name;
        if (cand.instagram_url) {
          const igMatch = cand.instagram_url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
          if (igMatch && igMatch[1]) {
            handleOrPage = `@${igMatch[1]}`;
          }
        }

        const reviewsText = typeof cand.review_count === 'number' && cand.review_count > 0
          ? ` Rating: ${cand.rating ? cand.rating.toFixed(1) : ''}★ (${cand.review_count} reviews).`
          : '';
        const addressText = cand.address ? ` Address: ${cand.address}.` : '';

        const variationsText = cand.ad_variations && cand.ad_variations.length > 1
          ? ` Ad Variations: ${cand.ad_variations.slice(0, 3).join(' | ')}.`
          : '';

        const leadRecord: Lead = {
          id: crypto.randomUUID(),
          source_platform: 'meta_ads',
          source_url: cand.source_url,
          author: cand.business_name,
          subreddit_or_handle: handleOrPage,
          title: cand.business_name,
          body_text: `Active Meta Ad: "${cand.ad_offer}". Ad copy: ${cand.ad_copy || 'Active sponsored campaign'}.${variationsText}${reviewsText}${addressText} Landing page: ${cand.website_url || 'None'}. Phone: ${cand.phone_number || 'None'}.`,
          identified_problem: identifiedProblem,
          business_type: cand.business_type,
          confidence_score: scorecard.score,
          draft_pitch: draftPitch,
          status: 'new',
          created_at: new Date().toISOString(),

          // Local & Meta Ads prospecting properties
          business_name: cand.business_name,
          phone_number: cand.phone_number,
          website_url: cand.website_url,
          instagram_url: cand.instagram_url,
          google_maps_url: cand.google_maps_url,
          address: cand.address,
          rating: cand.rating,
          review_count: cand.review_count,
          has_active_ads: true,
          prospect_score: scorecard.score,
          audit_friction_points: cand.frictionPoints,
          direct_contact_channel: cand.phone_number ? 'whatsapp' : 'email',
          recommended_service: scorecard.recommendedService,
        };

        qualifiedLeads.push(leadRecord);
      })
    );

    // 6. Database Upsert & Local JSON Backup
    if (qualifiedLeads.length > 0) {
      // 6a. Upsert into Supabase
      try {
        const { error: sbError } = await supabase
          .from('leads')
          .upsert(qualifiedLeads, { onConflict: 'source_url' });

        if (sbError) {
          console.error('[Meta Ads Pipeline] Supabase upsert error:', sbError.message);
        } else {
          console.log(`[Meta Ads Pipeline] Successfully upserted ${qualifiedLeads.length} leads to Supabase.`);
        }
      } catch (sbErr: any) {
        console.error('[Meta Ads Pipeline] Exception during Supabase upsert:', sbErr.message);
      }

      // 6b. Append to local data/leads.json
      try {
        const seenBiz = new Set<string>();
        const seenUrls = new Set<string>();
        const dedupedLocal: Lead[] = [];

        for (const l of [...qualifiedLeads, ...localLeads]) {
          if (l.source_platform === 'reddit') {
            const urlKey = (l.source_url || '').toLowerCase().trim();
            if (urlKey && seenUrls.has(urlKey)) continue;
            if (urlKey) seenUrls.add(urlKey);
            dedupedLocal.push(l);
          } else {
            const bizKey = normalizeBusinessName(l.business_name || l.title);
            if (bizKey && seenBiz.has(bizKey)) continue;
            if (bizKey) seenBiz.add(bizKey);
            const urlKey = (l.source_url || '').toLowerCase().trim();
            if (urlKey) seenUrls.add(urlKey);
            dedupedLocal.push(l);
          }
        }

        fs.mkdirSync(path.dirname(localLeadsPath), { recursive: true });
        fs.writeFileSync(localLeadsPath, JSON.stringify(dedupedLocal, null, 2), 'utf-8');
        console.log(`[Meta Ads Pipeline] Updated local backup ${localLeadsPath} (${dedupedLocal.length} total leads).`);
      } catch (fsErr: any) {
        console.error('[Meta Ads Pipeline] Failed to sync local data/leads.json:', fsErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      search_query: searchQuery,
      total_ingested: rawItems.length,
      duplicates_skipped: duplicatesCount,
      evaluated: candidates.length,
      qualified_leads_count: qualifiedLeads.length,
      leads: qualifiedLeads,
    });
  } catch (error: any) {
    console.error('[Meta Ads Pipeline] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'META_ADS_PIPELINE_ERROR',
          message: error.message || 'Meta Ads ingestion pipeline failed.',
        },
      },
      { status: 500 }
    );
  }
}
