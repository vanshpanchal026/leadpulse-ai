/**
 * LeadPulse AI V2 — Phase 6 End-to-End Integration Verification Script
 *
 * Proves the complete Phase 6 pipeline:
 * Next.js Environment -> Python Worker -> Opportunity Agent
 *   -> Lead Analyst -> Structured Final LeadAnalysis
 *   -> Strict Anti-Hallucination Guardrails & Isolated Fault Tolerance
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// 1. Load project environment variables
dotenv.config({ path: resolve(projectRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env.local') });

const workerUrl = (process.env.AI_WORKER_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const providerUrl = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || 'auto';

console.log('='.repeat(70));
console.log('LeadPulse AI V2 — Phase 6 Integration Verification');
console.log('='.repeat(70));
console.log(`Project Environment Root: ${projectRoot}`);
console.log(`Target Worker URL:        ${workerUrl}`);
console.log(`Target Provider Base:     ${providerUrl}`);
console.log(`Configured Model:         ${model}`);
console.log(`AI API Key Status:        ${apiKey ? '[CONFIGURED - MASKED]' : '[MISSING]'}`);
console.log('='.repeat(70));

if (!providerUrl || !apiKey) {
  console.error('FATAL: Missing required environment variables (AI_BASE_URL or AI_API_KEY).');
  process.exit(1);
}

let workerProcess = null;

async function probeWorkerHealth() {
  try {
    const res = await fetch(`${workerUrl}/health`);
    if (res.ok) {
      const data = await res.json();
      return data.status === 'healthy';
    }
  } catch {
    return false;
  }
  return false;
}

async function startWorkerIfNeeded() {
  const isRunning = await probeWorkerHealth();
  if (isRunning) {
    console.log(`[Worker] Detected active worker at ${workerUrl}. Reusing running instance.`);
    return;
  }

  console.log(`[Worker] No active worker detected. Spawning Uvicorn worker process on ${workerUrl}...`);
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  workerProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'ai-worker', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: projectRoot,
      env: { ...process.env, AI_WORKER_HOST: '127.0.0.1', AI_WORKER_PORT: '8000' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  workerProcess.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[Worker STDOUT] ${line}`);
  });

  workerProcess.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line && !line.includes('GET /health')) console.log(`[Worker STDERR] ${line}`);
  });

  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probeWorkerHealth()) {
      console.log('[Worker] Python AI worker started and responding healthy.');
      return;
    }
    attempts++;
  }

  throw new Error('Timed out waiting for Python AI worker to become ready.');
}

function stopWorker() {
  if (workerProcess) {
    console.log('[Worker] Shutting down spawned worker process...');
    workerProcess.kill('SIGTERM');
    workerProcess = null;
  }
}

async function runStep(stepNumber, description, fn) {
  console.log(`\n[STEP ${stepNumber}] ${description}`);
  try {
    await fn();
    console.log(`✓ [STEP ${stepNumber} PASSED]`);
  } catch (err) {
    console.error(`✗ [STEP ${stepNumber} FAILED]:`, err.message);
    stopWorker();
    process.exit(1);
  }
}

async function main() {
  try {
    await startWorkerIfNeeded();

    // Step 1: Health & Readiness
    await runStep(1, 'Verify Worker Health and System Readiness', async () => {
      const res = await fetch(`${workerUrl}/health/ready`);
      if (!res.ok) throw new Error(`Readiness check returned HTTP ${res.status}`);
      const data = await res.json();
      if (!data.provider_accessible) throw new Error('Worker reported provider_accessible=false');
      console.log(`  Readiness: status=${data.status}, accessible=${data.provider_accessible}`);
    });

    // Step 2: Live Opportunity Agent Execution
    await runStep(2, 'Invoke Opportunity Agent to Synthesize Business Bottleneck and Service', async () => {
      const prompt =
        'Analyze verified research for prospective client "Apex Dental Spa" in Gurgaon:\n' +
        '- Business Type: Cosmetic Dentistry & Dental Implants\n' +
        '- Website Audit: Operational, but lacks online booking and lacks direct WhatsApp chat CTA.\n' +
        '- Meta Ads Audit: Active ads running promoting dental implants and smile makeovers.\n' +
        '- Maps Audit: Verified local presence, 4.9 rating across 140 reviews.\n' +
        '- Observed Friction: Prospects clicking paid ads must call the clinic during business hours.\n' +
        'Synthesize this intelligence into a structured OpportunityResult:\n' +
        'Identify primary problem, recommend canonical service, explain why, ' +
        'and calculate opportunity_score (0-100) and confidence (0-1).';

      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agent_type: 'opportunity',
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Opportunity agent execution returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Opportunity agent failed: ${data.error}`);

      const out = data.output;
      console.log(`  Recommended Service: ${out.recommended_service}`);
      console.log(`  Opportunity Score:   ${out.opportunity_score}/100`);
      console.log(`  Confidence:          ${out.confidence}`);
      console.log(`  Primary Problem:     ${out.primary_problem}`);

      if (out.opportunity_score < 0 || out.opportunity_score > 100) {
        throw new Error(`opportunity_score out of bounds: ${out.opportunity_score}`);
      }
      if (out.confidence < 0 || out.confidence > 1) {
        throw new Error(`confidence out of bounds: ${out.confidence}`);
      }
    });

    // Step 3: Live Lead Analyst Execution
    await runStep(3, 'Invoke Lead Analyst to Synthesize Final Structured Lead Record', async () => {
      const prompt =
        'Synthesize final intelligence for prospective client "Apex Dental Spa":\n' +
        '- Business: Apex Dental Spa (Scorecard: 9/10, Priority: high)\n' +
        '- Triage: Qualified for deep research\n' +
        '- Specialist Research: All specialists (Website, Ads, Maps) completed successfully.\n' +
        '- Opportunity: Score 88.0, Recommended Service: booking_automation.\n' +
        '- Problem: Inbound paid ad traffic leaks because clinic lacks 24/7 calendar booking.\n' +
        '- Limitations: None. All digital channels verified.\n' +
        'Emit a structured LeadAnalysis record.';

      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agent_type: 'lead_analyst',
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Lead Analyst execution returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Lead Analyst failed: ${data.error}`);

      const out = data.output;
      console.log(`  Business Name:        ${out.business_name}`);
      console.log(`  Qualification Status: ${out.qualification_status}`);
      console.log(`  Priority:             ${out.priority}`);
      console.log(`  Research Status:      ${out.research_status}`);
      console.log(`  Recommended Service:  ${out.recommended_service}`);
      console.log(`  Opportunity Score:    ${out.opportunity_score}`);

      if (out.qualification_status !== 'qualified') {
        throw new Error(`Expected qualification_status='qualified', got '${out.qualification_status}'`);
      }
      if (out.research_status !== 'complete') {
        throw new Error(`Expected research_status='complete', got '${out.research_status}'`);
      }
    });

    // Step 4: Full Opportunities Synthesis Endpoint
    await runStep(4, 'Execute POST /api/v1/opportunities/analyze with Candidate and Aggregate', async () => {
      const candidatePayload = {
        business_name: 'Apex Dental Spa',
        business_type: 'Cosmetic Dentistry',
        source_platform: 'google_maps',
        source_url: 'https://maps.google.com/apexdental',
        scorecard_score: 9,
        priority_tier: 'immediate',
        website_url: 'https://apexdentalspa.in',
        has_active_ads: true,
        rating: 4.9,
        review_count: 140,
        friction_points: ['No online booking flow', 'Manual WhatsApp intake'],
      };

      const aggregatePayload = {
        business_name: 'Apex Dental Spa',
        triage_result: {
          qualified: true,
          priority: 'high',
          reason: 'High-ticket cosmetic dentistry clinic running active ads',
          research_agents: ['website', 'ads', 'maps'],
        },
        website_analysis: {
          status: 'available',
          has_booking_system: false,
          has_whatsapp_cta: false,
          primary_cta: 'Call Now',
          friction_points: ['No online booking flow'],
          confidence: 0.9,
          findings: ['Clean website with service listing but lacks self-serve booking'],
        },
        ads_analysis: {
          status: 'active_ads',
          active_ad_count: 3,
          ad_themes: ['Smile makeover discounts', 'Implants with lifetime warranty'],
          observed_ctas: ['Learn More'],
          confidence: 0.85,
          findings: ['3 active Meta ad creatives running'],
        },
        maps_analysis: {
          status: 'verified',
          rating: 4.9,
          review_count: 140,
          business_category: 'Dental clinic',
          confidence: 0.95,
          findings: ['Verified Google Maps profile in Gurgaon'],
        },
        aggregated_evidence: [
          {
            finding: 'Active ad campaigns lack online booking conversion path',
            source: 'ads',
            evidence: 'Observed 3 active ads directing traffic to site with no booking system',
            confidence: 0.9,
            classification: 'observed',
          },
        ],
        execution_status: { website: 'success', ads: 'success', maps: 'success' },
      };

      const res = await fetch(`${workerUrl}/api/v1/opportunities/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: candidatePayload,
          specialist_aggregate: aggregatePayload,
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analyze endpoint returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Pipeline analysis failed: ${data.error}`);

      const lead = data.lead_analysis;
      const opp = data.opportunity_result;
      console.log(`  Lead: ${lead.business_name} | Priority: ${lead.priority} | Opp Score: ${lead.opportunity_score}`);
      console.log(`  Service: ${lead.recommended_service} | Research Status: ${lead.research_status}`);
      console.log(`  Execution Time: ${data.execution_time_ms} ms | Tokens: ${JSON.stringify(data.token_usage)}`);

      if (!lead || !opp) throw new Error('Response missing lead_analysis or opportunity_result');
      if (lead.opportunity_score <= 0 || lead.opportunity_score > 100) {
        throw new Error(`Invalid opportunity score: ${lead.opportunity_score}`);
      }
    });

    // Step 5: Partial Failure Isolation Verification
    await runStep(5, 'Verify Partial Research Failure Isolation & Limitations Preservation', async () => {
      const candidatePayload = {
        business_name: 'Metro Dermatology',
        business_type: 'Dermatology Clinic',
        source_platform: 'google_maps',
        source_url: 'https://maps.google.com/metroderm',
        scorecard_score: 7,
        priority_tier: 'high',
        website_url: 'https://metroderm.in',
        has_active_ads: false,
        rating: 4.6,
        review_count: 50,
        friction_points: ['Manual booking'],
      };

      const partialAggregatePayload = {
        business_name: 'Metro Dermatology',
        triage_result: {
          qualified: true,
          priority: 'high',
          reason: 'Dermatology clinic',
          research_agents: ['website', 'ads'],
        },
        website_analysis: {
          status: 'available',
          has_booking_system: false,
          has_whatsapp_cta: true,
          primary_cta: 'WhatsApp',
          confidence: 0.85,
          findings: ['Website operational'],
        },
        ads_analysis: {
          status: 'error',
          findings: ['Ads research unavailable: Worker timeout after 60s'],
          confidence: 0.0,
        },
        execution_status: {
          website: 'success',
          ads: 'timeout: WorkerTimeoutError after 60.0s',
        },
      };

      const res = await fetch(`${workerUrl}/api/v1/opportunities/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: candidatePayload,
          specialist_aggregate: partialAggregatePayload,
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analyze endpoint returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Pipeline analysis failed: ${data.error}`);

      const lead = data.lead_analysis;
      console.log(`  Partial Research Status: ${lead.research_status}`);
      console.log(`  Recorded Limitations:    ${JSON.stringify(lead.limitations)}`);

      if (lead.research_status !== 'partial') {
        throw new Error(`Expected research_status='partial', got '${lead.research_status}'`);
      }
      if (!lead.limitations || lead.limitations.length === 0) {
        throw new Error('Expected limitations to record failed specialist');
      }
      const hasAdsLimitation = lead.limitations.some((lim) => lim.toLowerCase().includes('ads'));
      if (!hasAdsLimitation) {
        throw new Error('Expected limitations to explicitly mention Ads failure');
      }
    });

    // Step 6: Credential Non-Exposure Check
    await runStep(6, 'Verify Zero Credential Leakage Across Synthesis Outputs', async () => {
      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Analyze candidate Clinic X with scorecard score 5/10 and website available. Emit a structured OpportunityResult.',
          agent_type: 'opportunity',
          timeout_seconds: 60,
        }),
      });

      const bodyText = await res.text();
      if (!res.ok) throw new Error(`Execution returned HTTP ${res.status}: ${bodyText}`);
      if (bodyText.includes(apiKey)) {
        throw new Error('FATAL SECURITY LEAK: AI_API_KEY detected in response payload!');
      }
      console.log('  Confirmed zero secret key leakage across response body.');
    });

    console.log('\n' + '='.repeat(70));
    console.log('ALL PHASE 6 INTEGRATION CHECKS PASSED SUCCESSFULLY');
    console.log('='.repeat(70));
  } finally {
    stopWorker();
  }
}

main().catch((err) => {
  console.error('Fatal unexpected error:', err);
  stopWorker();
  process.exit(1);
});
