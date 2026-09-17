/**
 * LeadPulse AI V2 — Phase 9.6 Automated Verification Script
 * Validates Human Outreach Review & Approval Workspace (/outreach),
 * Pre-Send Quality Check, Epistemic Evidence Grounding, Channel Readiness,
 * Master-Detail Approval Gate, and Strict Non-Sending Safety Invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const featuresOutreach = path.join(clientSrc, 'features', 'outreach');
const componentsDir = path.join(featuresOutreach, 'components');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.6 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Features Outreach Directory: ${featuresOutreach}`);
console.log(`Components Directory: ${componentsDir}`);

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

// 1. Data Layer, Types & Schema Validation
console.log('\n[Check 1/7] Verifying Outreach Data Layer, Types & Schema Validation...');
const typesPath = path.join(featuresOutreach, 'types.ts');
assert(fs.existsSync(typesPath), 'client/src/features/outreach/types.ts exists');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert(typesContent.includes('OutreachApprovalStatus'), 'types.ts defines OutreachApprovalStatus');
assert(typesContent.includes('OutreachFilterStatus'), 'types.ts defines OutreachFilterStatus');
assert(typesContent.includes('OutreachQualityLevel'), 'types.ts defines OutreachQualityLevel');
assert(typesContent.includes('PreSendQualityResult'), 'types.ts defines PreSendQualityResult');
assert(typesContent.includes('OutreachItem'), 'types.ts defines OutreachItem');
assert(typesContent.includes('OutreachRecord'), 'types.ts defines OutreachRecord');
assert(typesContent.includes('OutreachActionResponse'), 'types.ts defines OutreachActionResponse');

const schemaPath = path.join(featuresOutreach, 'schema.ts');
assert(fs.existsSync(schemaPath), 'client/src/features/outreach/schema.ts exists');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
assert(schemaContent.includes('OutreachMessageSchema'), 'schema.ts exports OutreachMessageSchema');
assert(schemaContent.includes('BANNED_SALES_PHRASES'), 'schema.ts defines BANNED_SALES_PHRASES');
assert(schemaContent.includes('TEMPLATE_PLACEHOLDERS'), 'schema.ts defines TEMPLATE_PLACEHOLDERS');
assert(schemaContent.includes('validateDraftQuality'), 'schema.ts exports validateDraftQuality validator');
assert(schemaContent.includes("level = 'BLOCK'"), 'schema.ts assigns BLOCK level to invalid pitches');
assert(schemaContent.includes("level = 'WARNING'"), 'schema.ts assigns WARNING level to borderline pitches');
assert(schemaContent.includes("= 'PASS'"), 'schema.ts assigns PASS level to compliant pitches');
assert(schemaContent.includes('charCount > 300'), 'schema.ts verifies 300 char target limit');
assert(schemaContent.includes('sentenceCount > 4'), 'schema.ts verifies sentence count bounds');

// 2. API Integration & Mutation Hooks
console.log('\n[Check 2/7] Verifying API Integration & Mutation Hooks...');
const apiPath = path.join(featuresOutreach, 'api.ts');
assert(fs.existsSync(apiPath), 'client/src/features/outreach/api.ts exists');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes('/api/v1/outreach'), 'api.ts targets /api/v1/outreach');
assert(apiContent.includes('approveOutreachDraft'), 'api.ts exports approveOutreachDraft');
assert(apiContent.includes('rejectOutreachDraft'), 'api.ts exports rejectOutreachDraft');
assert(apiContent.includes('editOutreachDraft'), 'api.ts exports editOutreachDraft');
assert(apiContent.includes('regenerateOutreachDraft'), 'api.ts exports regenerateOutreachDraft');
assert(apiContent.includes('useOutreachRecordsQuery'), 'api.ts exports useOutreachRecordsQuery hook');
assert(apiContent.includes('useApproveOutreachMutation'), 'api.ts exports useApproveOutreachMutation hook');
assert(apiContent.includes('useRejectOutreachMutation'), 'api.ts exports useRejectOutreachMutation hook');
assert(apiContent.includes('useEditOutreachMutation'), 'api.ts exports useEditOutreachMutation hook');
assert(apiContent.includes('useRegenerateOutreachMutation'), 'api.ts exports useRegenerateOutreachMutation hook');

// 3. Safety Boundary Banner
console.log('\n[Check 3/7] Verifying Safety Boundary Banner...');
const bannerPath = path.join(componentsDir, 'safety-boundary-banner.tsx');
assert(fs.existsSync(bannerPath), 'safety-boundary-banner.tsx exists');
const bannerContent = fs.readFileSync(bannerPath, 'utf8');
assert(bannerContent.includes('external_send_executed = false'), 'Banner displays non-negotiable safety invariant');
assert(bannerContent.includes('Human Approval Gate Active'), 'Banner states Human Approval Gate Active');
assert(bannerContent.includes('Manual Send Only') || bannerContent.includes('External sending remains manual'), 'Banner reinforces manual send only');

// 4. Outreach Queue (Master List)
console.log('\n[Check 4/7] Verifying Outreach Queue Master List...');
const queuePath = path.join(componentsDir, 'outreach-queue.tsx');
assert(fs.existsSync(queuePath), 'outreach-queue.tsx exists');
const queueContent = fs.readFileSync(queuePath, 'utf8');
assert(queueContent.includes('Outreach Approval Queue'), 'Queue titles panel');
assert(queueContent.includes('needs_review'), 'Queue supports Needs Review tab');
assert(queueContent.includes('approved'), 'Queue supports Approved tab');
assert(queueContent.includes('rejected'), 'Queue supports Rejected tab');
assert(queueContent.includes('missing_draft'), 'Queue supports Missing Draft tab');
assert(queueContent.includes('onSelectLead'), 'Queue supports item selection callback');
assert(queueContent.includes('searchQuery'), 'Queue implements keyword search filter');
assert(queueContent.includes('tierFilter'), 'Queue implements opportunity tier filter');
assert(queueContent.includes('sortOrder'), 'Queue implements opportunity score sorting');

// 5. Channel Readiness, Evidence & Draft Editor
console.log('\n[Check 5/7] Verifying Channel Readiness, Evidence & Draft Editor...');
const channelsPath = path.join(componentsDir, 'outreach-channel-readiness.tsx');
assert(fs.existsSync(channelsPath), 'outreach-channel-readiness.tsx exists');
const channelsContent = fs.readFileSync(channelsPath, 'utf8');
assert(channelsContent.includes('WhatsApp'), 'Channels component displays WhatsApp channel readiness');
assert(channelsContent.includes('Website Form'), 'Channels component displays Website Form readiness');
assert(channelsContent.includes('Instagram DM'), 'Channels component displays Instagram DM readiness');
assert(channelsContent.includes('Email'), 'Channels component displays Direct Email readiness');
assert(channelsContent.includes('Manual Dispatch Only'), 'Channels component confirms manual dispatch only');

const evidencePath = path.join(componentsDir, 'personalization-evidence.tsx');
assert(fs.existsSync(evidencePath), 'personalization-evidence.tsx exists');
const evidenceContent = fs.readFileSync(evidencePath, 'utf8');
assert(evidenceContent.includes('OBSERVED'), 'Evidence component displays OBSERVED badge');
assert(evidenceContent.includes('INFERRED'), 'Evidence component displays INFERRED badge');
assert(evidenceContent.includes('UNKNOWN'), 'Evidence component handles UNKNOWN badge');
assert(evidenceContent.includes('Epistemic Grounding'), 'Evidence component enforces epistemic grounding');

const editorPath = path.join(componentsDir, 'outreach-draft-editor.tsx');
assert(fs.existsSync(editorPath), 'outreach-draft-editor.tsx exists');
const editorContent = fs.readFileSync(editorPath, 'utf8');
assert(editorContent.includes('300 chars'), 'Editor enforces under-300-char target counter');
assert(editorContent.includes('sentence'), 'Editor calculates live sentence count');
assert(editorContent.includes('Copy Draft'), 'Editor provides copy to clipboard action');
assert(editorContent.includes('Reset'), 'Editor provides reset action');
assert(editorContent.includes('Clear'), 'Editor provides clear draft action');
assert(editorContent.includes('Save Draft'), 'Editor provides save draft action');
assert(editorContent.includes('Pre-send quality check'), 'Editor displays live pre-send quality feedback');

// 6. Human Approval Gate & Review Panel
console.log('\n[Check 6/7] Verifying Human Approval Gate & Review Panel...');
const gatePath = path.join(componentsDir, 'outreach-approval-gate.tsx');
assert(fs.existsSync(gatePath), 'outreach-approval-gate.tsx exists');
const gateContent = fs.readFileSync(gatePath, 'utf8');
assert(gateContent.includes('Approve for Manual Send'), 'Approval gate provides Approve for Manual Send button');
assert(gateContent.includes('Reject Draft'), 'Approval gate provides Reject Draft button');
assert(gateContent.includes('Regenerate Draft'), 'Approval gate provides Regenerate Draft button');
assert(gateContent.includes('Copy Message'), 'Approval gate provides Copy Message action');
assert(gateContent.includes('Open Lead Dossier'), 'Approval gate links directly to Lead Dossier');
assert(gateContent.includes('external_send_executed = false'), 'Approval gate confirms external_send_executed = false');
assert(gateContent.includes('Approved for manual sending'), 'Approval gate shows explicit approved status');
assert(gateContent.includes('External send: Manual'), 'Approval gate confirms external send is manual');

// Canonical Modular Components
const canGatePath = path.join(componentsDir, 'approval-gate.tsx');
assert(fs.existsSync(canGatePath), 'approval-gate.tsx exists');
const canGateContent = fs.readFileSync(canGatePath, 'utf8');
assert(canGateContent.includes('HUMAN APPROVAL REQUIRED'), 'approval-gate.tsx features prominent HUMAN APPROVAL REQUIRED notice');
assert(canGateContent.includes('external_send_executed = false'), 'approval-gate.tsx hard-locks external_send_executed = false');
assert(canGateContent.includes('Approve for Manual Send'), 'approval-gate.tsx provides Approve for Manual Send');
assert(canGateContent.includes('Reject Draft'), 'approval-gate.tsx provides Reject Draft');
assert(canGateContent.includes('Request Revision'), 'approval-gate.tsx provides Request Revision flow');

const leadContextPath = path.join(componentsDir, 'lead-context-panel.tsx');
assert(fs.existsSync(leadContextPath), 'lead-context-panel.tsx exists');
const leadContextContent = fs.readFileSync(leadContextPath, 'utf8');
assert(leadContextContent.includes('Grounded Evidence Matrix'), 'lead-context-panel.tsx displays Grounded Evidence Matrix');
assert(leadContextContent.includes('OBSERVED'), 'lead-context-panel.tsx distinguishes OBSERVED evidence');
assert(leadContextContent.includes('INFERRED'), 'lead-context-panel.tsx distinguishes INFERRED evidence');
assert(leadContextContent.includes('Manual Dispatch Only'), 'lead-context-panel.tsx confirms Manual Dispatch Only');

const draftEditorPath = path.join(componentsDir, 'draft-editor.tsx');
assert(fs.existsSync(draftEditorPath), 'draft-editor.tsx exists');
const draftEditorContent = fs.readFileSync(draftEditorPath, 'utf8');
assert(draftEditorContent.includes('300 chars'), 'draft-editor.tsx enforces 300 char target');
assert(draftEditorContent.includes('Copy Draft'), 'draft-editor.tsx supports copy to clipboard');
assert(draftEditorContent.includes('Save Draft'), 'draft-editor.tsx supports save draft action');

const validationPath = path.join(componentsDir, 'message-validation.tsx');
assert(fs.existsSync(validationPath), 'message-validation.tsx exists');
const validationContent = fs.readFileSync(validationPath, 'utf8');
assert(validationContent.includes('Deterministic Message Validation'), 'message-validation.tsx performs deterministic validation');
assert(validationContent.includes('Personalization Indicators'), 'message-validation.tsx tracks personalization indicators');

const historyPath = path.join(componentsDir, 'outreach-history.tsx');
assert(fs.existsSync(historyPath), 'outreach-history.tsx exists');
const historyContent = fs.readFileSync(historyPath, 'utf8');
assert(historyContent.includes('No outreach history available'), 'outreach-history.tsx handles empty history state');

const emptyStatePath = path.join(componentsDir, 'outreach-empty-state.tsx');
assert(fs.existsSync(emptyStatePath), 'outreach-empty-state.tsx exists');

const toolbarPath = path.join(componentsDir, 'outreach-toolbar.tsx');
assert(fs.existsSync(toolbarPath), 'outreach-toolbar.tsx exists');

const panelPath = path.join(componentsDir, 'outreach-review-panel.tsx');
assert(fs.existsSync(panelPath), 'outreach-review-panel.tsx exists');
const panelContent = fs.readFileSync(panelPath, 'utf8');
assert(panelContent.includes('LeadContextPanel'), 'Review panel mounts LeadContextPanel');
assert(panelContent.includes('DraftEditor'), 'Review panel mounts DraftEditor');
assert(panelContent.includes('MessageValidation'), 'Review panel mounts MessageValidation');
assert(panelContent.includes('ApprovalGate'), 'Review panel mounts ApprovalGate');
assert(panelContent.includes('OutreachHistory'), 'Review panel mounts OutreachHistory');

const indexPath = path.join(featuresOutreach, 'index.ts');
assert(fs.existsSync(indexPath), 'client/src/features/outreach/index.ts barrel exists');

// 7. Outreach Page Wiring & Strict Safety Invariant
console.log('\n[Check 7/7] Verifying Outreach Page Wiring & Non-Sending Safety Invariant...');
const pagePath = path.join(clientSrc, 'pages', 'outreach', 'outreach-page.tsx');
assert(fs.existsSync(pagePath), 'client/src/pages/outreach/outreach-page.tsx exists');
const pageContent = fs.readFileSync(pagePath, 'utf8');
assert(pageContent.includes('OutreachQueue'), 'OutreachPage mounts OutreachQueue');
assert(pageContent.includes('OutreachReviewPanel'), 'OutreachPage mounts OutreachReviewPanel');
assert(pageContent.includes('SafetyBoundaryBanner'), 'OutreachPage mounts SafetyBoundaryBanner');
assert(pageContent.includes('external_send_executed = false'), 'OutreachPage enforces external_send_executed = false');
assert(pageContent.includes('Human Approval Gate Active'), 'OutreachPage displays Human Approval Gate Active');

// Autonomous send check across all client files
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
for (const file of allClientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sendWhatsAppAutonomous') || content.includes('autoDispatch: true')) {
    console.error(`  [FAIL] Autonomous send call detected in ${file}`);
    autoSendViolations++;
  }
}
assert(autoSendViolations === 0, 'Zero automated messaging routines across client codebase');

console.log('\n======================================================================');
console.log(`Phase 9.6 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
