import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import csv from 'csv-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateLeadOutput } from '../lib/anti-spam-validator.ts';
import { evaluatePostWithPreFilter } from '../lib/pre-filter.ts';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('⚠️ Supabase credentials not found. Supabase upsert will be skipped.');
}

const API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is not set in environment or .env file.');
  process.exit(1);
}

// Model selection (defaults to gemini-2.5-flash per specification)
const modelArg = process.argv.find((arg) => arg.startsWith('--model='));
const MODEL_NAME = modelArg ? modelArg.split('=')[1] : 'gemini-2.5-flash';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2,
  },
});

const SYSTEM_PROMPT = `
You are an expert lead qualification consultant helping Vansh evaluate small business pain.
Vansh's services focus on capturing missed customer inquiries, 24/7 after-hours WhatsApp lead capture, frictionless calendar booking, and operational workflow automation.
Target clients: Real businesses with inquiry volume (approx. 10-20 staff or strong transaction flow, e.g. clinics, real estate agencies, salons, contractors, local services, e-commerce stores).

STRICT RULES:
1. NEVER fabricate past clients (e.g. NEVER say "I recently built this for someone else" or make up testimonials).
2. Offer direct technical perspective and concrete solution blueprints.
3. RULES FOR recommended_first_message (STRICT ANTI-SPAM):
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
4. Only flag "is_potential_lead: true" if the poster represents a genuine operational business experiencing customer communication, scheduling, or lead drop-off friction that automation/WhatsApp/calendar can solve.
5. REJECT: Other freelancers, web developers advertising services, students, dropshippers with no sales, or early-stage theoretical idea validation without real operational load.

Return strictly valid JSON matching this schema:
{
  "is_potential_lead": boolean,
  "business_type": string,
  "identified_problem": string,
  "recommended_first_message": string,
  "confidence_score": number
}
where confidence_score is an integer from 1 to 10 (10 = immediate high-intent fit for Vansh's automation services).
`;

// Helper delay to respect API rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Execute Gemini call with automatic rate-limit retry
async function evaluateWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await model.generateContent(prompt);
      const rawText = res.response.text();
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      const errMsg = err.message || '';
      const isRateLimit = errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < maxRetries) {
        // Look for retry delay in error or wait standard backoff
        const delayMatch = errMsg.match(/retry in ([0-9.]+)s/i);
        const waitSec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) + 2 : (15 * attempt);
        console.log(`\n⏳ Rate limit reached (Free tier 5 RPM). Pausing ${waitSec}s before attempt ${attempt + 1}/${maxRetries}...`);
        await sleep(waitSec * 1000);
      } else {
        throw err;
      }
    }
  }
}

