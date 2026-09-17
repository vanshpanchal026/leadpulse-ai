/**
 * LeadPulse AI V2 — Phase 7 End-to-End Integration Verification Script
 *
 * Proves the complete Phase 7 pipeline:
 * Next.js Environment -> Python Worker -> Outreach Agent
 *   -> Deterministic Validator -> Human Approval Queue -> State Transitions
 *   -> Strict Anti-Spam Boundaries & Zero Automatic External Messaging
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
console.log('LeadPulse AI V2 — Phase 7 Integration Verification');
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

    // Step 2: Generate Outreach Draft via POST /api/v1/outreach/draft
    let leadRecord = null;
    await runStep(2, 'Generate and Deterministically Validate Outreach Draft', async () => {
      const payload = {
        lead_id: 'phase7_live_lead_01',
        business_name: 'Apex Dental Spa',
        primary_problem: 'Active paid Meta Ads lack direct WhatsApp lead capture',
        recommended_service: 'whatsapp_automation',
        why_this_service: 'Connects paid ad clickers directly to 24/7 automated qualification',
        confidence: 0.88,
        opportunity_score: 92.0,
        evidence: [
          {
            finding: 'Active paid Meta ad campaign promoting cosmetic dentistry',
            source: 'ads',
            evidence: 'Active creative: 25% off smile makeover',
            confidence: 0.95,
            classification: 'observed',
          },
          {
            finding: 'No direct WhatsApp CTA on website landing page',
            source: 'website',
            evidence: 'Website has phone number only',
            confidence: 0.9,
            classification: 'observed',
          },
        ],
      };

      const res = await fetch(`${workerUrl}/api/v1/outreach/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Outreach draft endpoint failed HTTP ${res.status}: ${errText}`);
      }

      const body = await res.json();
      if (!body.success) throw new Error('Response success=false');
      leadRecord = body.record;

      console.log(`  Lead ID:          ${leadRecord.lead_id}`);
      console.log(`  Draft Message:    "${leadRecord.draft.message}"`);
      console.log(`  Character Count:  ${leadRecord.draft.character_count}/300`);
      console.log(`  Validation Valid: ${leadRecord.validation.valid}`);
      console.log(`  Approval Status:  ${leadRecord.approval_status}`);
      console.log(`  Hard Boundary:    external_send_executed=${body.external_send_executed}`);

      if (leadRecord.draft.character_count > 300) {
        throw new Error(`Draft message length ${leadRecord.draft.character_count} exceeds 300 characters`);
      }
      if (leadRecord.approval_status !== 'awaiting_human_approval') {
        throw new Error(`Initial status must be awaiting_human_approval, got ${leadRecord.approval_status}`);
      }
      if (body.external_send_executed !== false) {
        throw new Error('SECURITY VIOLATION: external_send_executed must be false');
      }
    });

    // Step 3: Verify Deterministic Re-Validation on Human Edit
    await runStep(3, 'Verify Deterministic Re-Validation on Human Edit', async () => {
      // 3A: Valid edit
      const validEditMsg = 'I noticed your clinic runs active Instagram ads. However, your landing page lacks a direct WhatsApp chat option. Adding instant messaging could help capture more patient inquiries.';
      const resValid = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: validEditMsg }),
      });
      if (!resValid.ok) throw new Error(`Valid edit failed with status ${resValid.status}`);
      const validData = await resValid.json();
      if (!validData.record.validation.valid) throw new Error('Expected valid edit to pass validation');
      console.log(`  [3A PASS] Valid edit re-validated successfully.`);

      // 3B: Edit with prohibited banned phrase
      const badEditMsg = 'We help dental practices grow with automated WhatsApp bots. Hop on a call to learn more.';
      const resBad = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: badEditMsg }),
      });
      if (!resBad.ok) throw new Error(`Bad edit request failed with HTTP ${resBad.status}`);
      const badData = await resBad.json();
      if (badData.record.validation.valid !== false) {
        throw new Error('Expected banned phrase edit to fail validation');
      }
      if (!badData.record.validation.banned_phrase_found) {
        throw new Error('Expected banned_phrase_found=true');
      }
      console.log(`  [3B PASS] Prohibited edit correctly rejected with banned_phrase_found=true.`);

      // 3C: Verify approval is blocked on invalid draft
      const resBlockApprove = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/approve`, {
        method: 'POST',
      });
      if (resBlockApprove.status !== 400) {
        throw new Error(`Expected HTTP 400 when approving invalid draft, got ${resBlockApprove.status}`);
      }
      console.log(`  [3C PASS] Approval strictly blocked for invalid/rejected draft.`);

      // Restore valid edit before proceeding to step 4
      await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: validEditMsg }),
      });
    });

    // Step 4: Verify Human Approval State Transition (No Sending)
    await runStep(4, 'Verify Human Approval Boundary (No Automatic External Send)', async () => {
      const res = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'lead_operator', notes: 'Verified and approved' }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Approve endpoint failed HTTP ${res.status}: ${text}`);
      }

      const body = await res.json();
      if (body.record.approval_status !== 'approved') {
        throw new Error(`Expected approval_status='approved', got ${body.record.approval_status}`);
      }
      if (body.external_send_executed !== false) {
        throw new Error('SECURITY VIOLATION: external_send_executed must be false');
      }
      console.log(`  Approval State: ${body.record.approval_status}`);
      console.log(`  External Send:  ${body.external_send_executed} (Zero messages dispatched)`);
    });

    // Step 5: Verify Human Rejection State Transition
    await runStep(5, 'Verify Human Rejection Boundary', async () => {
      const res = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Vertical not in current priority cohort' }),
      });

      if (!res.ok) throw new Error(`Reject endpoint failed HTTP ${res.status}`);
      const body = await res.json();
      if (body.record.approval_status !== 'rejected') {
        throw new Error(`Expected approval_status='rejected', got ${body.record.approval_status}`);
      }
      console.log(`  Rejection State: ${body.record.approval_status}`);
    });

    // Step 6: Verify Zero Credential Leakage
    await runStep(6, 'Verify Zero Credential Leakage Across Outreach Endpoints', async () => {
      const res = await fetch(`${workerUrl}/api/v1/outreach/phase7_live_lead_01`);
      if (!res.ok) throw new Error(`GET /outreach failed HTTP ${res.status}`);
      const bodyText = await res.text();

      if (bodyText.includes(apiKey)) {
        throw new Error('SECURITY VIOLATION: Secret AI_API_KEY leaked in outreach response body');
      }
      console.log('  Confirmed zero secret key leakage across response body.');
    });

    console.log('\n' + '='.repeat(70));
    console.log('ALL PHASE 7 INTEGRATION CHECKS PASSED SUCCESSFULLY');
    console.log('='.repeat(70));
  } finally {
    stopWorker();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  stopWorker();
  process.exit(1);
});
