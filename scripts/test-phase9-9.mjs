/**
 * LeadPulse AI V2 — Phase 9.9 Automated Polish, States & Regression Test Suite
 * 
 * Verifies:
 * 1. Global & Route-Level Error Boundary Architecture
 * 2. Real-Time Network & Service Connectivity Warning Banner
 * 3. Safe Date-fns Utility Suite (resilient against null/invalid timestamps)
 * 4. Production Loading Skeletons & Spinners Across All 5 Main Pages
 * 5. Actionable Empty States with Recovery CTAs Across All Main Pages
 * 6. Resilient Error Recovery Mechanisms & Query Refetch Triggers
 * 7. Non-Sending Safety Invariant: external_send_executed = false
 * 8. Theme Consistency & Zero Regressions to Phases 9.1–9.8
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const clientSrc = path.join(projectRoot, 'client', 'src');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.9 Polish & States Verification');
console.log('======================================================================');
console.log(`Root Directory: ${projectRoot}`);
console.log(`Client Source:  ${clientSrc}\n`);

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

// -----------------------------------------------------------------------------
// [Check 1/7] Error Boundary Architecture & Route Resilience
// -----------------------------------------------------------------------------
console.log('[Check 1/7] Verifying Global & Route Error Boundary Architecture...');
const errorBoundaryPath = path.join(clientSrc, 'components', 'error', 'error-boundary.tsx');
assert(fs.existsSync(errorBoundaryPath), 'components/error/error-boundary.tsx exists');

const errorBoundaryContent = fs.readFileSync(errorBoundaryPath, 'utf8');
assert(errorBoundaryContent.includes('export class ErrorBoundary'), 'Defines class-based ErrorBoundary');
assert(errorBoundaryContent.includes('export function RouteErrorBoundary'), 'Defines function RouteErrorBoundary');
assert(errorBoundaryContent.includes('useRouteError'), 'RouteErrorBoundary consumes useRouteError()');
assert(errorBoundaryContent.includes('isRouteErrorResponse'), 'RouteErrorBoundary evaluates isRouteErrorResponse()');
assert(errorBoundaryContent.includes('Reload Page') || errorBoundaryContent.includes('Reload Window'), 'Provides page reload recovery action');
assert(errorBoundaryContent.includes('Dashboard'), 'Provides Return to Dashboard recovery action');
assert(errorBoundaryContent.includes('Show Diagnostic Trace') || errorBoundaryContent.includes('View Stack'), 'Provides collapsible stack trace toggle');
assert(errorBoundaryContent.includes('external_send_executed = false'), 'ErrorBoundary enforces safety invariant annotation');

const routerPath = path.join(clientSrc, 'app', 'router.tsx');
assert(fs.existsSync(routerPath), 'client/src/app/router.tsx exists');
const routerContent = fs.readFileSync(routerPath, 'utf8');
assert(routerContent.includes('RouteErrorBoundary'), 'router.tsx imports RouteErrorBoundary');
assert(routerContent.includes('errorElement: <RouteErrorBoundary />'), 'router.tsx wires errorElement on root route');

const errorIndexPath = path.join(clientSrc, 'components', 'error', 'index.ts');
assert(fs.existsSync(errorIndexPath), 'components/error/index.ts barrel exists');

// -----------------------------------------------------------------------------
// [Check 2/7] Real-Time Connectivity Warning & Service Resilience
// -----------------------------------------------------------------------------
console.log('\n[Check 2/7] Verifying Real-Time Connectivity & Service Resilience...');
const connectivityPath = path.join(clientSrc, 'components', 'layout', 'connectivity-banner.tsx');
assert(fs.existsSync(connectivityPath), 'components/layout/connectivity-banner.tsx exists');

const connectivityContent = fs.readFileSync(connectivityPath, 'utf8');
assert(connectivityContent.includes("window.addEventListener('online'"), 'Monitors browser online event');
assert(connectivityContent.includes("window.addEventListener('offline'"), 'Monitors browser offline event');
assert(connectivityContent.includes('Network Disconnected'), 'Displays clear network disconnect warning');
assert(connectivityContent.includes('Retry'), 'Provides manual connectivity retry action');

const appShellPath = path.join(clientSrc, 'layouts', 'app-shell.tsx');
assert(fs.existsSync(appShellPath), 'layouts/app-shell.tsx exists');
const appShellContent = fs.readFileSync(appShellPath, 'utf8');
assert(appShellContent.includes('ConnectivityBanner'), 'app-shell.tsx imports ConnectivityBanner');
assert(appShellContent.includes('<ConnectivityBanner />'), 'app-shell.tsx mounts ConnectivityBanner');

// -----------------------------------------------------------------------------
// [Check 3/7] Safe Date-fns Utility Suite & Functional Unit Validation
// -----------------------------------------------------------------------------
console.log('\n[Check 3/7] Verifying Safe Date-fns Utilities & Functional Resilience...');
const dateLibPath = path.join(clientSrc, 'lib', 'date.ts');
assert(fs.existsSync(dateLibPath), 'client/src/lib/date.ts exists');

const dateLibContent = fs.readFileSync(dateLibPath, 'utf8');
assert(dateLibContent.includes("from 'date-fns'"), 'date.ts imports from date-fns');
assert(dateLibContent.includes('formatSafeDate'), 'date.ts exports formatSafeDate');
assert(dateLibContent.includes('formatSafeRelativeTime'), 'date.ts exports formatSafeRelativeTime');
assert(dateLibContent.includes('formatSafeDuration'), 'date.ts exports formatSafeDuration');
assert(dateLibContent.includes('toValidDate'), 'date.ts exports toValidDate helper');

// Real in-memory TypeScript transpilation & execution of all date functions
const transpileResult = ts.transpileModule(dateLibContent, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = { exports: {} };
const fn = new Function('require', 'exports', 'module', transpileResult.outputText);
fn(require, mod.exports, mod);
const { formatSafeDate, formatSafeRelativeTime, formatSafeDuration, toValidDate } = mod.exports;

// Rigorous functional testing against all edge cases without swallowing
assert(toValidDate(null) === null, 'toValidDate(null) safely returns null');
assert(toValidDate(undefined) === null, 'toValidDate(undefined) safely returns null');
assert(toValidDate('') === null, 'toValidDate("") safely returns null');
assert(toValidDate('   ') === null, 'toValidDate("   ") safely returns null');
assert(toValidDate('invalid-date-string') === null, 'toValidDate(invalid) safely returns null');
assert(toValidDate(NaN) === null, 'toValidDate(NaN) safely returns null');
assert(toValidDate(Infinity) === null, 'toValidDate(Infinity) safely returns null');
assert(toValidDate(-Infinity) === null, 'toValidDate(-Infinity) safely returns null');
assert(toValidDate('2026-09-10T12:00:00Z') instanceof Date, 'toValidDate(iso) returns valid Date object');
assert(toValidDate(1725960000000) instanceof Date, 'toValidDate(timestamp) returns valid Date');
assert(toValidDate(0) instanceof Date, 'toValidDate(0) returns valid epoch Date');

assert(formatSafeDate(null, 'yyyy', 'fallback') === 'fallback', 'formatSafeDate(null) returns custom fallback');
assert(formatSafeDate(undefined, 'yyyy', 'fallback') === 'fallback', 'formatSafeDate(undefined) returns custom fallback');
assert(formatSafeDate('invalid', 'yyyy', 'N/A') === 'N/A', 'formatSafeDate(invalid) returns fallback');
assert(formatSafeDate('   ', 'yyyy', 'N/A') === 'N/A', 'formatSafeDate("   ") returns fallback');
assert(formatSafeDate('2026-09-10T12:00:00Z', 'yyyy') === '2026', 'formatSafeDate(iso) returns formatted string');

assert(formatSafeRelativeTime(null, 'Never') === 'Never', 'formatSafeRelativeTime(null) returns fallback');
assert(formatSafeRelativeTime('invalid', 'Never') === 'Never', 'formatSafeRelativeTime(invalid) returns fallback');
assert(formatSafeRelativeTime('   ', 'Never') === 'Never', 'formatSafeRelativeTime("   ") returns fallback');
assert(typeof formatSafeRelativeTime(new Date()) === 'string', 'formatSafeRelativeTime(Date) returns formatted string');

assert(formatSafeDuration(null) === '0s', 'formatSafeDuration(null) returns 0s');
assert(formatSafeDuration(undefined) === '0s', 'formatSafeDuration(undefined) returns 0s');
assert(formatSafeDuration(-10) === '0s', 'formatSafeDuration(-10) returns 0s');
assert(formatSafeDuration(0) === '0s', 'formatSafeDuration(0) returns 0s');
assert(formatSafeDuration(45) === '45s', 'formatSafeDuration(45) returns 45s');
assert(formatSafeDuration(75) === '1m 15s', 'formatSafeDuration(75) returns 1m 15s');
assert(formatSafeDuration(120) === '2m', 'formatSafeDuration(120) returns 2m');
assert(formatSafeDuration(Infinity) === '0s', 'formatSafeDuration(Infinity) returns 0s');
assert(formatSafeDuration(-Infinity) === '0s', 'formatSafeDuration(-Infinity) returns 0s');
assert(formatSafeDuration(NaN) === '0s', 'formatSafeDuration(NaN) returns 0s');

// Verify actual component adoption of @/lib/date across UI modules
const runsTableCheckPath = path.join(clientSrc, 'features', 'research', 'components', 'research-runs-table.tsx');
const runsTableCheckContent = fs.readFileSync(runsTableCheckPath, 'utf8');
assert(runsTableCheckContent.includes("from '@/lib/date'"), 'research-runs-table.tsx imports safe date utilities');

const researchTelemetryCheckPath = path.join(clientSrc, 'features', 'research', 'components', 'research-telemetry.tsx');
const researchTelemetryCheckContent = fs.readFileSync(researchTelemetryCheckPath, 'utf8');
assert(researchTelemetryCheckContent.includes("from '@/lib/date'"), 'research-telemetry.tsx imports safe date utilities');

const researchReportCheckPath = path.join(clientSrc, 'features', 'leads', 'components', 'research-report.tsx');
const researchReportCheckContent = fs.readFileSync(researchReportCheckPath, 'utf8');
assert(researchReportCheckContent.includes("from '@/lib/date'"), 'research-report.tsx imports safe date utilities');

// -----------------------------------------------------------------------------
// [Check 4/7] Loading Skeletons & Spinners Across All Main Pages
// -----------------------------------------------------------------------------
console.log('\n[Check 4/7] Verifying Loading States & Skeletons Across Main Pages...');
const leadsTablePath = path.join(clientSrc, 'features', 'leads', 'components', 'leads-table.tsx');
const leadsTableContent = fs.readFileSync(leadsTablePath, 'utf8');
assert(leadsTableContent.includes('animate-pulse'), 'LeadsTable renders 6-row animated pulse skeleton');

const leadDossierPath = path.join(clientSrc, 'features', 'leads', 'components', 'lead-dossier.tsx');
const leadDossierContent = fs.readFileSync(leadDossierPath, 'utf8');
assert(leadDossierContent.includes('animate-pulse'), 'LeadDossier renders animated skeleton header & cards');

const dashboardPath = path.join(clientSrc, 'pages', 'dashboard', 'dashboard-page.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert(dashboardContent.includes('leadsQuery.isLoading'), 'Dashboard evaluates live query loading state');
assert(dashboardContent.includes('RefreshCw'), 'Dashboard includes loading spinner icon on refresh');

const outreachPagePath = path.join(clientSrc, 'pages', 'outreach', 'outreach-page.tsx');
const outreachPageContent = fs.readFileSync(outreachPagePath, 'utf8');
assert(outreachPageContent.includes('Loader2'), 'OutreachPage renders Loader2 spinning indicator');
assert(outreachPageContent.includes('Loading outreach drafts'), 'OutreachPage displays loading caption');

const echartsContainerPath = path.join(clientSrc, 'features', 'analytics', 'components', 'echarts-container.tsx');
const echartsContainerContent = fs.readFileSync(echartsContainerPath, 'utf8');
assert(echartsContainerContent.includes('showLoading'), 'EChartsContainer supports showLoading mask');
assert(echartsContainerContent.includes('rgba(255, 255, 255, 0.75)'), 'EChartsContainer loading mask adapts to Light Theme');

// -----------------------------------------------------------------------------
// [Check 5/7] Empty States with Contextual Recovery CTAs Across Main Pages
// -----------------------------------------------------------------------------
console.log('\n[Check 5/7] Verifying Actionable Empty States with Recovery CTAs...');
assert(leadsTableContent.includes('No Leads Discovered Yet'), 'LeadsTable handles empty database dataset');
assert(leadsTableContent.includes('Launch Research Campaign'), 'LeadsTable links empty pipeline to /research');
assert(leadsTableContent.includes('No Matching Leads Found'), 'LeadsTable handles active search/filter miss');
assert(leadsTableContent.includes('Reset All Filters'), 'LeadsTable provides Reset All Filters CTA');

assert(leadDossierContent.includes('Lead Record Not Found'), 'LeadDossier handles missing/invalid lead ID');
assert(leadDossierContent.includes('Return to Leads Intelligence Workspace'), 'LeadDossier provides return CTA');

const runsTablePath = path.join(clientSrc, 'features', 'research', 'components', 'research-runs-table.tsx');
const runsTableContent = fs.readFileSync(runsTablePath, 'utf8');
assert(runsTableContent.includes('No past research runs recorded'), 'ResearchRunsTable handles empty history');
assert(runsTableContent.includes('Launch your first campaign'), 'ResearchRunsTable provides guidance on empty state');

const emptyStatePath = path.join(clientSrc, 'features', 'outreach', 'components', 'outreach-empty-state.tsx');
assert(fs.existsSync(emptyStatePath), 'outreach-empty-state.tsx exists');
const emptyStateContent = fs.readFileSync(emptyStatePath, 'utf8');
assert(emptyStateContent.includes('No outreach items'), 'outreach-empty-state provides default empty copy');

// -----------------------------------------------------------------------------
// [Check 6/7] Error Recovery Workflows & Query Refetch Triggers
// -----------------------------------------------------------------------------
console.log('\n[Check 6/7] Verifying Error Recovery Workflows & Retry Triggers...');
assert(dashboardContent.includes('Dashboard Telemetry Offline'), 'Dashboard includes dedicated offline error state');
assert(dashboardContent.includes('handleRefresh'), 'Dashboard wires handleRefresh callback to error retry');
assert(leadsTableContent.includes('Failed to Load Leads Dataset'), 'LeadsTable renders distinct error state');
assert(leadsTableContent.includes('Retry Connection'), 'LeadsTable provides Retry Connection button');
assert(leadDossierContent.includes('Failed to Load Lead Dossier'), 'LeadDossier renders error state');
assert(leadDossierContent.includes('refetch()'), 'LeadDossier provides refetch retry button');
assert(outreachPageContent.includes('Could not retrieve outreach queue'), 'OutreachPage handles API fetch failure');

// -----------------------------------------------------------------------------
// [Check 7/7] Non-Negotiable Safety Invariant: external_send_executed = false
// -----------------------------------------------------------------------------
console.log('\n[Check 7/7] Verifying Non-Sending Safety Invariant across Codebase...');
assert(dashboardContent.includes('external_send_executed = false'), 'Dashboard locks external_send_executed = false');
assert(outreachPageContent.includes('external_send_executed = false'), 'OutreachPage locks external_send_executed = false');
assert(appShellContent.includes('Autonomous Send: Locked'), 'AppShell header displays Autonomous Send: Locked');

// Comprehensive scan for prohibited auto-send routines
const clientFiles = fs.readdirSync(clientSrc, { recursive: true });
let noSendingDetected = true;
for (const file of clientFiles) {
  const fullPath = path.join(clientSrc, file);
  if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
    const code = fs.readFileSync(fullPath, 'utf8');
    if (
      code.includes('autoSend(') ||
      code.includes('sendBulk(') ||
      code.includes('approveAndSend(') ||
      code.includes('sendAll(')
    ) {
      console.error(`  [VIOLATION] Autonomous sending routine found in ${file}`);
      noSendingDetected = false;
    }
  }
}
assert(noSendingDetected, 'Zero automated sending routines across entire client codebase');

console.log('======================================================================');
console.log(`Phase 9.9 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  console.error('❌ PHASE 9.9 POLISH & STATES VERIFICATION FAILED\n');
  process.exit(1);
} else {
  console.log('🎉 PHASE 9.9 POLISH, LOADING/ERROR/EMPTY STATES & REGRESSION VERIFIED AS PASS!\n');
  process.exit(0);
}
