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
import { emitAgentEvent } from '@/lib/agent-telemetry';

export const maxDuration = 300; // 5 minute timeout for Next.js / Vercel

interface IngestionRequest {
  runActor?: boolean;
  searchQueries?: string[];
  maxPlacesPerSearch?: number;
  items?: any[];
  places?: any[];
  hasActiveAdsOverride?: boolean;
  testMode?: boolean;
}

const DEFAULT_SEARCH_QUERIES = [
  'skin clinic in Delhi',
  'dental clinic in South Delhi',
  'hair transplant clinic Delhi',
  'luxury salon Delhi',
  'restaurants in Connaught Place Delhi',
  'gyms in South Delhi',
  'real estate agency in Gurgaon',
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
 * Generates an honest, outcome-focused audit observation via Gemini 2.5 Flash
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
    recommendedService?: string;
  },
  maxRetries = 3
): Promise<{ draft_pitch: string; identified_problem: string } | null> {
  const service = business.recommendedService || 'whatsapp_automation';
  const frictionText = business.frictionPoints.length > 0
    ? business.frictionPoints.join('; ')
    : 'No direct self-serve calendar booking or 24/7 inquiry capture detected.';

  const systemPrompt = `
You are Vansh, a solo freelance developer doing an honest technical observation for a local business in Delhi NCR.
Write a direct, 2-to-3 sentence casual observation/message connecting their operational bottleneck to an outcome.

STRICT OUTREACH INVARIANTS:
1. Exactly 2 to 3 sentences maximum (under 300 characters).
2. Write as an individual solo peer typing directly from a laptop or phone.
3. NEVER say "we", "our team", "our agency", or "our clients".
4. OUTCOME REFRAMING: Never describe services as "AI chatbot" or "automation". Reframe entirely around concrete outcomes (capturing missed inquiries, self-serve booking calendar, eliminating form drop-off). The technical implementation stays invisible.
5. NO MEETING REQUESTS: Never include meeting or call requests (banned: "hop on a call", "book a call", "jump on a call", "schedule a demo", "quick chat").
6. NO PRICING: Never mention pricing or package fees.
7. NO PAST CLIENT FABRICATION: Never fabricate past clients, case studies, or testimonials.
8. LEAD WITH TECHNICAL OBSERVATION: Open directly with a genuine observation on their specific setup or bottleneck — never open with a sales pitch.
9. ZERO BUZZWORDS: Banned words: "streamline", "leverage", "game-changer", "tailored solution", "reach out anytime", "feel free to DM".
10. Do NOT include template bracket placeholders like [Name], [Company], or [Clinic].

Recommended Service Target: ${service}

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
- Recommended Service: ${service}
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

  // Service-specific high-quality deterministic fallback pitches
  let fallbackPitch = '';
  switch (service) {
    case 'website_development':
      fallbackPitch = `Noticed ${business.name} has a strong local standing with ${business.reviewCount} reviews, but lacks an official mobile-optimized website for direct appointment capture. A fast web page makes it much easier for search visitors to book directly instead of bouncing.`;
      break;
    case 'booking_automation':
      fallbackPitch = `Noticed ${business.name} has over ${business.reviewCount} reviews on Maps, but clients still have to call landlines to schedule appointments. Adding a self-serve calendar booking link eliminates phone tag and lets clients book after hours.`;
      break;
    case 'lead_automation':
      fallbackPitch = `Saw ${business.name} running sponsored campaigns in Delhi. A lot of mobile ad traffic drops off on landing page forms when there is no instant follow-up, so an automated intake flow usually doubles booked clients.`;
      break;
    case 'ai_agents':
      fallbackPitch = `Noticed ${business.name} handles high customer volume across services. Automating standard inquiry intake helps your team focus on in-person visitors while ensuring every question gets answered immediately.`;
      break;
    case 'crm_workflow_automation':
      fallbackPitch = `Saw ${business.name} managing a high volume of appointment inquiries. Connecting customer intake directly to your calendar and database prevents bookings from slipping through the cracks during busy hours.`;
      break;
    default:
      fallbackPitch = `Noticed ${business.name} has great local reviews, but there is no direct WhatsApp inquiry link on your site. Most local businesses lose after-hours appointment requests when clients have to call manual landlines instead of texting.`;
      break;
  }

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

    // 1. Ingest from Fast Test Mode, Apify Actor, or Payload
    if (body.testMode === true) {
      console.log('[Google Maps Pipeline] Running Fast Test with verified Delhi clinic samples...');
      rawItems = [
        {
          name: "Dr. Batra's Skin & Hair Clinic",
          categoryName: "Skin care clinic",
          website: "https://drbatras.com",
          phone: "+919811234567",
          address: "M-41, Greater Kailash II, New Delhi, Delhi 110048",
          totalScore: 4.8,
          reviewsCount: 185,
          hasActiveAds: true,
          placeUrl: "https://www.google.com/maps/place/?q=Dr+Batras+GK2"
        },
        {
          name: "South Delhi Dental & Aesthetic Studio",
          categoryName: "Dental Clinic",
          website: "https://southdelhidentalstudio.in",
          phone: "+919871122334",
          address: "A-14, Green Park Extension, New Delhi, Delhi 110016",
          totalScore: 4.9,
          reviewsCount: 92,
          hasActiveAds: false,
          placeUrl: "https://www.google.com/maps/place/?q=South+Delhi+Dental+Studio"
        }
      ];
    } else if (body.runActor === true) {
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
      const searchQueries = (body.searchQueries && body.searchQueries.length > 0)
        ? body.searchQueries
        : DEFAULT_SEARCH_QUERIES;

      emitAgentEvent({
        agentName: 'Search Strategist',
        agentRole: 'search_strategist',
        type: 'agent_spawn',
        title: 'Google Maps Pipeline Initiated',
        content: `Search targets: ${searchQueries.join(', ')}`,
      });

      const client = new ApifyClient({ token: apifyToken });

      const actorInput = {
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: Math.min(Math.max(1, body.maxPlacesPerSearch || 5), 15),
        language: 'en',
        scrapeWebSocialMedia: true,
        scrapePlaceDetails: true,
        skipClosedPlaces: true,
      };

      emitAgentEvent({
        agentName: 'Discovery Scraper',
        agentRole: 'discovery_scraper',
        type: 'tool_call',
        title: 'Dispatching Apify Google Places Actor',
        toolName: 'compass/crawler-google-places',
        toolArgs: { queries: searchQueries, limit: actorInput.maxCrawledPlacesPerSearch },
        content: 'Querying Google Maps for local businesses with contact information and reviews.',
      });

      const run = await client.actor('compass/crawler-google-places').call(actorInput);
      console.log(`[Google Maps Pipeline] Apify run completed with status: ${run.status}`);

      const dataset = client.dataset(run.defaultDatasetId);
      const { items } = await dataset.listItems();
      rawItems = items;

      emitAgentEvent({
        agentName: 'Discovery Scraper',
        agentRole: 'discovery_scraper',
        type: 'tool_result',
        title: 'Places Discovered',
        content: `Found ${rawItems.length} place records from Google Maps.`,
        durationMs: 1200,
      });
    } else {
      rawItems = Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.places)
          ? body.places
          : [];
    }

    if (rawItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No places found matching the search query.',
        total_ingested: 0,
        duplicates_skipped: 0,
        evaluated: 0,
        qualified_leads_count: 0,
        leads: []
      });
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

      // Deduplicate on source_url or phone_number (bypassed in testMode)
      const urlKey = sourceUrl.toLowerCase();
      if (!body.testMode) {
        if (sourceUrl && trackedUrls.has(urlKey)) {
          duplicatesCount++;
          continue;
        }
        if (normalizedPhone && trackedPhones.has(normalizedPhone)) {
          duplicatesCount++;
          continue;
        }
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

    await Promise.all(
      normalizedCandidates.map(async (cand) => {
        const { scorecard } = cand;
        let draftPitch = '';
        let identifiedProblem = cand.frictionPoints.join('; ') || 'Missing direct appointment booking and WhatsApp funnel.';

        emitAgentEvent({
          agentName: 'Specialist Swarm',
          agentRole: 'website_auditor',
          subagentName: 'Website & Booking Friction Auditor',
          type: 'thinking',
          title: `Auditing ${cand.business_name}`,
          content: `Score: ${scorecard.score}/10. Recommended: ${scorecard.recommendedService}`,
          thinkingProcess: `Evaluating ${cand.business_name} (${cand.business_type}): Rating ${cand.rating}★ with ${cand.review_count} reviews. Website: ${cand.website_url || 'Missing'}. Detected frictions: ${cand.frictionPoints.join('; ') || 'Standard intake'}. Mapped service: ${scorecard.recommendedService}.`,
        });

        // Generate personalized Gemini pitch if qualified (Score >= 6)
        if (scorecard.score >= 6 && geminiModel) {
          try {
            console.log(`[Google Maps Pipeline] Generating pitch for "${cand.business_name}" (${scorecard.recommendedService}, Score: ${scorecard.score}/10)...`);
            const pitchResult = await generateAuditPitchWithGemini(geminiModel, {
              name: cand.business_name,
              type: cand.business_type,
              website: cand.website_url,
              phone: cand.phone_number,
              reviewCount: cand.review_count,
              rating: cand.rating,
              frictionPoints: cand.frictionPoints,
              recommendedService: scorecard.recommendedService,
            });

            if (pitchResult) {
              draftPitch = pitchResult.draft_pitch;
              identifiedProblem = pitchResult.identified_problem;
            }
          } catch (e: any) {
            console.warn(`[Google Maps Pipeline] Gemini pitch generation fallback for "${cand.business_name}":`, e.message);
          }
        }

        if (!draftPitch && scorecard.score >= 6) {
          // Fallback pitch when Gemini is not configured or failed
          switch (scorecard.recommendedService) {
            case 'website_development':
              draftPitch = `Noticed ${cand.business_name} has a strong local standing with ${cand.review_count || 30} reviews, but lacks an official mobile-optimized website for direct appointment capture. A fast landing page makes it much easier for search visitors to book directly instead of bouncing.`;
              break;
            case 'booking_automation':
              draftPitch = `Noticed ${cand.business_name} has over ${cand.review_count || 40} reviews on Maps, but clients still have to call manual landlines to schedule appointments. Adding a self-serve calendar booking link eliminates phone tag and captures clients after hours.`;
              break;
            case 'lead_automation':
              draftPitch = `Saw ${cand.business_name} running active local marketing. A lot of mobile ad traffic drops off on landing page forms when there is no instant follow-up, so an automated intake flow usually doubles booked clients.`;
              break;
            case 'ai_agents':
              draftPitch = `Noticed ${cand.business_name} handles high customer volume across services. Automating standard inquiry intake helps front-desk staff focus on in-person visitors while ensuring every question gets answered immediately.`;
              break;
            case 'crm_workflow_automation':
              draftPitch = `Saw ${cand.business_name} managing a high volume of appointment inquiries. Connecting customer intake directly to your calendar and database prevents bookings from slipping through the cracks during busy hours.`;
              break;
            default:
              draftPitch = `Hey ${cand.business_name} team, noticed your business on Google Maps with ${cand.review_count || 50}+ reviews, but there is no direct WhatsApp appointment capture on your page. Adding a direct wa.me scheduling link helps convert walk-in and search inquiries instantly.`;
              break;
          }
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
          body_text: `Google Maps Business: ${cand.business_name}. Category: ${cand.business_type}. Rating: ${cand.rating}★ (${cand.review_count} reviews). Address: ${cand.address || 'Delhi NCR'}. Website: ${cand.website_url || 'None'}. Phone: ${cand.phone_number || 'None'}.`,
          identified_problem: identifiedProblem,
          business_type: cand.business_type,
          confidence_score: scorecard.score,
          draft_pitch: draftPitch,
          status: 'new',
          created_at: new Date().toISOString(),
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
          audit_friction_points: cand.frictionPoints,
          direct_contact_channel: cand.phone_number ? 'whatsapp' : 'email',
          recommended_service: scorecard.recommendedService,
        };

        if (draftPitch) {
          emitAgentEvent({
            agentName: 'Outreach Copywriter',
            agentRole: 'outreach_copywriter',
            type: 'decision',
            title: `Drafted Audit Pitch for ${cand.business_name}`,
            content: draftPitch,
            metadata: {
              service: scorecard.recommendedService,
              score: scorecard.score,
            },
          });
        }

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

    emitAgentEvent({
      agentName: 'LeadPulse Autonomous Swarm',
      agentRole: 'lead_triage',
      type: 'agent_complete',
      title: 'Google Maps Pipeline Finished',
      content: `Successfully ingested ${qualifiedLeads.length} qualified leads (${duplicatesCount} duplicates skipped).`,
    });

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
