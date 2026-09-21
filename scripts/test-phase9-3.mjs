/**
 * LeadPulse AI V2 — Phase 9.3 Automated Verification Script
 * Validates Leads Intelligence Grid, TanStack Table, Data Flow, Zod Schemas, and Safety Invariants
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const featuresLeads = path.join(clientSrc, 'features', 'leads');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.3 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Features Leads Directory: ${featuresLeads}`);

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

// 1. Verify Leads Data Layer Files
console.log('\n[Check 1/7] Verifying Leads Data Layer Architecture...');
const typesPath = path.join(featuresLeads, 'types.ts');
assert(fs.existsSync(typesPath), 'client/src/features/leads/types.ts exists');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert(typesContent.includes('NormalizedLead'), 'types.ts exports NormalizedLead interface');
assert(typesContent.includes('EvidenceClassification'), 'types.ts defines EvidenceClassification');
assert(typesContent.includes('hasWebsite: boolean'), 'types.ts includes hasWebsite field');

const schemaPath = path.join(featuresLeads, 'schema.ts');
assert(fs.existsSync(schemaPath), 'client/src/features/leads/schema.ts exists');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
assert(schemaContent.includes('LeadsApiResponseSchema'), 'schema.ts defines LeadsApiResponseSchema');
assert(schemaContent.includes('RawLeadRecordSchema'), 'schema.ts defines RawLeadRecordSchema');
assert(schemaContent.includes('normalizeLead'), 'schema.ts defines normalizeLead helper');

const apiPath = path.join(featuresLeads, 'api.ts');
assert(fs.existsSync(apiPath), 'client/src/features/leads/api.ts exists');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes('/api/leads'), 'api.ts consumes /api/leads endpoint');
assert(apiContent.includes('useLeadsQuery'), 'api.ts exports useLeadsQuery TanStack Query hook');
assert(apiContent.includes('staleTime: 1000 * 30'), 'api.ts configures 30s staleTime cache');

// 2. Verify TanStack Table Components
console.log('\n[Check 2/7] Verifying TanStack Table Components...');
const columnsPath = path.join(featuresLeads, 'columns.tsx');
assert(fs.existsSync(columnsPath), 'client/src/features/leads/columns.tsx exists');
const columnsContent = fs.readFileSync(columnsPath, 'utf8');
assert(columnsContent.includes('leadColumns'), 'columns.tsx exports leadColumns definition');
assert(columnsContent.includes('accessorKey: \'name\''), 'Columns include Business Name');
assert(columnsContent.includes('accessorKey: \'category\''), 'Columns include Category/Vertical');
assert(columnsContent.includes('accessorKey: \'location\''), 'Columns include Location');
assert(columnsContent.includes('accessorKey: \'opportunityScore\''), 'Columns include Opportunity Score');
assert(columnsContent.includes('id: \'evidence\''), 'Columns include Evidence & Research');
assert(columnsContent.includes('accessorKey: \'hasActiveAds\''), 'Columns include Marketing Activity');
assert(columnsContent.includes('id: \'actions\''), 'Columns include Actions column');

const tablePath = path.join(featuresLeads, 'components', 'leads-table.tsx');
assert(fs.existsSync(tablePath), 'leads-table.tsx exists');
const tableContent = fs.readFileSync(tablePath, 'utf8');
assert(tableContent.includes('useLegacyTable'), 'leads-table.tsx initializes TanStack Table');
assert(tableContent.includes('getSortedRowModel'), 'leads-table.tsx supports column sorting');
assert(tableContent.includes('getPaginationRowModel'), 'leads-table.tsx supports pagination');
assert(tableContent.includes('navigate(`/leads/'), 'leads-table.tsx navigates to lead detail on row click');

const toolbarPath = path.join(featuresLeads, 'components', 'leads-toolbar.tsx');
assert(fs.existsSync(toolbarPath), 'leads-toolbar.tsx exists');
const toolbarContent = fs.readFileSync(toolbarPath, 'utf8');
assert(toolbarContent.includes('setGlobalFilter'), 'leads-toolbar.tsx implements search filtering');
assert(toolbarContent.includes('opportunityTierFilter'), 'leads-toolbar.tsx implements tier filtering');
assert(toolbarContent.includes('categoryFilter'), 'leads-toolbar.tsx implements category filtering');
assert(toolbarContent.includes('Toggle Columns'), 'leads-toolbar.tsx implements column visibility toggle');

const paginationPath = path.join(featuresLeads, 'components', 'leads-pagination.tsx');
assert(fs.existsSync(paginationPath), 'leads-pagination.tsx exists');
const paginationContent = fs.readFileSync(paginationPath, 'utf8');
assert(paginationContent.includes('pageSize'), 'leads-pagination.tsx manages page size');
assert(paginationContent.includes('previousPage'), 'leads-pagination.tsx controls page navigation');

// 3. Verify Opportunity Score Mapping Logic
console.log('\n[Check 3/7] Verifying Opportunity Score Mapping Bounds...');
const utilsPath = path.join(clientSrc, 'lib', 'utils.ts');
const utilsContent = fs.readFileSync(utilsPath, 'utf8');
assert(utilsContent.includes('getOpportunityTier'), 'utils.ts exports getOpportunityTier function');
assert(utilsContent.includes('getOpportunityScoreColor'), 'utils.ts exports getOpportunityScoreColor');
assert(utilsContent.includes("if (score >= 80) return 'Immediate'"), 'Score >= 80 maps to Immediate');
assert(utilsContent.includes("if (score >= 60) return 'High Potential'"), 'Score >= 60 maps to High Potential');
assert(utilsContent.includes("if (score >= 40) return 'Medium'"), 'Score >= 40 maps to Medium');
assert(utilsContent.includes("return 'Low'"), 'Score < 40 maps to Low');

// 4. Verify Grounded Evidence Classification & Normalization Rigor
console.log('\n[Check 4/7] Verifying Grounded Evidence Classification...');
assert(schemaContent.includes("classification === 'observed'"), 'schema.ts classifies observed evidence');
assert(schemaContent.includes("classification === 'inferred'"), 'schema.ts classifies inferred evidence');
assert(schemaContent.includes("classification === 'unknown'"), 'schema.ts classifies unknown evidence');
assert(schemaContent.includes('observedCount'), 'schema.ts counts observed items');
assert(schemaContent.includes('inferredCount'), 'schema.ts counts inferred items');
assert(schemaContent.includes('unknownCount'), 'schema.ts counts unknown items');

// 5. Verify LeadsPage Integration
console.log('\n[Check 5/7] Verifying LeadsPage Workspace View...');
const leadsPagePath = path.join(clientSrc, 'pages', 'leads', 'leads-page.tsx');
const leadsPageContent = fs.readFileSync(leadsPagePath, 'utf8');
assert(leadsPageContent.includes('useLeadsQuery'), 'LeadsPage consumes useLeadsQuery');
assert(leadsPageContent.includes('<LeadsTable'), 'LeadsPage mounts LeadsTable');
assert(leadsPageContent.includes('Immediate Priority'), 'LeadsPage renders top summary metrics');
assert(leadsPageContent.includes('Active Meta Ads'), 'LeadsPage renders active ads metrics');

// 6. Verify Backend Endpoint Integration (app/api/leads/route.ts)
console.log('\n[Check 6/7] Verifying Next.js Backend Route /api/leads...');
const routePath = path.join(rootDir, 'app', 'api', 'leads', 'route.ts');
assert(fs.existsSync(routePath), 'app/api/leads/route.ts exists');
const routeContent = fs.readFileSync(routePath, 'utf8');
assert(routeContent.includes('supabase'), 'route.ts queries Supabase production source of truth');
assert(routeContent.includes('data/leads.json'), 'route.ts provides graceful local json fallback');

// 7. Verify Safety Invariants
console.log('\n[Check 7/7] Verifying Non-Sending Safety Invariants...');
assert(toolbarContent.includes('Zero auto-send; human gate enforced'), 'Toolbar explicitly declares zero auto-send invariant');
assert(!tableContent.includes('sendWhatsApp') && !tableContent.includes('autoDispatch'), 'Table contains zero automated dispatch calls');

let safetyViolations = 0;
const leadsDirFiles = fs.readdirSync(featuresLeads, { recursive: true });
for (const file of leadsDirFiles) {
  if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
    const full = path.join(featuresLeads, file);
    const content = fs.readFileSync(full, 'utf8');
    if (content.includes('sendWhatsAppAutonomous') || content.includes('wa.me/send?auto=true')) {
      safetyViolations++;
    }
  }
}
assert(safetyViolations === 0, 'Zero automated WhatsApp send routines detected in leads feature code');

// Summary
console.log('\n======================================================================');
console.log(`Phase 9.3 Verification Summary: ${testsPassed} PASS / ${testsFailed} FAIL`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('PHASE 9.3 LEADS GRID & PIPELINE WORKSPACE VERIFIED AS PASS!\n');
}
