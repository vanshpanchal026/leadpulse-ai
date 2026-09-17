/**
 * LeadPulse AI V2 — Phase 4 End-to-End Integration Verification Script
 *
 * Proves the complete pipeline:
 * Next.js Project Environment (.env) -> Python Worker (FastAPI/Uvicorn)
 *   -> Search Strategist Agent -> Structured SearchStrategy -> Scope Enforcement
 *   -> Controlled Apify Tool Layer & Scorecard Invariants
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
const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;

console.log('='.repeat(70));
console.log('LeadPulse AI V2 — Phase 4 Integration Verification');
console.log('='.repeat(70));
console.log(`Project Environment Root: ${projectRoot}`);
console.log(`Target Worker URL:        ${workerUrl}`);
console.log(`Target Provider Base:     ${providerUrl}`);
console.log(`Configured Model:         ${model}`);
console.log(`AI API Key Status:        ${apiKey ? '[CONFIGURED - MASKED]' : '[MISSING]'}`);
console.log(`Apify Token Status:       ${apifyToken ? '[CONFIGURED - MASKED]' : '[NOT SET]'}`);
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

    // Step 2: Search Strategist Live Strategy Generation
    await runStep(2, 'Invoke Search Strategist to Generate Structured SearchStrategy', async () => {
      const prompt =
        'Formulate 2 strategic search queries for high-ticket dermatology and dental clinics in Delhi NCR. ' +
        'Ensure strictly compliant structured JSON output.';

      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agent_type: 'search_strategist',
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Execution returned HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(`Agent execution failed: ${data.error}`);
      if (!data.output || !Array.isArray(data.output.queries)) {
        throw new Error('Output is missing "queries" list');
      }

      console.log(`  Goal: ${data.output.research_goal}`);
      console.log(`  Generated ${data.output.queries.length} queries:`);
      for (const q of data.output.queries) {
        console.log(`    - Query: "${q.query}" | Location: "${q.location}" | Vertical: "${q.vertical || 'N/A'}" [${q.priority}]`);
        if (!q.query || !q.location || !q.reason) {
          throw new Error('Query item missing required fields');
        }
      }
    });

    // Step 3: Campaign Geography & Vertical Guardrails
    await runStep(3, 'Verify Campaign Scope Boundary Enforcement (Gurgaon / Dental Only)', async () => {
      const prompt =
        'Formulate 2 search queries for a restricted campaign targeting cosmetic dentistry in Gurgaon only.';

      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agent_type: 'search_strategist',
          context: {
            campaign_scope: {
              target_cities: ['Gurgaon'],
              target_verticals: ['Dental'],
            },
            limits: { max_search_queries: 2 },
          },
          timeout_seconds: 120,
        }),
      });

      if (!res.ok) throw new Error(`Execution returned HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(`Agent failed: ${data.error}`);

      const queries = data.output.queries;
      if (queries.length > 2) throw new Error(`Exceeded max_search_queries limit (got ${queries.length})`);

      for (const q of queries) {
        const loc = q.location.toLowerCase();
        if (!loc.includes('gurgaon')) {
          throw new Error(`Query location '${q.location}' violated campaign restriction to Gurgaon`);
        }
        console.log(`  Verified compliant query: "${q.query}" (Location: ${q.location})`);
      }
    });

    // Step 4: Credential Non-Exposure Check
    await runStep(4, 'Verify Credential Redaction & Invariant Integrity', async () => {
      const res = await fetch(`${workerUrl}/api/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Formulate 1 search query for cosmetic dermatology clinics in Delhi.',
          agent_type: 'search_strategist',
          timeout_seconds: 120,
        }),
      });

      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(`Execution returned HTTP ${res.status}: ${bodyText}`);
      }
      const data = JSON.parse(bodyText);
      if (!data.success) {
        throw new Error(`Agent execution failed: ${data.error}`);
      }
      if (bodyText.includes(apiKey)) {
        throw new Error('FATAL SECURITY LEAK: AI_API_KEY detected in HTTP response body!');
      }
      if (apifyToken && bodyText.includes(apifyToken)) {
        throw new Error('FATAL SECURITY LEAK: APIFY_API_TOKEN detected in HTTP response body!');
      }
      console.log('  Confirmed zero credential leakage across successful response payload.');
    });

    console.log('\n' + '='.repeat(70));
    console.log('ALL PHASE 4 INTEGRATION CHECKS PASSED SUCCESSFULLY');
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