async function run() {
  const rootDir = process.cwd();
  const possibleCsvPaths = [
    path.join(rootDir, 'data', 'reddit_results.csv'),
    path.join(rootDir, 'reddit_results.csv'),
  ];

  const csvPath = possibleCsvPaths.find((p) => fs.existsSync(p));
  if (!csvPath) {
    console.error(`❌ Could not find reddit_results.csv in: ${possibleCsvPaths.join(' or ')}`);
    process.exit(1);
  }

  console.log(`📂 Reading Reddit dataset from: ${csvPath}`);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 Loaded ${rows.length} total rows.`);

  // 1. Local Pre-Filter (Stage 2 Triage: Obvious Reject vs. Candidate)
  let rejectCount = 0;
  const preFiltered = [];

  for (const r of rows) {
    const triage = evaluatePostWithPreFilter({
      title: r.title,
      body: r.body_text || r.body || '',
      subreddit: r.subreddit,
    });

    if (triage.isCandidate) {
      preFiltered.push({
        ...r,
        keyword_matched: triage.matchedKeyword || r.keyword_matched || 'general_inquiry',
      });
    } else {
      rejectCount++;
    }
  }

  console.log(`🧹 Filtered out ${rejectCount} obvious reject/noise rows without calling Gemini.`);
  console.log(`✨ ${preFiltered.length} candidate posts eligible for Gemini evaluation.`);

  // Prioritize r/smallbusiness, r/Entrepreneur, r/shopify
  const prioritySubs = new Set(['smallbusiness', 'entrepreneur', 'shopify']);

  const sortedCandidates = [...preFiltered].sort((a, b) => {
    const subA = (a.subreddit || '').toLowerCase().replace(/^r\//, '');
    const subB = (b.subreddit || '').toLowerCase().replace(/^r\//, '');
    const aIsPrio = prioritySubs.has(subA) ? 1 : 0;
    const bIsPrio = prioritySubs.has(subB) ? 1 : 0;
    return bIsPrio - aIsPrio;
  });

  // Load existing leads for deduplication
  const outputPath = path.join(rootDir, 'data', 'leads.json');
  let existingLeads = [];
  if (fs.existsSync(outputPath)) {
    try {
      existingLeads = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      if (!Array.isArray(existingLeads)) existingLeads = [];
    } catch {
      existingLeads = [];
    }
  }

  const existingUrls = new Set(existingLeads.map((l) => l.source_url));
  console.log(`📌 Found ${existingLeads.length} existing qualified leads in data/leads.json`);

  if (supabase) {
    try {
      const { data: dbLeads } = await supabase.from('leads').select('source_url');
      if (dbLeads) {
        dbLeads.forEach((l) => {
          if (l.source_url) existingUrls.add(l.source_url);
        });
        console.log(`📌 Synced with Supabase: ${dbLeads.length} leads already tracked.`);
      }
    } catch (err) {
      console.warn('⚠️ Could not sync existing leads from Supabase:', err.message);
    }
  }

  // Check command line arg for limit (default 25)
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const batchLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 25;
  const isNewOnly = process.argv.includes('--new');
  const isReEvaluate = !isNewOnly && (
    process.argv.includes('--re-evaluate') ||
    process.argv.includes('--force') ||
    (limitArg && batchLimit === 1 && existingLeads.length > 0)
  );


  // Re-evaluation mode: Updates pitches of existing qualified leads using updated anti-spam prompt
  if (isReEvaluate && existingLeads.length > 0) {
    const leadsToProcess = existingLeads.slice(0, batchLimit);
    console.log(`🔄 Re-evaluating ${leadsToProcess.length} sample lead(s) from existing qualified leads using ${MODEL_NAME} (Strict Anti-Spam Mode)...\n`);

    for (let i = 0; i < leadsToProcess.length; i++) {
      const lead = leadsToProcess[i];
      const titleSnippet = (lead.title || '').slice(0, 55);
      console.log(`[${i + 1}/${leadsToProcess.length}] ${lead.subreddit_or_handle}: "${titleSnippet}..."`);

      try {
        const userPrompt = `${SYSTEM_PROMPT}

Candidate Post Details:
- Subreddit: ${lead.subreddit_or_handle}
- Matched Keyword: Inbound Inquiry / Operational Bottleneck
- Post Title: ${lead.title}
- Source URL: ${lead.source_url || 'N/A'}
- Post Content:
${lead.body_text || lead.title}
`;

        const parsed = await evaluateWithRetry(userPrompt);
        const score = Number(parsed.confidence_score) || lead.confidence_score;

        console.log(`\n📋 Re-Evaluation Result:`);
        console.log(`   Business Type: ${parsed.business_type || lead.business_type}`);
        console.log(`   Problem: ${parsed.identified_problem || lead.identified_problem}`);
        console.log(`   Confidence Score: ${score}/10`);
        console.log(`\n⏮️  Original Pitch:\n   "${lead.draft_pitch}"`);
        console.log(`\n✨ Humanized Pitch (Anti-Spam Filtered):\n   "${parsed.recommended_first_message}"`);

        // Code-Level Anti-Spam Validator
        const validation = validateLeadOutput(parsed);

        if (!validation.isValid) {
          console.warn(`\n❌ Code-Level Anti-Spam BLOCKED this re-evaluated message:`);
          validation.errors.forEach((err) => console.warn(`   - ${err}`));
          console.warn(`   ⚠️ Keeping original pitch intact. Refusing to persist invalid message to Supabase.`);
          continue;
        }

        console.log(`\n🛡️  Anti-Spam Verification: ✅ PASSED (Banned phrases: 0, Sentences: ${validation.checks.length.sentenceCount}, Placeholders: 0)`);

        // Update lead fields only after code validation passes
        lead.draft_pitch = validation.sanitizedPitch;
        lead.confidence_score = score;
        if (parsed.identified_problem) lead.identified_problem = parsed.identified_problem;
        if (parsed.business_type) lead.business_type = parsed.business_type;
        lead.updated_at = new Date().toISOString();

        if (supabase) {
          try {
            const { error: sbError } = await supabase
              .from('leads')
              .upsert(lead, { onConflict: 'source_url' });
            if (sbError) {
              console.log(`   ⚠️ Supabase upsert error: ${sbError.message}`);
            } else {
              console.log(`   ⚡ Upserted directly to Supabase table 'leads'`);
            }
          } catch (sbErr) {
            console.log(`   ⚠️ Supabase exception: ${sbErr.message}`);
          }
        }
      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
      }

      if (i < leadsToProcess.length - 1) {
        await sleep(10000);
      }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(existingLeads, null, 2), 'utf-8');

    console.log(`\n======================================================`);
    console.log(`🎉 Sample re-evaluation completed successfully!`);
    console.log(`💾 Updated leads saved in data/leads.json`);
    console.log(`======================================================\n`);
    return;
  }

  // Standard Candidate Processing Mode
  const unreviewedCandidates = sortedCandidates.filter((c) => !existingUrls.has(c.url));
  const candidateBatch = unreviewedCandidates.slice(0, batchLimit);

  console.log(`🤖 Evaluating batch of ${candidateBatch.length} new candidates using ${MODEL_NAME}...\n`);

  const newlyQualified = [];

  for (let i = 0; i < candidateBatch.length; i++) {
    const item = candidateBatch[i];
    const sub = (item.subreddit || 'unknown').replace(/^r\//, '');
    const titleSnippet = (item.title || '').slice(0, 55);

    process.stdout.write(`[${i + 1}/${candidateBatch.length}] r/${sub}: "${titleSnippet}..." `);

    try {
      const userPrompt = `${SYSTEM_PROMPT}

Candidate Post Details:
- Subreddit: r/${sub}
- Matched Keyword: ${item.keyword_matched || 'N/A'}
- Post Title: ${item.title}
- Source URL: ${item.url || 'N/A'}
- Post Content:
${item.body_text || item.title}
`;

      const parsed = await evaluateWithRetry(userPrompt);

      // Code-Level Anti-Spam & Schema Validator
      const validation = validateLeadOutput(parsed);

      if (validation.isValid) {
        const score = Number(parsed.confidence_score);
        console.log(`✅ QUALIFIED (Score: ${score}/10 | ${parsed.business_type || 'Business'})`);
        console.log(`   🛡️ Anti-Spam Check: ✅ PASSED (Sentences: ${validation.checks.length.sentenceCount}, Chars: ${validation.checks.length.charCount})`);

        const leadId = crypto.randomUUID();
        const newLead = {
          id: leadId,
          source_platform: 'reddit',
          source_url: item.url || `https://www.reddit.com/r/${sub}`,
          author: 'u/reddit_user',
          subreddit_or_handle: `r/${sub}`,
          title: item.title || 'Inquiry Opportunity',
          body_text: item.body_text || item.title || '',
          identified_problem: parsed.identified_problem || 'Operational communication and inquiry bottlenecks.',
          business_type: parsed.business_type || 'Small Business',
          confidence_score: score,
          draft_pitch: validation.sanitizedPitch,
          status: 'new',
          created_at: item.created_date || new Date().toISOString(),
        };

        if (supabase) {
          try {
            const { error: sbError } = await supabase
              .from('leads')
              .upsert(newLead, { onConflict: 'source_url' });
            if (sbError) {
              console.log(`   ⚠️ Supabase upsert error: ${sbError.message}`);
            } else {
              console.log(`   ⚡ Upserted directly to Supabase table 'leads'`);
            }
          } catch (sbErr) {
            console.log(`   ⚠️ Supabase exception: ${sbErr.message}`);
          }
        }

        newlyQualified.push(newLead);
        existingUrls.add(newLead.source_url);
      } else {
        const score = Number(parsed.confidence_score) || 0;
        if (parsed.is_potential_lead && score >= 7) {
          console.log(`❌ BLOCKED by Anti-Spam Validator (Score was ${score}/10):`);
          validation.errors.forEach((err) => console.log(`   - ${err}`));
        } else {
          console.log(`⚪ Skipped (Score: ${score}/10 | ${parsed.is_potential_lead ? 'Below threshold' : 'Not high-fit'})`);
        }
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    // Pacing delay (10-12s on free tier to stay within 5 RPM quota smoothly)
    if (i < candidateBatch.length - 1) {
      await sleep(10000);
    }
  }

  // Combine existing + new leads
  const combinedLeads = [...existingLeads, ...newlyQualified];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(combinedLeads, null, 2), 'utf-8');

  console.log(`\n======================================================`);
  console.log(`🎉 Pipeline execution completed!`);
  console.log(`✨ Newly qualified this run: ${newlyQualified.length}`);
  console.log(`💾 Total qualified leads in data/leads.json: ${combinedLeads.length}`);
  console.log(`======================================================\n`);
}

run().catch((err) => {
  console.error('Fatal error running pipeline:', err);
  process.exit(1);
});
