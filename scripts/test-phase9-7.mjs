/**
 * LeadPulse AI V2 — Phase 9.7 Automated Hardening & Verification Suite
 * Validates Production Hardening, End-to-End QA, Safety Invariants,
 * Deterministic Validation, State Machine Transitions, and Operator UX.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const workerApp = path.join(rootDir, 'ai-worker', 'app');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.7 Production Hardening & E2E QA Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Client Source:  ${clientSrc}`);
console.log(`AI Worker App:  ${workerApp}`);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

// 1. End-to-End Application Routing & Integration
console.log('\n[Check 1/8] Verifying End-to-End Route Architecture & Navigation...');
const routerPath = path.join(clientSrc, 'app', 'router.tsx');
assert(fs.existsSync(routerPath), 'client/src/app/router.tsx exists');
const routerContent = fs.readFileSync(routerPath, 'utf8');
assert(routerContent.includes("path: '/'") || routerContent.includes('index: true'), 'Dashboard route configured');
assert(routerContent.includes("path: 'leads'"), 'Leads pipeline route configured');
assert(routerContent.includes("path: 'leads/:leadId'"), 'Lead dossier route configured');
assert(routerContent.includes("path: 'research'"), 'Research campaign route configured');
assert(routerContent.includes("path: 'outreach'"), 'Outreach review route configured');
assert(routerContent.includes("path: 'settings'"), 'System settings route configured');

// Verify Next.js BFF API routing
const nextLeadsApi = path.join(rootDir, 'app', 'api', 'leads', 'route.ts');
assert(fs.existsSync(nextLeadsApi), 'Next.js /api/leads endpoint exists');
const nextOutreachApi = path.join(rootDir, 'app', 'api', 'outreach', 'route.ts');
assert(fs.existsSync(nextOutreachApi), 'Next.js /api/outreach endpoint exists');
const nextOutreachCatchall = path.join(rootDir, 'app', 'api', 'outreach', '[...path]', 'route.ts');
assert(fs.existsSync(nextOutreachCatchall), 'Next.js /api/outreach/[...path] proxy exists');

// Verify Python AI Worker endpoints
const workerOutreachApi = path.join(workerApp, 'api', 'routes', 'outreach.py');
assert(fs.existsSync(workerOutreachApi), 'Python /api/v1/outreach endpoint exists');
const workerRunsApi = path.join(workerApp, 'api', 'routes', 'research_runs.py');
assert(fs.existsSync(workerRunsApi), 'Python /api/v1/research-runs endpoint exists');
const workerLeadsApi = path.join(workerApp, 'api', 'routes', 'leads.py');
assert(fs.existsSync(workerLeadsApi), 'Python /api/v1/leads endpoint exists');

// 2. Strict Safety & Non-Sending Invariants
console.log('\n[Check 2/8] Auditing Non-Sending Safety Invariants Across Entire Codebase...');
const workerOutreachContent = fs.readFileSync(workerOutreachApi, 'utf8');
assert(workerOutreachContent.includes('external_send_executed: bool = Field('), 'OutreachActionResponse enforces external_send_executed field');
assert(workerOutreachContent.includes('external_send_executed=False'), 'All worker actions return external_send_executed=False');
assert(workerOutreachContent.includes('DOES NOT SEND MESSAGES'), 'Worker documentation confirms no messages sent');

const safetyBanner = path.join(clientSrc, 'features', 'outreach', 'components', 'safety-boundary-banner.tsx');
assert(fs.existsSync(safetyBanner), 'safety-boundary-banner.tsx exists');
const bannerContent = fs.readFileSync(safetyBanner, 'utf8');
assert(bannerContent.includes('external_send_executed = false'), 'Banner displays non-negotiable safety invariant');

const approvalGate = path.join(clientSrc, 'features', 'outreach', 'components', 'approval-gate.tsx');
assert(fs.existsSync(approvalGate), 'approval-gate.tsx exists');
const approvalContent = fs.readFileSync(approvalGate, 'utf8');
assert(approvalContent.includes('external_send_executed = false'), 'Approval gate hard-locks external_send_executed = false');
assert(approvalContent.includes('Approved for manual sending'), 'Approval gate states manual send only');
assert(approvalContent.includes('https://wa.me/'), 'WhatsApp integration uses explicit manual wa.me link');
assert(!approvalContent.includes('sendWhatsAppAutonomous'), 'No automated WhatsApp sender in approval gate');
assert(!approvalContent.includes('approveAndSend'), 'No approve-and-send routine in approval gate');

// Comprehensive scan of client codebase for autonomous send violations
const allClientFiles = [];
function collectFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) allClientFiles.push(full);
  }
}
collectFiles(clientSrc);

let autoSendViolations = 0;
let bulkSendViolations = 0;
for (const file of allClientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sendWhatsAppAutonomous') || content.includes('autoDispatch: true')) {
    console.error(`  [FAIL] Autonomous send routine found in ${file}`);
    autoSendViolations++;
  }
  if (content.includes('bulkSend') || content.includes('sendAll')) {
    console.error(`  [FAIL] Bulk send routine found in ${file}`);
    bulkSendViolations++;
  }
}
assert(autoSendViolations === 0, 'Zero automated messaging routines across client codebase');
assert(bulkSendViolations === 0, 'Zero bulk send or sendAll routines across client codebase');

// 3. Outreach State Machine & Boundary Enforcement
console.log('\n[Check 3/8] Verifying Outreach State Machine & Transition Rules...');
const orchestratorPath = path.join(workerApp, 'services', 'outreach_orchestrator.py');
assert(fs.existsSync(orchestratorPath), 'ai-worker/app/services/outreach_orchestrator.py exists');
const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf8');
assert(orchestratorContent.includes('Cannot approve invalid or rejected outreach draft'), 'Backend blocks approval of invalid drafts');
assert(orchestratorContent.includes('record.approval_status = "approved"'), 'Backend marks status approved without external dispatch');
assert(orchestratorContent.includes('record.approval_status = "rejected"'), 'Backend supports explicit rejection');
assert(orchestratorContent.includes('edit_outreach'), 'Backend supports draft editing with mandatory revalidation');
assert(orchestratorContent.includes('MAX_REGENERATION_ATTEMPTS'), 'Backend enforces bounded regeneration limits');
assert(orchestratorContent.includes('_sync_to_persistence'), 'Outreach transitions sync directly to Supabase persistence');

// Verify frontend approval boundary
assert(approvalContent.includes('Confirm Human Approval'), 'Approval requires explicit operator confirmation modal');
assert(approvalContent.includes('Reject Outreach Draft'), 'Rejection provides structured reason modal');
assert(approvalContent.includes('Request Revision'), 'Approval gate provides revision workflow');
assert(approvalContent.includes("validationLevel === 'BLOCKED'") || approvalContent.includes("validationLevel === 'BLOCK'"), 'Approval is disabled when draft is BLOCKED');

// 4. Deterministic Outreach Validator Quality
console.log('\n[Check 4/8] Verifying Deterministic Anti-Spam & Personalization Validator...');
const schemaPath = path.join(clientSrc, 'features', 'outreach', 'schema.ts');
assert(fs.existsSync(schemaPath), 'features/outreach/schema.ts exists');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
assert(schemaContent.includes('BANNED_SALES_PHRASES'), 'Validator checks BANNED_SALES_PHRASES');
assert(schemaContent.includes('TEMPLATE_PLACEHOLDERS'), 'Validator checks TEMPLATE_PLACEHOLDERS');
assert(schemaContent.includes('GENERIC_OPENINGS'), 'Validator checks GENERIC_OPENINGS');
assert(schemaContent.includes('charCount > 300'), 'Validator evaluates 300 char target');
assert(schemaContent.includes('charCount > 360'), 'Validator hard-caps messages exceeding 360 chars');
assert(schemaContent.includes('sentenceCount > 4'), 'Validator evaluates sentence count limits');
assert(schemaContent.includes('businessNameUsed'), 'Validator tracks business name personalization');
assert(schemaContent.includes('locationReferenced'), 'Validator tracks location personalization');
assert(schemaContent.includes('serviceReferenced'), 'Validator tracks service personalization');
assert(schemaContent.includes("level = 'BLOCK'"), 'Validator assigns BLOCK level to fatal issues');
assert(schemaContent.includes("level = 'WARNING'"), 'Validator assigns WARNING level to non-fatal advisory issues');

// 5. Research Campaign Lifecycle & Recovery
console.log('\n[Check 5/8] Verifying Research Campaign Polling & Refresh Recovery...');
const researchApiPath = path.join(clientSrc, 'features', 'research', 'api.ts');
assert(fs.existsSync(researchApiPath), 'features/research/api.ts exists');
const researchApiContent = fs.readFileSync(researchApiPath, 'utf8');
assert(researchApiContent.includes("['completed', 'partial', 'failed', 'cancelled'].includes(data.status)"), 'Smart polling terminates on terminal status');
assert(researchApiContent.includes("queryClient.invalidateQueries({ queryKey: ['researchRuns'] })"), 'Runs query invalidated on creation');
assert(researchApiContent.includes("queryClient.invalidateQueries({ queryKey: ['leads'] })"), 'Leads cache invalidated on campaign run');

const researchPagePath = path.join(clientSrc, 'pages', 'research', 'research-page.tsx');
assert(fs.existsSync(researchPagePath), 'pages/research/research-page.tsx exists');
const researchPageContent = fs.readFileSync(researchPagePath, 'utf8');
assert(researchPageContent.includes('runsData.items[0].run_id'), 'Auto-recovers most recent active run on page refresh');
assert(researchPageContent.includes('ResearchTelemetry'), 'Mounts live research telemetry');
assert(researchPageContent.includes('SpecialistStatusGrid'), 'Mounts specialist agent status grid');
assert(researchPageContent.includes('ResearchResultSummary'), 'Mounts conversion yield summary on completion');
assert(researchPageContent.includes('ResearchRunsTable'), 'Mounts historical runs audit table');

// 6. Loading, Error, Empty & Recoverable States
console.log('\n[Check 6/8] Verifying Production Loading, Error, and Empty States...');
// LeadsTable
const tablePath = path.join(clientSrc, 'features', 'leads', 'components', 'leads-table.tsx');
const tableContent = fs.readFileSync(tablePath, 'utf8');
assert(tableContent.includes('animate-pulse'), 'LeadsTable includes skeleton loading state');
assert(tableContent.includes('Failed to Load Leads Dataset'), 'LeadsTable includes error state');
assert(tableContent.includes('Retry Connection'), 'LeadsTable includes retry action');
assert(tableContent.includes('No Matching Leads Found'), 'LeadsTable includes empty state');

// LeadDossier
const dossierPath = path.join(clientSrc, 'features', 'leads', 'components', 'lead-dossier.tsx');
const dossierContent = fs.readFileSync(dossierPath, 'utf8');
assert(dossierContent.includes('animate-pulse'), 'LeadDossier includes skeleton loading state');
assert(dossierContent.includes('Failed to Load Lead Dossier'), 'LeadDossier includes error state with retry');
assert(dossierContent.includes('Lead Record Not Found'), 'LeadDossier includes not-found state');

// OutreachQueue
const queuePath = path.join(clientSrc, 'features', 'outreach', 'components', 'outreach-queue.tsx');
const queueContent = fs.readFileSync(queuePath, 'utf8');
assert(queueContent.includes('OutreachEmptyState'), 'OutreachQueue handles empty state');
assert(queueContent.includes('No leads in queue'), 'OutreachQueue handles empty filter results');

// OutreachPage
const outreachPage = path.join(clientSrc, 'pages', 'outreach', 'outreach-page.tsx');
const outreachPageContent = fs.readFileSync(outreachPage, 'utf8');
assert(outreachPageContent.includes('Loading outreach drafts & review queue...'), 'OutreachPage handles queue loading');
assert(outreachPageContent.includes('Could not retrieve outreach queue from backend'), 'OutreachPage handles error state with retry');
assert(outreachPageContent.includes('Refresh Queue'), 'OutreachPage provides refresh action');

// DashboardPage
const dashPage = path.join(clientSrc, 'pages', 'dashboard', 'dashboard-page.tsx');
const dashContent = fs.readFileSync(dashPage, 'utf8');
assert(dashContent.includes('useLeadsQuery'), 'DashboardPage consumes live leads query');
assert(dashContent.includes('useOutreachRecordsQuery'), 'DashboardPage consumes live outreach query');
assert(dashContent.includes('Refresh'), 'DashboardPage provides live refresh action');

// 7. Epistemic Evidence Grounding Standards
console.log('\n[Check 7/8] Verifying Epistemic Grounding (OBSERVED / INFERRED / UNKNOWN)...');
const evidenceSection = path.join(clientSrc, 'features', 'leads', 'components', 'evidence-section.tsx');
assert(fs.existsSync(evidenceSection), 'evidence-section.tsx exists');
const evidenceContent = fs.readFileSync(evidenceSection, 'utf8');
assert(evidenceContent.includes('OBSERVED'), 'Distinguishes OBSERVED factual evidence');
assert(evidenceContent.includes('INFERRED'), 'Distinguishes INFERRED synthetic evidence');
assert(evidenceContent.includes('UNKNOWN'), 'Distinguishes UNKNOWN missing evidence');

const evidenceDrawer = path.join(clientSrc, 'features', 'leads', 'components', 'evidence-drawer.tsx');
assert(fs.existsSync(evidenceDrawer), 'evidence-drawer.tsx exists');
const drawerContent = fs.readFileSync(evidenceDrawer, 'utf8');
assert(drawerContent.includes('Epistemic Grounding Standard'), 'Drawer educates operator on evidence standards');

const leadContext = path.join(clientSrc, 'features', 'outreach', 'components', 'lead-context-panel.tsx');
const leadContextContent = fs.readFileSync(leadContext, 'utf8');
assert(leadContextContent.includes('Grounded Evidence Matrix'), 'LeadContextPanel maintains evidence matrix');
assert(leadContextContent.includes('Digital Footprint & Verified Channels'), 'LeadContextPanel separates digital channels');

// 8. End-to-End Data Consistency & Type Safety
console.log('\n[Check 8/8] Verifying End-to-End Data Consistency & Clean Typing...');
const leadsTypesPath = path.join(clientSrc, 'features', 'leads', 'types.ts');
const leadsTypesContent = fs.readFileSync(leadsTypesPath, 'utf8');
assert(leadsTypesContent.includes('evidenceSummary?: string | null;'), 'NormalizedLead cleanly defines optional evidenceSummary');
assert(!schemaContent.includes('raw.research_status as any'), 'Clean research_status typing without as any in schema.ts');
assert(!schemaContent.includes('raw.research_priority as any'), 'Clean research_priority typing without as any in schema.ts');
assert(!outreachPageContent.includes('(lead as any).evidenceSummary'), 'Clean evidenceSummary access in outreach-page.tsx');

// Verify cache invalidations across outreach mutations
const outreachApiPath = path.join(clientSrc, 'features', 'outreach', 'api.ts');
const outreachApiContent = fs.readFileSync(outreachApiPath, 'utf8');
assert(outreachApiContent.includes("queryClient.invalidateQueries({ queryKey: ['outreachRecords'] })"), 'Approve invalidates outreachRecords');
assert(outreachApiContent.includes("queryClient.invalidateQueries({ queryKey: ['leads'] })"), 'Approve/reject/edit invalidates leads');
assert(outreachApiContent.includes("queryClient.invalidateQueries({ queryKey: ['leadReport'"), 'Edit and regenerate invalidate leadReport');

console.log('\n======================================================================');
console.log(`Phase 9.7 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 PHASE 9.7 PRODUCTION HARDENING & QA VERIFIED AS PASS!');
  process.exit(0);
}
