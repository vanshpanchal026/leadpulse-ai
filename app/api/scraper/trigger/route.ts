import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types/lead';
import { evaluatePostWithPreFilter } from '@/lib/pre-filter';
import { validateLeadOutput } from '@/lib/anti-spam-validator';

export const maxDuration = 300; // 5 minute timeout for Next.js / Vercel

interface ScrapeRequest {
  subreddits?: string[];
  keywords?: string[];
  maxPosts?: number;
}

const DEFAULT_SUBREDDITS = [
  'smallbusiness',
  'smallbusinessowners',
  'restaurantowners',
  'realtors',
  'shopify',
];

const DEFAULT_KEYWORDS = [
  'missed calls',
  'after hours',
  'too many messages',
  'double booking',
  'scheduling',
];

const SYSTEM_PROMPT = `
You are an expert lead qualification consultant evaluating small business pain for Vansh, an automation consultant.
Vansh's services focus on:
- Capturing after-hours customer inquiries (WhatsApp / Web)
- Automated calendar scheduling and appointment booking
- Connecting incoming leads directly to spreadsheets or CRMs
- Eliminating manual customer message handling

TARGET CLIENTS:
Real businesses with active customer inquiry volume (approx. 5-20+ staff or consistent transaction flow, e.g. clinics, real estate agencies, salons, contractors, local services, e-commerce stores).

STRICT RULES:
1. NEVER fabricate past clients (e.g. NEVER say "I recently built this for someone else" or make up testimonials).
2. RULES FOR recommended_first_message (STRICT ANTI-SPAM):
   - Write as an individual peer typing a casual reply from a laptop or phone — NEVER as an agency or business.
   - BANNED WORDS/PHRASES (Strict zero-tolerance):
     * "We help...", "We specialize in..."
     * "Would you be open to a quick/brief chat?"
     * "Our team", "Our clients", "Reach out anytime"
     * "Game-changer", "Streamline", "Leverage", "Tailored solution"
     * Placeholder tags like "[Name]" or "[Company]"
   - TONE & STRUCTURE:
     * 2 to 3 sentences maximum.
     * Start with a direct observation or question about their specific setup (e.g. "Are you running this off the standard WhatsApp app or using webhooks?").
     * Share a direct technical tip or blueprint on how to solve the friction without pitching a service.
     * Casual sign-off or leave it open-ended without asking for a meeting/call.
3. Only flag "is_potential_lead: true" if the poster represents an active operational business experiencing customer communication, scheduling, or inquiry bottlenecks that automation/WhatsApp/calendar can solve.
4. REJECT: Freelancers advertising services ([FOR HIRE]), software developers seeking feedback, rants with no operational business, students, or dropshippers without sales.

Return strictly valid JSON matching this schema:
{
  "is_potential_lead": boolean,
  "business_type": string,
  "identified_problem": string,
  "recommended_first_message": string,
  "confidence_score": number
}
where confidence_score is an integer from 1 to 10 (10 = immediate high-intent fit).
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluateWithGemini(
  model: any,
  post: { subreddit: string; keyword: string; title: string; body: string; url: string },
  maxRetries = 3
): Promise<{
  is_potential_lead: boolean;
  business_type: string;
  identified_problem: string;
  recommended_first_message: string;
  confidence_score: number;
} | null> {
  const prompt = `${SYSTEM_PROMPT}

