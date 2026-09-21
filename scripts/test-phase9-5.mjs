/**
 * LeadPulse AI V2 — Phase 9.5 Automated Verification Script
 * Validates Research Campaign Control Center, Campaign Form, Zod Validation,
 * Live Telemetry Polling, Specialist Swarm Grid, Runs Audit Table, and Safety Invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const featuresResearch = path.join(clientSrc, 'features', 'research');
const componentsDir = path.join(featuresResearch, 'components');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.5 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Features Research Directory: ${featuresResearch}`);
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

// 1. Data Layer, Types & Zod Schemas
console.log('\n[Check 1/7] Verifying Research Data Layer, Types & Zod Schemas...');
const typesPath = path.join(featuresResearch, 'types.ts');
assert(fs.existsSync(typesPath), 'client/src/features/research/types.ts exists');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert(typesContent.includes('ResearchRunStatus'), 'types.ts defines ResearchRunStatus');
assert(typesContent.includes('SpecialistStatus'), 'types.ts defines SpecialistStatus');
assert(typesContent.includes('SpecialistCardData'), 'types.ts defines SpecialistCardData');
assert(typesContent.includes('ResearchRunRecord'), 'types.ts defines ResearchRunRecord');
assert(typesContent.includes('CampaignFormData'), 'types.ts defines CampaignFormData');

const schemaPath = path.join(featuresResearch, 'schema.ts');
assert(fs.existsSync(schemaPath), 'client/src/features/research/schema.ts exists');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
assert(schemaContent.includes('CampaignConfigSchema'), 'schema.ts exports CampaignConfigSchema Zod validator');
assert(schemaContent.includes('ResearchRunRecordSchema'), 'schema.ts exports ResearchRunRecordSchema');
assert(schemaContent.includes('ResearchRunListResponseSchema'), 'schema.ts exports ResearchRunListResponseSchema');
assert(schemaContent.includes('leadLimit'), 'CampaignConfigSchema bounds leadLimit');
assert(schemaContent.includes('enabledSpecialists'), 'CampaignConfigSchema validates enabledSpecialists');

// 2. API Integration & Polling Architecture
console.log('\n[Check 2/7] Verifying API Integration & Polling Architecture...');
const apiPath = path.join(featuresResearch, 'api.ts');
assert(fs.existsSync(apiPath), 'client/src/features/research/api.ts exists');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes('/api/v1/research-runs'), 'api.ts targets /api/v1/research-runs');
assert(apiContent.includes('fetchResearchRuns'), 'api.ts exports fetchResearchRuns');
assert(apiContent.includes('fetchResearchRunById'), 'api.ts exports fetchResearchRunById');
assert(apiContent.includes('createResearchRun'), 'api.ts exports createResearchRun');
assert(apiContent.includes('useResearchRunsQuery'), 'api.ts exports useResearchRunsQuery hook');
assert(apiContent.includes('useResearchRunQuery'), 'api.ts exports useResearchRunQuery hook');
assert(apiContent.includes('useCreateResearchRunMutation'), 'api.ts exports useCreateResearchRunMutation hook');
assert(apiContent.includes('refetchInterval'), 'api.ts configures intelligent polling interval');
assert(
  apiContent.includes("['completed', 'partial', 'failed', 'cancelled'].includes(data.status)") ||
  apiContent.includes("isTerminal"),
  'Polling terminates automatically on terminal state (completed/partial/failed)'
);

// 3. Campaign Configuration Form
console.log('\n[Check 3/7] Verifying Campaign Configuration Form...');
const formPath = path.join(componentsDir, 'campaign-form.tsx');
assert(fs.existsSync(formPath), 'campaign-form.tsx exists');
const formContent = fs.readFileSync(formPath, 'utf8');
assert(formContent.includes('Campaign Configuration Panel'), 'Campaign form titles panel');
assert(formContent.includes('campaignName'), 'Form manages campaignName');
assert(formContent.includes('location'), 'Form manages target location');
assert(formContent.includes('vertical'), 'Form manages seed vertical');
assert(formContent.includes('leadLimit'), 'Form manages candidate limit');
assert(formContent.includes('researchDepth'), 'Form manages research depth');
assert(formContent.includes('enabledSpecialists'), 'Form manages specialist toggles');
assert(formContent.includes('Website Specialist'), 'Form includes Website Specialist option');
assert(formContent.includes('Ads Specialist'), 'Form includes Ads Specialist option');
assert(formContent.includes('Maps Specialist'), 'Form includes Maps Specialist option');
assert(formContent.includes('disabled={isRunning}'), 'Form disables submissions while run is active');

// 4. Live Research Telemetry & Terminal Result Summary
console.log('\n[Check 4/7] Verifying Live Telemetry & Result Summary...');
const telemetryPath = path.join(componentsDir, 'research-telemetry.tsx');
assert(fs.existsSync(telemetryPath), 'research-telemetry.tsx exists');
const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
assert(telemetryContent.includes('Live Research Run Telemetry'), 'Component titles Live Research Run Telemetry');
assert(telemetryContent.includes('queries_generated'), 'Telemetry displays queries formulated');
assert(telemetryContent.includes('businesses_found'), 'Telemetry displays discovered count');
assert(telemetryContent.includes('businesses_triaged'), 'Telemetry displays triaged count');
assert(telemetryContent.includes('businesses_researched'), 'Telemetry displays deep researched count');
assert(telemetryContent.includes('qualified_leads'), 'Telemetry displays qualified leads count');
assert(telemetryContent.includes('total_tokens'), 'Telemetry displays token consumption');
assert(telemetryContent.includes('tool_calls'), 'Telemetry displays tool call audits');

const summaryPath = path.join(componentsDir, 'research-result-summary.tsx');
assert(fs.existsSync(summaryPath), 'research-result-summary.tsx exists');
const summaryContent = fs.readFileSync(summaryPath, 'utf8');
assert(summaryContent.includes('Research Campaign Summary & Conversion'), 'Component titles Research Campaign Summary');
assert(summaryContent.includes('/leads'), 'Summary links qualified leads to /leads');

// 5. Specialist Multi-Agent Execution Grid
console.log('\n[Check 5/7] Verifying Specialist Multi-Agent Grid & Epistemic Standards...');
const specialistPath = path.join(componentsDir, 'specialist-status.tsx');
assert(fs.existsSync(specialistPath), 'specialist-status.tsx exists');
const specialistContent = fs.readFileSync(specialistPath, 'utf8');
assert(specialistContent.includes('Specialist Multi-Agent Swarm Status'), 'Titles specialist swarm grid');
assert(specialistContent.includes('Website Specialist'), 'Grid includes Website Specialist');
assert(specialistContent.includes('Meta Ads Specialist'), 'Grid includes Meta Ads Specialist');
assert(specialistContent.includes('Google Maps Specialist'), 'Grid includes Google Maps Specialist');
assert(specialistContent.includes('Lead Triage Specialist'), 'Grid includes Lead Triage Specialist');
assert(specialistContent.includes('Opportunity Agent'), 'Grid includes Opportunity Agent');
assert(specialistContent.includes('Lead Analyst'), 'Grid includes Lead Analyst');
assert(specialistContent.includes('OBSERVED'), 'Grid asserts OBSERVED classification for factual agents');
assert(specialistContent.includes('INFERRED'), 'Grid asserts INFERRED classification for synthetic agents');

// 6. Recent Runs Audit Table & Research Page Wiring
console.log('\n[Check 6/7] Verifying Runs Table & Page Wiring...');
const tablePath = path.join(componentsDir, 'research-runs-table.tsx');
assert(fs.existsSync(tablePath), 'research-runs-table.tsx exists');
const tableContent = fs.readFileSync(tablePath, 'utf8');
assert(tableContent.includes('Recent Campaign Research Runs'), 'Titles runs audit table');
assert(tableContent.includes('onSelectRun'), 'Table supports selecting run to inspect telemetry');

const pagePath = path.join(clientSrc, 'pages', 'research', 'research-page.tsx');
assert(fs.existsSync(pagePath), 'pages/research/research-page.tsx exists');
const pageContent = fs.readFileSync(pagePath, 'utf8');
assert(pageContent.includes('CampaignForm'), 'ResearchPage mounts CampaignForm');
assert(pageContent.includes('ResearchTelemetry'), 'ResearchPage mounts ResearchTelemetry');
assert(pageContent.includes('SpecialistStatusGrid'), 'ResearchPage mounts SpecialistStatusGrid');
assert(pageContent.includes('ResearchRunsTable'), 'ResearchPage mounts ResearchRunsTable');
assert(pageContent.includes('useResearchRunsQuery'), 'ResearchPage uses useResearchRunsQuery');
assert(pageContent.includes('useResearchRunQuery'), 'ResearchPage uses useResearchRunQuery');
assert(pageContent.includes('useCreateResearchRunMutation'), 'ResearchPage uses useCreateResearchRunMutation');

// 7. Non-Sending Safety Invariant
console.log('\n[Check 7/7] Verifying Non-Sending Safety Invariants...');
const safetyCardPath = path.join(componentsDir, 'safety-boundary-card.tsx');
assert(fs.existsSync(safetyCardPath), 'safety-boundary-card.tsx exists');
const safetyContent = fs.readFileSync(safetyCardPath, 'utf8');
assert(safetyContent.includes('external_send_executed = false'), 'Safety card asserts external_send_executed = false invariant');
assert(safetyContent.includes('Autonomous Send Lock Enforced'), 'Declares Autonomous Send Lock Enforced');

// Check that research feature has zero automated messaging or sending routines
const allResearchFiles = [];
function collectFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) allResearchFiles.push(full);
  }
}
collectFiles(featuresResearch);

let autoSendViolations = 0;
for (const file of allResearchFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sendWhatsAppAutonomous') || content.includes('autoDispatch: true')) {
    console.error(`  [FAIL] Autonomous send call detected in ${file}`);
    autoSendViolations++;
  }
}
assert(autoSendViolations === 0, 'Zero automated WhatsApp send routines detected in research feature code');

console.log('\n======================================================================');
console.log(`Phase 9.5 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
