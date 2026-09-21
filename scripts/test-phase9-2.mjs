/**
 * LeadPulse AI V2 — Phase 9.2 Automated Verification Script
 * Validates Routing, Application Shell, Navigation, Page Mounts, and Safety Invariants
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.2 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Client Source: ${clientSrc}`);

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

// 1. Verify App Providers & Router Architecture
console.log('\n[Check 1/6] Verifying Application Providers and Router Configuration...');
const providersPath = path.join(clientSrc, 'app', 'providers.tsx');
assert(fs.existsSync(providersPath), 'client/src/app/providers.tsx exists');
const providersContent = fs.readFileSync(providersPath, 'utf8');
assert(providersContent.includes('QueryClientProvider'), 'providers.tsx mounts QueryClientProvider');
assert(providersContent.includes('Toaster'), 'providers.tsx mounts Toaster');

const routerPath = path.join(clientSrc, 'app', 'router.tsx');
assert(fs.existsSync(routerPath), 'client/src/app/router.tsx exists');
const routerContent = fs.readFileSync(routerPath, 'utf8');
assert(routerContent.includes('createBrowserRouter'), 'router.tsx configures createBrowserRouter');
assert(routerContent.includes('AppShell'), 'router.tsx wraps routes in AppShell');

const requiredRoutes = [
  { name: 'Dashboard (index)', check: 'element: <DashboardPage />' },
  { name: 'Leads Overview', check: "path: 'leads'" },
  { name: 'Lead Detail (:leadId)', check: "path: 'leads/:leadId'" },
  { name: 'Research Engine', check: "path: 'research'" },
  { name: 'Outreach Review', check: "path: 'outreach'" },
  { name: 'System Settings', check: "path: 'settings'" },
  { name: 'Catch-all 404', check: "path: '*'" },
];

for (const route of requiredRoutes) {
  assert(routerContent.includes(route.check), `Route registered: ${route.name}`);
}

// 2. Verify Application Shell & Navigation
console.log('\n[Check 2/6] Verifying AppShell and Navigation Components...');
const appShellPath = path.join(clientSrc, 'layouts', 'app-shell.tsx');
assert(fs.existsSync(appShellPath), 'client/src/layouts/app-shell.tsx exists');
const appShellContent = fs.readFileSync(appShellPath, 'utf8');
assert(appShellContent.includes('<Sidebar'), 'AppShell includes desktop Sidebar');
assert(appShellContent.includes('<MobileNav'), 'AppShell includes MobileNav');
assert(appShellContent.includes('<Outlet'), 'AppShell renders scrollable <Outlet />');
assert(appShellContent.includes('Autonomous Send: Locked'), 'AppShell header displays Autonomous Send Lock badge');

const sidebarPath = path.join(clientSrc, 'components', 'navigation', 'sidebar.tsx');
assert(fs.existsSync(sidebarPath), 'client/src/components/navigation/sidebar.tsx exists');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
assert(sidebarContent.includes('NavLink'), 'Sidebar uses NavLink for active route states');
assert(sidebarContent.includes('isActive'), 'Sidebar implements isActive styling predicate');
assert(sidebarContent.includes('Safe Mode Enforced'), 'Sidebar displays Safe Mode Enforced footer');

const mobileNavPath = path.join(clientSrc, 'components', 'navigation', 'mobile-nav.tsx');
assert(fs.existsSync(mobileNavPath), 'client/src/components/navigation/mobile-nav.tsx exists');
const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8');
assert(mobileNavContent.includes('NavLink'), 'MobileNav uses NavLink for navigation');

const pageHeaderPath = path.join(clientSrc, 'components', 'layout', 'page-header.tsx');
assert(fs.existsSync(pageHeaderPath), 'client/src/components/layout/page-header.tsx exists');

// 3. Verify Page Implementations
console.log('\n[Check 3/6] Verifying Route Page Components...');
const pageFiles = [
  { file: 'pages/dashboard/dashboard-page.tsx', exportName: 'DashboardPage' },
  { file: 'pages/leads/leads-page.tsx', exportName: 'LeadsPage' },
  { file: 'pages/leads/lead-detail-page.tsx', exportName: 'LeadDetailPage' },
  { file: 'pages/research/research-page.tsx', exportName: 'ResearchPage' },
  { file: 'pages/outreach/outreach-page.tsx', exportName: 'OutreachPage' },
  { file: 'pages/settings/settings-page.tsx', exportName: 'SettingsPage' },
  { file: 'pages/not-found/not-found-page.tsx', exportName: 'NotFoundPage' },
];

for (const p of pageFiles) {
  const fullPath = path.join(clientSrc, p.file);
  assert(fs.existsSync(fullPath), `${p.file} exists`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert(content.includes(`export function ${p.exportName}`), `${p.file} exports ${p.exportName}`);
}

// 4. Verify Dynamic Route Parameter Usage in Lead Detail
console.log('\n[Check 4/6] Verifying Route Parameters and Navigation Flow...');
const leadDetailContent = fs.readFileSync(path.join(clientSrc, 'pages', 'leads', 'lead-detail-page.tsx'), 'utf8');
assert(leadDetailContent.includes('useParams'), 'LeadDetailPage consumes useParams hook');
assert(leadDetailContent.includes('leadId'), 'LeadDetailPage accesses dynamic leadId parameter');
assert(leadDetailContent.includes('Back to Leads'), 'LeadDetailPage provides back navigation to leads list');

const leadsPageContent = fs.readFileSync(path.join(clientSrc, 'pages', 'leads', 'leads-page.tsx'), 'utf8');
assert(leadsPageContent.includes('/leads/'), 'LeadsPage provides links to individual lead dossiers');

// 5. Verify Safety Invariants & Guardrails
console.log('\n[Check 5/6] Verifying Non-Negotiable Safety Invariants...');
const outreachContent = fs.readFileSync(path.join(clientSrc, 'pages', 'outreach', 'outreach-page.tsx'), 'utf8');
assert(outreachContent.includes('external_send_executed = false'), 'OutreachPage enforces external_send_executed = false invariant');
assert(outreachContent.includes('Human Approval Gate Active'), 'OutreachPage displays active Human Approval Gate');

// Check that no autonomous sending or unverified APIs are introduced
const allSrcFiles = [];
function collectFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      allSrcFiles.push(full);
    }
  }
}
collectFiles(clientSrc);

let autoSendViolations = 0;
for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sendWhatsAppAutonomous') || content.includes('autoDispatch: true')) {
    console.error(`  [FAIL] Autonomous send call detected in ${file}`);
    autoSendViolations++;
  }
}
assert(autoSendViolations === 0, 'Zero automated WhatsApp send routines detected in frontend source');

// 6. Verify App.tsx Mounts Router
console.log('\n[Check 6/6] Verifying Root App Mounting...');
const appContent = fs.readFileSync(path.join(clientSrc, 'App.tsx'), 'utf8');
assert(appContent.includes('<RouterProvider router={router}'), 'App.tsx mounts RouterProvider with router');
assert(appContent.includes('<Providers>'), 'App.tsx wraps router in Providers');

// Summary
console.log('\n======================================================================');
console.log(`Phase 9.2 Verification Summary: ${testsPassed} PASS / ${testsFailed} FAIL`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('PHASE 9.2 VERIFICATION PASSED SUCCESSFULLY!\n');
}
