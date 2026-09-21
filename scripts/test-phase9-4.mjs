/**
 * LeadPulse AI V2 — Phase 9.4 Automated Verification Script
 * Validates Lead Intelligence Dossier View, Specialist Evidence Drawer, Report Integration, and Safety Boundaries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const featuresLeads = path.join(clientSrc, 'features', 'leads');
const componentsDir = path.join(featuresLeads, 'components');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.4 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Features Leads Directory: ${featuresLeads}`);
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

// 1. Data Layer & API Hooks
console.log('\n[Check 1/6] Verifying Data Layer & API Hooks for Dossier...');
const typesPath = path.join(featuresLeads, 'types.ts');
assert(fs.existsSync(typesPath), 'types.ts exists');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert(typesContent.includes('SpecialistFindings'), 'types.ts defines SpecialistFindings interface');
assert(typesContent.includes('LeadReportResponse'), 'types.ts defines LeadReportResponse canonical contract');
assert(typesContent.includes('EvidenceItem'), 'types.ts defines EvidenceItem');
assert(typesContent.includes('EvidenceClassification'), 'types.ts defines EvidenceClassification');

const apiPath = path.join(featuresLeads, 'api.ts');
assert(fs.existsSync(apiPath), 'api.ts exists');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes('fetchLeadReport'), 'api.ts exports fetchLeadReport helper');
assert(apiContent.includes('/api/v1/leads/'), 'api.ts calls /api/v1/leads/{id}/report');
assert(apiContent.includes('useLeadReportQuery'), 'api.ts exports useLeadReportQuery hook');
assert(apiContent.includes('useLeadDetail'), 'api.ts exports useLeadDetail composite hook');
assert(apiContent.includes('prevLeadId'), 'useLeadDetail provides prevLeadId navigation');
assert(apiContent.includes('nextLeadId'), 'useLeadDetail provides nextLeadId navigation');

// 2. Dossier Header & Identity
console.log('\n[Check 2/6] Verifying Dossier Header & Prev/Next Navigation...');
const headerPath = path.join(componentsDir, 'dossier-header.tsx');
assert(fs.existsSync(headerPath), 'dossier-header.tsx exists');
const headerContent = fs.readFileSync(headerPath, 'utf8');
assert(headerContent.includes('Back to Leads'), 'Header includes back navigation to /leads');
assert(headerContent.includes('prevLeadId'), 'Header implements prev lead navigation');
assert(headerContent.includes('nextLeadId'), 'Header implements next lead navigation');
assert(headerContent.includes('lead.opportunityScore'), 'Header displays raw backend opportunityScore');
assert(headerContent.includes('getOpportunityScoreColor'), 'Header uses calibrated tier & score color mapping');
assert(headerContent.includes('lead.confidenceScore'), 'Header displays confidence score');
assert(headerContent.includes('lead.researchStatus'), 'Header displays research status');

// 3. Executive Intelligence Summary & Explicit "Unknown" Handling
console.log('\n[Check 3/6] Verifying Executive Intelligence Summary & "Unknown" Handlers...');
const summaryPath = path.join(componentsDir, 'intelligence-summary.tsx');
assert(fs.existsSync(summaryPath), 'intelligence-summary.tsx exists');
const summaryContent = fs.readFileSync(summaryPath, 'utf8');
assert(summaryContent.includes('Executive Intelligence Summary'), 'Component titles Executive Intelligence Summary');
assert(summaryContent.includes('primaryProblem'), 'Summary displays primary problem');
assert(summaryContent.includes('recommendedService'), 'Summary displays recommended service');
assert(summaryContent.includes('whyThisService'), 'Summary displays why this service');
assert(summaryContent.includes("'Unknown'"), 'Summary explicitly handles missing fields with "Unknown"');
assert(summaryContent.includes('lead.outreachStatus'), 'Summary displays outreach status');
assert(summaryContent.includes('lead.researchPriority'), 'Summary displays research priority');

// 4. Grounded Multi-Agent Evidence & Specialist Drawer
console.log('\n[Check 4/6] Verifying Grounded Multi-Agent Evidence & Specialist Drawer...');
const evidenceSectionPath = path.join(componentsDir, 'evidence-section.tsx');
assert(fs.existsSync(evidenceSectionPath), 'evidence-section.tsx exists');
const evidenceSectionContent = fs.readFileSync(evidenceSectionPath, 'utf8');
assert(evidenceSectionContent.includes('Grounded Multi-Agent Evidence'), 'Section renders Grounded Multi-Agent Evidence');
assert(evidenceSectionContent.includes('Observed'), 'Section provides OBSERVED filter & count');
assert(evidenceSectionContent.includes('Inferred'), 'Section provides INFERRED filter & count');
assert(evidenceSectionContent.includes('Unknown'), 'Section provides UNKNOWN filter & count');
assert(evidenceSectionContent.includes('onSelectEvidence'), 'Section triggers evidence selection for drawer');

const drawerPath = path.join(componentsDir, 'evidence-drawer.tsx');
assert(fs.existsSync(drawerPath), 'evidence-drawer.tsx exists');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');
assert(drawerContent.includes('Specialist Evidence Record'), 'Drawer titles Specialist Evidence Record');
assert(drawerContent.includes('item.finding'), 'Drawer displays full finding');
assert(drawerContent.includes('item.evidence'), 'Drawer displays raw grounded evidence snippet');
assert(drawerContent.includes('item.classification'), 'Drawer displays classification badge');
assert(drawerContent.includes('item.source'), 'Drawer displays source attribution');
assert(drawerContent.includes('Epistemic Grounding Standard'), 'Drawer explains OBSERVED / INFERRED / UNKNOWN standards');

// 5. Digital Presence, Research Report & Outreach Boundary
console.log('\n[Check 5/6] Verifying Digital Footprint, Report Integration & Outreach Boundary...');
const digitalPath = path.join(componentsDir, 'digital-presence.tsx');
assert(fs.existsSync(digitalPath), 'digital-presence.tsx exists');
const digitalContent = fs.readFileSync(digitalPath, 'utf8');
assert(digitalContent.includes('Website'), 'Footprint checks Website');
assert(digitalContent.includes('Google Maps'), 'Footprint checks Google Maps');
assert(digitalContent.includes('Meta Ads'), 'Footprint checks Meta Ads');
assert(digitalContent.includes('Instagram'), 'Footprint checks Instagram');
assert(digitalContent.includes('Phone / WhatsApp'), 'Footprint checks Phone/WhatsApp');

const reportPath = path.join(componentsDir, 'research-report.tsx');
assert(fs.existsSync(reportPath), 'research-report.tsx exists');
const reportContent = fs.readFileSync(reportPath, 'utf8');
assert(reportContent.includes('useLeadReportQuery'), 'Report component consumes useLeadReportQuery');
assert(reportContent.includes('Specialist Multi-Agent Research Synthesis'), 'Report titles specialist synthesis');
assert(reportContent.includes('website'), 'Report includes Website Specialist tab');
assert(reportContent.includes('ads'), 'Report includes Ads Specialist tab');
assert(reportContent.includes('maps'), 'Report includes Maps Specialist tab');
assert(reportContent.includes('analyst'), 'Report includes Analyst synthesis tab');
assert(reportContent.includes('telemetry'), 'Report includes Telemetry & metadata tab');
assert(reportContent.includes('Standby'), 'Report handles empty/pending report gracefully without crashing');

const outreachPath = path.join(componentsDir, 'outreach-readiness.tsx');
assert(fs.existsSync(outreachPath), 'outreach-readiness.tsx exists');
const outreachContent = fs.readFileSync(outreachPath, 'utf8');
assert(outreachContent.includes('Outreach Readiness & Human Approval Boundary'), 'Titles outreach readiness section');
assert(outreachContent.includes('Human approval required before any external communication.'), 'Enforces human approval boundary notification');
assert(outreachContent.includes('external_send_executed = false'), 'Enforces external_send_executed = false invariant');
assert(outreachContent.includes('Copy Outreach Draft'), 'Provides copy outreach draft button');
assert(outreachContent.includes('/outreach'), 'Links to outreach workspace');

// 6. Dossier Coordinator, Page Wiring, and Exports
console.log('\n[Check 6/6] Verifying Dossier Coordinator & Page Wiring...');
const dossierPath = path.join(componentsDir, 'lead-dossier.tsx');
assert(fs.existsSync(dossierPath), 'lead-dossier.tsx exists');
const dossierContent = fs.readFileSync(dossierPath, 'utf8');
assert(dossierContent.includes('DossierHeader'), 'LeadDossier renders DossierHeader');
assert(dossierContent.includes('IntelligenceSummary'), 'LeadDossier renders IntelligenceSummary');
assert(dossierContent.includes('DigitalPresence'), 'LeadDossier renders DigitalPresence');
assert(dossierContent.includes('EvidenceSection'), 'LeadDossier renders EvidenceSection');
assert(dossierContent.includes('EvidenceDrawer'), 'LeadDossier renders EvidenceDrawer');
assert(dossierContent.includes('ResearchReport'), 'LeadDossier renders ResearchReport');
assert(dossierContent.includes('OutreachReadiness'), 'LeadDossier renders OutreachReadiness');
assert(dossierContent.includes('Lead Record Not Found'), 'LeadDossier handles not found state gracefully');

const pagePath = path.join(clientSrc, 'pages', 'leads', 'lead-detail-page.tsx');
assert(fs.existsSync(pagePath), 'lead-detail-page.tsx exists');
const pageContent = fs.readFileSync(pagePath, 'utf8');
assert(pageContent.includes('LeadDossier'), 'lead-detail-page.tsx mounts LeadDossier');
assert(pageContent.includes('useParams'), 'lead-detail-page.tsx reads leadId from params');

const indexPath = path.join(featuresLeads, 'index.ts');
assert(fs.existsSync(indexPath), 'features/leads/index.ts exists');
const indexContent = fs.readFileSync(indexPath, 'utf8');
assert(indexContent.includes('lead-dossier'), 'features/leads/index.ts exports lead-dossier');
assert(indexContent.includes('evidence-drawer'), 'features/leads/index.ts exports evidence-drawer');

console.log('\n======================================================================');
console.log(`Phase 9.4 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
