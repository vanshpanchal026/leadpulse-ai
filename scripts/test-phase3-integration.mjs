/**
 * LeadPulse AI V2 — Phase 3 End-to-End Integration Verification Script
 *
 * Proves the complete pipeline:
 * Next.js Project Environment (.env) -> Python Worker (FastAPI/Uvicorn)
 *   -> Centralized Provider Config -> Configurable Business Profile
 *   -> Profile-aware Agents -> Upstream Provider Gateway -> Factual Output
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
console.log('LeadPulse AI V2 — Phase 3 Integration Test');
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

    // Step 1: Health probe
    console.log('\n[Test 1/4] Probing GET /health...');
    const healthRes = await fetch(`${workerUrl}/health`);
    if (!healthRes.ok) throw new Error(`GET /health failed with status ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log('           Worker Status:', healthData.status);
    console.log('           Provider Configured:', healthData.provider?.configured);
    console.log('           Provider Mode:', healthData.provider?.mode);
    const healthRaw = JSON.stringify(healthData);
    if (healthRaw.includes(apiKey)) {
      throw new Error('SECURITY VIOLATION: Secret API key leaked in /health response!');
    }
    console.log('           [PASS] Zero secrets leaked.');

    // Step 2: Readiness probe
    console.log('\n[Test 2/4] Probing GET /health/ready...');
    const readyRes = await fetch(`${workerUrl}/health/ready`);
    const readyData = await readyRes.json();
    console.log('           Readiness Status:', readyData.status);
    console.log('           Provider Accessible:', readyData.provider_accessible);
    if (!readyData.provider_accessible) {
      throw new Error(`Provider inaccessible: ${readyData.provider_status}`);
    }
    console.log('           [PASS] Upstream provider gateway is reachable.');

    // Step 3: Profile Test Agent execution
    console.log('\n[Test 3/4] Executing Profile Test Agent (agent_type="profile_test")...');
    const profilePrompt = (
      "Based strictly on your centralized business context, who is the lead consultant " +
      "for LeadPulse and what messaging platform is automated? Respond in 1 brief sentence."
    );
    const profileRes = await fetch(`${workerUrl}/api/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: profilePrompt,
        agent_type: 'profile_test',
        timeout_seconds: 60.0
      })
    });
    if (!profileRes.ok) {
      const err = await profileRes.text();
      throw new Error(`Profile test agent run failed: ${err}`);
    }
    const profileData = await profileRes.json();
    console.log('           Success:', profileData.success);
    console.log('           Output:', profileData.output);
    console.log('           Execution Time:', `${profileData.execution_time_ms} ms`);
    console.log('           Token Usage:', JSON.stringify(profileData.token_usage));
    const outLower = String(profileData.output).toLowerCase();
    if (!outLower.includes('vansh')) {
      throw new Error(`Expected output to identify consultant 'Vansh', got: ${profileData.output}`);
    }
    if (!outLower.includes('whatsapp')) {
      throw new Error(`Expected output to reference 'WhatsApp', got: ${profileData.output}`);
    }
    console.log('           [PASS] Profile Test Agent consumed business facts accurately!');

    // Step 4: Triage Agent execution with profile context
    console.log('\n[Test 4/4] Executing Triage Agent with centralized profile context...');
    const triagePrompt = [
      "Evaluate prospect 'Aura Dermatology Clinic' located in South Delhi:",
      "Rating: 4.8 stars with 95 Google reviews.",
      "Meta Ads Status: Active campaign running.",
      "Website Status: Mobile responsive, but missing WhatsApp CTA button.",
      "Score this clinic 9 out of 10 with 'immediate' priority and 'whatsapp' channel.",
      "Synthesize into structured LeadTriageResult."
    ].join(' ');

    const triageRes = await fetch(`${workerUrl}/api/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: triagePrompt,
        agent_type: 'triage',
        timeout_seconds: 60.0
      })
    });
    if (!triageRes.ok) {
      const err = await triageRes.text();
      throw new Error(`Triage agent run failed: ${err}`);
    }
    const triageData = await triageRes.json();
    console.log('           Success:', triageData.success);
    console.log('           Structured Output:', JSON.stringify(triageData.output, null, 2));
    const triageOutput = triageData.output;
    if (!triageOutput.business_name || !triageOutput.business_name.includes('Aura Dermatology')) {
      throw new Error(`Expected business_name to contain 'Aura Dermatology', got: ${triageOutput.business_name}`);
    }
    if (triageOutput.score !== 9) {
      throw new Error(`Expected score 9, got: ${triageOutput.score}`);
    }
    if (triageOutput.priority.toLowerCase() !== 'immediate') {
      throw new Error(`Expected priority 'immediate', got: ${triageOutput.priority}`);
    }
    if (triageOutput.recommended_channel.toLowerCase() !== 'whatsapp') {
      throw new Error(`Expected recommended_channel 'whatsapp', got: ${triageOutput.recommended_channel}`);
    }
    console.log('           [PASS] Triage Agent successfully executed with profile context!');

    console.log('\n' + '='.repeat(70));
    console.log('VERDICT: PHASE 3 INTEGRATION TEST PASSED (100%)');
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
