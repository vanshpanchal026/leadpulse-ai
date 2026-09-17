/**
 * LeadPulse AI V2 — Phase 2 End-to-End Integration Verification Script
 *
 * Proves the complete pipeline:
 * Next.js Project Environment (.env) -> Python Worker (FastAPI/Uvicorn)
 *   -> OpenAI Agents SDK -> Configured Provider (Local Reverse Proxy) -> Structured Output
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// 1. Load project environment variables as Next.js does
dotenv.config({ path: resolve(projectRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env.local') });

const workerUrl = (process.env.AI_WORKER_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const providerUrl = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || 'auto';

console.log('='.repeat(70));
console.log('LeadPulse AI V2 — Phase 2 Integration Test');
console.log('='.repeat(70));
console.log(`Project Environment Root: ${projectRoot}`);
console.log(`Target Worker URL:        ${workerUrl}`);
console.log(`Target Provider Base:     ${providerUrl}`);
console.log(`Configured Model:         ${model}`);
console.log(`API Key Status:           ${apiKey ? '[CONFIGURED - MASKED]' : '[MISSING]'}`);
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
    console.log('[+] Python AI worker is already running at', workerUrl);
    return;
  }

  console.log('[*] Spawning Python AI worker process (uvicorn)...');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  workerProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'ai-worker', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: projectRoot,
      env: { ...process.env, AI_WORKER_HOST: '127.0.0.1', AI_WORKER_PORT: '8000' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  workerProcess.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[worker:stdout] ${line}`);
  });

  workerProcess.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[worker:stderr] ${line}`);
  });

  // Poll until worker starts responding
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probeWorkerHealth()) {
      console.log('[+] Python AI worker spawned and ready.');
      return;
    }
  }

  throw new Error('Worker process failed to become ready within 15 seconds.');
}

async function runTests() {
  try {
    await startWorkerIfNeeded();

    // Step 1: Liveness and secret safety verification
    console.log('\n[Test 1/3] Probing GET /health...');
    const healthRes = await fetch(`${workerUrl}/health`);
    if (!healthRes.ok) throw new Error(`GET /health failed with status ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log('           Worker Status:', healthData.status);
    console.log('           Service:', healthData.service, healthData.version);
    console.log('           Provider Configured:', healthData.provider?.configured);
    console.log('           Provider Mode:', healthData.provider?.mode);

    // Verify secrets are not leaked
    const healthRaw = JSON.stringify(healthData);
    if (healthRaw.includes(apiKey)) {
      throw new Error('SECURITY VIOLATION: Secret API key was found in /health response!');
    }
    console.log('           [PASS] Zero secrets leaked in HTTP response.');

    // Step 2: Readiness probe
    console.log('\n[Test 2/3] Probing GET /health/ready...');
    const readyRes = await fetch(`${workerUrl}/health/ready`);
    const readyData = await readyRes.json();
    console.log('           Readiness Status:', readyData.status);
    console.log('           Provider Accessible:', readyData.provider_accessible);
    if (!readyData.provider_accessible) {
      throw new Error(`Provider inaccessible: ${readyData.provider_status}`);
    }
    console.log('           [PASS] Upstream provider gateway is reachable.');

    // Step 3: End-to-End Structured Agent Run
    console.log('\n[Test 3/3] Executing POST /api/v1/run with Structured Triage Agent...');
    const prompt = [
      "Evaluate prospect 'Apex Dental Care' located in Austin, TX:",
      "Rating: 4.9 stars with 140 Google reviews.",
      "Meta Ads Status: Active campaign running.",
      "Website Status: Mobile responsive website detected.",
      "Score this clinic 9 out of 10 with 'immediate' priority and 'whatsapp' channel.",
      "Synthesize into structured LeadTriageResult."
    ].join(' ');

    const startTime = Date.now();
    const runRes = await fetch(`${workerUrl}/api/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        agent_type: 'triage',
        timeout_seconds: 60.0
      })
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      throw new Error(`POST /api/v1/run failed (${runRes.status}): ${errText}`);
    }

    const runData = await runRes.json();
    const durationMs = Date.now() - startTime;

    console.log(`           Execution completed in ${durationMs} ms`);
    console.log('           Success:', runData.success);
    console.log('           Agent Type:', runData.agent_type);
    console.log('           Token Usage:', JSON.stringify(runData.token_usage));
    console.log('           Structured Output:', JSON.stringify(runData.output, null, 2));

    if (!runData.success) {
      throw new Error(`Agent run reported failure: ${runData.error}`);
    }

    const output = runData.output;
    if (!output || typeof output !== 'object') {
      throw new Error('Expected output to be a structured object.');
    }

    if (!output.business_name || !output.business_name.includes('Apex Dental')) {
      throw new Error(`Expected business_name to contain 'Apex Dental', got: ${output.business_name}`);
    }

    if (typeof output.score !== 'number' || output.score < 0 || output.score > 10) {
      throw new Error(`Expected numeric score between 0 and 10, got: ${output.score}`);
    }

    if (!output.priority || !['immediate', 'high'].includes(output.priority.toLowerCase())) {
      throw new Error(`Expected priority 'immediate' or 'high', got: ${output.priority}`);
    }

    if (!output.recommended_channel || output.recommended_channel.toLowerCase() !== 'whatsapp') {
      throw new Error(`Expected channel 'whatsapp', got: ${output.recommended_channel}`);
    }

    if (!runData.token_usage || runData.token_usage.total_tokens <= 0) {
      throw new Error(`Expected positive token usage, got: ${JSON.stringify(runData.token_usage)}`);
    }

    console.log('           [PASS] End-to-end structured pipeline successfully verified!');

    // Step 4: Verify route aliases and versioned endpoints
    console.log('\n[Test 4/4] Probing route aliases (GET /api/v1/health & POST /run)...');
    const v1HealthRes = await fetch(`${workerUrl}/api/v1/health`);
    if (!v1HealthRes.ok) throw new Error(`GET /api/v1/health failed with status ${v1HealthRes.status}`);
    const rootRunRes = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Respond strictly with 'ROOT_CONFIRMED'",
        agent_type: 'base',
        timeout_seconds: 60.0
      })
    });
    if (!rootRunRes.ok) throw new Error(`POST /run alias failed with status ${rootRunRes.status}`);
    const rootRunData = await rootRunRes.json();
    if (!rootRunData.success) throw new Error('POST /run alias execution failed');
    console.log('           [PASS] Route aliases (/run and /api/v1/health) verified.');

    console.log('\n' + '='.repeat(70));
    console.log('VERDICT: PHASE 2 INTEGRATION TEST PASSED (100%)');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\n[FAIL] Integration test failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (workerProcess) {
      console.log('[*] Stopping spawned worker process...');
      workerProcess.kill();
    }
  }
}

runTests();
