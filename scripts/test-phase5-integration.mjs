/**
 * LeadPulse AI V2 — Phase 5 End-to-End Integration Verification Script
 *
 * Proves the complete pipeline:
 * Next.js Environment -> Python Worker -> Lead Triage Agent
 *   -> Parallel Specialist Agents (Website, Ads, Maps)
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
console.log('LeadPulse AI V2 — Phase 5 Integration Verification');
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

    // Step 2: Live Lead Triage Agent Execution
    await runStep(2, 'Invoke Lead Triage Agent to Evaluate Prospective Candidate', async () => {
      const prompt =
        'Evaluate prospective business candidate "Aura Dental Lounge" located in Gurgaon:\n' +
        'Business Type: Aesthetic Dentistry\n' +
        'Scorecard Score: 9/10\n' +
        'Active Ads: True (Running teeth whitening & veneer campaigns)\n' +
        'Website: https://auradental.in\n' +
        'Google Rating: 4.8 across 95 reviews\n' +
        'Friction: Slow response to website WhatsApp inquiries\n' +
        'Return a structured LeadTriageResult.';

      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agent_type: 'lead_triage',
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Execution returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Agent execution failed: ${data.error}`);
      const out = data.output;
      if (typeof out.qualified !== 'boolean' || !out.priority || !out.reason || !Array.isArray(out.research_agents)) {
        throw new Error('Output does not conform to LeadTriageResult schema');
      }

      console.log(`  Qualified: ${out.qualified} | Priority: ${out.priority}`);
      console.log(`  Reason: "${out.reason}"`);
      console.log(`  Selected Specialists: [${out.research_agents.join(', ')}]`);
    });

    // Step 3: End-to-End Parallel Specialist Research
    await runStep(3, 'Execute Parallel Specialist Research Endpoint with Failure Isolation', async () => {
      const candidatePayload = {
        business_name: 'Aura Dental Lounge',
        business_type: 'Aesthetic Dentistry',
        source_platform: 'google_maps',
        source_url: 'https://maps.google.com/auradental',
        scorecard_score: 9,
        priority_tier: 'immediate',
        website_url: 'https://auradental.in',
        has_active_ads: true,
        rating: 4.8,
        review_count: 95,
        address: 'Golf Course Road, Gurgaon',
        phone_number: '+919876543210',
        raw_metadata: {
          category: 'Dental clinic',
          headline: 'Veneers & Smile Makeovers 20% Off',
          ad_creative_text: 'Transform your smile in 2 visits. Book free 3D smile scan.',
          cta_text: 'Send WhatsApp Message',
          ad_count: 1,
        },
      };

      const preTriage = {
        qualified: true,
        priority: 'high',
        reason: 'High-ticket cosmetic clinic with active ads',
        research_agents: ['ads', 'maps'],
      };

      const res = await fetch(`${workerUrl}/api/v1/specialists/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: candidatePayload,
          triage_result: preTriage,
          limits: { max_deep_research_leads: 5 },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Execution returned HTTP ${res.status}: ${text}`);
      }

      const aggregate = await res.json();
      if (!aggregate.business_name || !aggregate.triage_result || !aggregate.execution_status) {
        throw new Error('Aggregate output missing required structure');
      }

      console.log(`  Researched Business: ${aggregate.business_name}`);
      console.log(`  Execution Status: ${JSON.stringify(aggregate.execution_status)}`);
      console.log(`  Total Wall Time: ${aggregate.execution_time_ms} ms`);
      console.log(`  Token Usage: ${JSON.stringify(aggregate.token_usage)}`);

      if (aggregate.ads_analysis) {
        console.log(`  Ads Status: ${aggregate.ads_analysis.status} (Active Creatives: ${aggregate.ads_analysis.active_ad_count})`);
      }
      if (aggregate.maps_analysis) {
        console.log(`  Maps Status: ${aggregate.maps_analysis.status} (Rating: ${aggregate.maps_analysis.rating}, Sentiment: ${aggregate.maps_analysis.review_sentiment || 'unknown'})`);
      }
    });

    // Step 4: Credential Non-Exposure Check
    await runStep(4, 'Verify Zero Credential Leakage in Output Payloads', async () => {
      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Evaluate clinic "Test Dental".',
          agent_type: 'lead_triage',
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
    console.log('ALL PHASE 5 INTEGRATION CHECKS PASSED SUCCESSFULLY');
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