Candidate Reddit Post:
- Subreddit: r/${post.subreddit}
- Matched Keyword: ${post.keyword}
- Title: ${post.title}
- URL: ${post.url}
- Post Content:
${post.body || post.title}
`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await model.generateContent(prompt);
      const rawText = res.response.text();
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err: any) {
      const errMsg = err.message || '';
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < maxRetries) {
        const delayMatch = errMsg.match(/retry in ([0-9.]+)s/i);
        const waitSec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) + 2 : 12 * attempt;
        console.warn(`⏳ Gemini rate limit encountered. Backing off ${waitSec}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(waitSec * 1000);
      } else {
        console.error(`Gemini evaluation error (attempt ${attempt}):`, errMsg);
        if (attempt === maxRetries) return null;
      }
    }
  }
  return null;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return true;
  }
  const internalSecret = req.headers.get('x-internal-secret');
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  return internalSecret === secret || bearerToken === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized: Invalid or missing internal API secret.',
          },
        },
        { status: 401 }
      );
    }

    const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!apifyToken) {
      return NextResponse.json(
        { success: false, error: 'Missing APIFY_API_TOKEN in environment configuration.' },
        { status: 500 }
      );
    }

    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing GEMINI_API_KEY in environment configuration.' },
        { status: 500 }
      );
    }

    const body: ScrapeRequest = await req.json().catch(() => ({}));
    const subreddits = (body.subreddits && body.subreddits.length > 0)
      ? body.subreddits.map((s) => s.replace(/^r\//, '').trim())
      : DEFAULT_SUBREDDITS;
    const keywords = (body.keywords && body.keywords.length > 0)
      ? body.keywords
      : DEFAULT_KEYWORDS;
    // Strictly bound maxPosts between 5 and 30 for budget protection (< $0.30)
    const maxPosts = Math.min(Math.max(5, Number(body.maxPosts) || 20), 30);

    console.log(`[Scraper Pipeline] Starting search across ${subreddits.length} subreddits and ${keywords.length} keywords (target max: ${maxPosts} posts)...`);

    // 1. Construct Apify Search URLs
    const startUrls: { url: string; userData: { subreddit: string; keyword: string } }[] = [];
    for (const sub of subreddits) {
      for (const kw of keywords) {
        const qEnc = encodeURIComponent(kw);
        const url = `https://www.reddit.com/r/${sub}/search/?q=${qEnc}&sort=new&restrict_sr=1`;
        startUrls.push({
          url,
          userData: {
            subreddit: sub,
            keyword: kw,
          },
        });
      }
    }

    // Limit startUrls per run to avoid excessive queries if user selected many combinations
    const selectedStartUrls = startUrls.slice(0, 30);
    const postsPerUrl = Math.max(1, Math.ceil(maxPosts / selectedStartUrls.length));

    // 2. Trigger Apify Actor: trudax/reddit-scraper-lite
    const client = new ApifyClient({ token: apifyToken });
    const actorInput = {
      startUrls: selectedStartUrls,
      skipComments: true,
      includeMediaLinks: false,
      maxPostCount: postsPerUrl,
      maxItems: maxPosts,
      sort: 'new',
      proxy: {
        useApifyProxy: true,
      },
    };

    console.log('[Scraper Pipeline] Launching Apify actor trudax/reddit-scraper-lite...');
    const run = await client.actor('trudax/reddit-scraper-lite').call(actorInput);
    console.log(`[Scraper Pipeline] Apify run completed: ${run.id} with status ${run.status}`);

    const dataset = client.dataset(run.defaultDatasetId);
    const { items } = await dataset.listItems();
    console.log(`[Scraper Pipeline] Fetched ${items.length} raw items from Apify dataset.`);

    // 3. Local Pre-Filter (Stage 2 Triage: Obvious Reject vs. Candidate)
    // Load existing URLs from Supabase for deduplication
    const trackedUrls = new Set<string>();
    try {
      const { data: dbLeads } = await supabase.from('leads').select('source_url');
      if (dbLeads) {
        dbLeads.forEach((l) => {
          if (l.source_url) trackedUrls.add(l.source_url);
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Could not query existing leads from Supabase:', e.message);
    }

    // Also load existing URLs from local leads.json backup
    const localLeadsPath = path.join(process.cwd(), 'data', 'leads.json');
    let localLeads: Lead[] = [];
    if (fs.existsSync(localLeadsPath)) {
      try {
        const content = fs.readFileSync(localLeadsPath, 'utf-8');
        localLeads = JSON.parse(content);
        if (Array.isArray(localLeads)) {
          localLeads.forEach((l) => {
            if (l.source_url) trackedUrls.add(l.source_url);
          });
        }
      } catch (e) {
        console.warn('Could not parse local data/leads.json:', e);
      }
    }

    const candidatePosts: {
      subreddit: string;
      keyword: string;
      title: string;
      body: string;
      url: string;
      author: string;
      createdAt: string;
    }[] = [];

    let prefilterRejectCount = 0;

    for (const raw of items as any[]) {
      const title = (raw.title || '').trim();
      const bodyText = (raw.body || raw.selftext || '').trim();

      // Extract URL
      const url = raw.url || (raw.id ? `https://www.reddit.com/comments/${raw.id}` : '');
      if (!url || trackedUrls.has(url)) continue;

      let sub = raw.parsedCommunityName || raw.communityName || '';
      if (sub.startsWith('r/')) sub = sub.slice(2);
      if (!sub) sub = 'smallbusiness';

      // Run Stage 2 Local Pre-Filter
      const triage = evaluatePostWithPreFilter({
        title,
        body: bodyText,
        subreddit: sub,
      });

      if (!triage.isCandidate) {
        prefilterRejectCount++;
        continue;
      }

      let author = raw.parsedAuthor || raw.author || raw.username || 'u/reddit_user';
      if (!author.startsWith('u/') && !author.startsWith('@')) {
        author = `u/${author}`;
      }

      candidatePosts.push({
        subreddit: sub,
        keyword: triage.matchedKeyword || 'general inquiry',
        title,
        body: bodyText,
        url,
        author,
        createdAt: raw.createdAt || new Date().toISOString(),
      });

      // Cap candidates to maxPosts
      if (candidatePosts.length >= maxPosts) break;
    }

    console.log(`[Scraper Pipeline] Pre-filter dropped ${prefilterRejectCount} obvious rejects. Forwarding ${candidatePosts.length} candidates to Gemini.`);

    // 4. Gemini 2.5 Flash Evaluation
    const genAI = new GoogleGenerativeAI(geminiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const qualifiedLeads: Lead[] = [];
    let antiSpamBlockedCount = 0;

    for (let i = 0; i < candidatePosts.length; i++) {
      const post = candidatePosts[i];
      console.log(`[Scraper Pipeline] Evaluating (${i + 1}/${candidatePosts.length}): r/${post.subreddit} - "${post.title.slice(0, 40)}..."`);

      const evalResult = await evaluateWithGemini(geminiModel, post);

      if (evalResult) {
        // Run Code-Level Anti-Spam Validator
        const validation = validateLeadOutput(evalResult);

        if (validation.isValid) {
          const score = Math.min(10, Math.max(1, Number(evalResult.confidence_score) || 7));
          const lead: Lead = {
            id: crypto.randomUUID(),
            source_platform: 'reddit',
            source_url: post.url,
            author: post.author,
            subreddit_or_handle: `r/${post.subreddit}`,
            title: post.title,
            body_text: post.body || post.title,
            identified_problem: evalResult.identified_problem || 'Operational communication & booking bottleneck.',
            business_type: evalResult.business_type || 'Small Business',
            confidence_score: score,
            draft_pitch: validation.sanitizedPitch,
            status: 'new',
            created_at: post.createdAt,
          };

          qualifiedLeads.push(lead);
          trackedUrls.add(post.url);
          console.log(`   ✨ Qualified Lead! Score: ${lead.confidence_score}/10 | Type: ${lead.business_type}`);
          console.log(`   🛡️ Anti-Spam Check: PASSED (Sentences: ${validation.checks.length.sentenceCount}, Chars: ${validation.checks.length.charCount})`);
        } else {
          if (evalResult.is_potential_lead && Number(evalResult.confidence_score) >= 7) {
            antiSpamBlockedCount++;
            console.warn(`   ❌ Blocked by Code-Level Anti-Spam Validator:`);
            validation.errors.forEach((err) => console.warn(`      - ${err}`));
          } else {
            console.log(`   ⚪ Skipped (Score: ${evalResult?.confidence_score || 'N/A'})`);
          }
        }
      }

      // Brief delay between evaluations to respect rate limits
      if (i < candidatePosts.length - 1) {
        await sleep(1500);
      }
    }

    // 5. Auto-Persist Qualified Leads
    if (qualifiedLeads.length > 0) {
      // 5a. Upsert to Supabase
      try {
        const { error: sbError } = await supabase
          .from('leads')
          .upsert(qualifiedLeads, { onConflict: 'source_url' });

        if (sbError) {
          console.error('[Scraper Pipeline] Supabase upsert error:', sbError.message);
        } else {
          console.log(`[Scraper Pipeline] Successfully upserted ${qualifiedLeads.length} leads to Supabase.`);
        }
      } catch (sbErr: any) {
        console.error('[Scraper Pipeline] Exception during Supabase upsert:', sbErr.message);
      }

      // 5b. Append to local data/leads.json as offline backup
      try {
        // Ensure no duplicate source_urls in local backup
        const seen = new Set<string>();
        const dedupedLocal: Lead[] = [];
        for (const l of [...qualifiedLeads, ...localLeads]) {
          if (!seen.has(l.source_url)) {
            seen.add(l.source_url);
            dedupedLocal.push(l);
          }
        }

        fs.mkdirSync(path.dirname(localLeadsPath), { recursive: true });
        fs.writeFileSync(localLeadsPath, JSON.stringify(dedupedLocal, null, 2), 'utf-8');
        console.log(`[Scraper Pipeline] Saved ${dedupedLocal.length} total leads to offline backup ${localLeadsPath}`);
      } catch (fsErr: any) {
        console.error('[Scraper Pipeline] Failed to update local data/leads.json:', fsErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      total_scraped: items.length,
      prefilter_rejected: prefilterRejectCount,
      evaluated: candidatePosts.length,
      anti_spam_blocked: antiSpamBlockedCount,
      qualified: qualifiedLeads.length,
      leads: qualifiedLeads,
    });
  } catch (error: any) {
    console.error('[Scraper Pipeline] Fatal error during scrape execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Scraper execution failed',
      },
      { status: 500 }
    );
  }
}
