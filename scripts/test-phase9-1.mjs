/**
 * LeadPulse AI V2 — Phase 9.1 Automated Verification Script
 * Validates Frontend Architecture, Vite Foundation, Locked Dependencies, and Design System Tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.1 Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);

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

// 1. Verify Phase 9 Architecture Audit
console.log('\n[Check 1/7] Verifying Architecture Audit Document...');
const auditPath = path.join(rootDir, 'docs', 'PHASE_9_ARCHITECTURE_AUDIT.md');
assert(fs.existsSync(auditPath), 'docs/PHASE_9_ARCHITECTURE_AUDIT.md exists');
const auditContent = fs.readFileSync(auditPath, 'utf8');
const requiredAuditSections = [
  'Current Frontend Architecture',
  'Current Next.js Role',
  'Existing API Surface',
  'Existing Reusable Components',
  'Existing V1 Dashboard Functionality',
  'Supabase Integration Points',
  'Python Worker Integration Points',
  'Recommended React/Vite Integration Architecture',
  'Migration Risks',
  'Files Created in Phase 9.1',
  'Files Modified in Phase 9.1',
  'Files That Must NOT Be Deleted',
  'Dependency Changes',
  'Testing Strategy',
];
let auditSectionsFound = 0;
for (const section of requiredAuditSections) {
  if (auditContent.includes(section)) {
    auditSectionsFound++;
  }
}
assert(auditSectionsFound === requiredAuditSections.length, `All ${requiredAuditSections.length} required audit sections documented (found: ${auditSectionsFound})`);

// 2. Verify Locked Frontend Dependencies
console.log('\n[Check 2/7] Verifying Locked Dependencies in package.json...');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const requiredDeps = [
  '@tanstack/react-query',
  '@tanstack/react-table',
  'echarts',
  'echarts-for-react',
  'xlsx',
  'zod',
  'react-router-dom',
  'date-fns',
  'sonner',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  '@radix-ui/react-slot',
];
const requiredDevDeps = ['vite', '@vitejs/plugin-react'];

for (const dep of requiredDeps) {
  assert(Boolean(pkg.dependencies && pkg.dependencies[dep]), `Dependency installed: ${dep}`);
}
for (const devDep of requiredDevDeps) {
  assert(Boolean(pkg.devDependencies && pkg.devDependencies[devDep]), `Dev dependency installed: ${devDep}`);
}
assert(Boolean(pkg.scripts && pkg.scripts['client:build']), 'npm script client:build configured');
assert(Boolean(pkg.scripts && pkg.scripts['client:dev']), 'npm script client:dev configured');

// 3. Verify Vite Configuration & TypeScript Setup
console.log('\n[Check 3/7] Verifying Vite Configuration & Isolation...');
const viteConfigPath = path.join(rootDir, 'client', 'vite.config.ts');
const clientTsConfigPath = path.join(rootDir, 'client', 'tsconfig.json');
const indexPath = path.join(rootDir, 'client', 'index.html');

assert(fs.existsSync(viteConfigPath), 'client/vite.config.ts exists');
const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
assert(viteConfig.includes('@vitejs/plugin-react'), 'Vite React plugin configured');
assert(viteConfig.includes('/api/v1') && viteConfig.includes('/api'), 'Vite dev proxy configured for /api and /api/v1');

assert(fs.existsSync(clientTsConfigPath), 'client/tsconfig.json exists');
const clientTsConfig = JSON.parse(fs.readFileSync(clientTsConfigPath, 'utf8'));
assert(clientTsConfig.compilerOptions.jsx === 'react-jsx', 'client tsconfig uses native react-jsx');

const rootTsConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf8'));
assert(rootTsConfig.exclude.includes('client'), 'root tsconfig isolates client directory from Next.js build');

assert(fs.existsSync(indexPath), 'client/index.html exists');

// 4. Verify Design System Tokens
console.log('\n[Check 4/7] Verifying Design System Tokens & Tailwind Configuration...');
const globalsPath = path.join(rootDir, 'client', 'src', 'styles', 'globals.css');
assert(fs.existsSync(globalsPath), 'client/src/styles/globals.css exists');
const globalsContent = fs.readFileSync(globalsPath, 'utf8');
assert(globalsContent.includes('--evidence-observed-bg'), 'Design token --evidence-observed-bg configured');
assert(globalsContent.includes('--evidence-inferred-bg'), 'Design token --evidence-inferred-bg configured');
assert(globalsContent.includes('--evidence-unknown-bg'), 'Design token --evidence-unknown-bg configured');
assert(globalsContent.includes('--score-high'), 'Design token --score-high configured');

// 5. Verify Core UI Primitives
console.log('\n[Check 5/7] Verifying shadcn/ui Foundation Primitives...');
const uiFiles = ['button.tsx', 'badge.tsx', 'card.tsx', 'sonner.tsx'];
for (const file of uiFiles) {
  const filePath = path.join(rootDir, 'client', 'src', 'components', 'ui', file);
  assert(fs.existsSync(filePath), `client/src/components/ui/${file} exists`);
}
const badgeContent = fs.readFileSync(path.join(rootDir, 'client', 'src', 'components', 'ui', 'badge.tsx'), 'utf8');
assert(badgeContent.includes('observed:') && badgeContent.includes('inferred:') && badgeContent.includes('unknown:'), 'Badge component supports grounded evidence classification variants');

// 6. Verify Production Bundling Output
console.log('\n[Check 6/7] Verifying Vite Production Bundle Artifacts...');
const distDir = path.join(rootDir, 'dist', 'client');
assert(fs.existsSync(distDir), 'dist/client production directory exists');
assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/client/index.html generated');
const assets = fs.readdirSync(path.join(distDir, 'assets'));
assert(assets.some(f => f.endsWith('.js')), 'Production JS bundle generated in dist/client/assets');
assert(assets.some(f => f.endsWith('.css')), 'Production CSS bundle generated in dist/client/assets');

// 7. Verify Operational Safety Boundary Invariant
console.log('\n[Check 7/7] Verifying Non-Sending Safety Boundary Invariant...');
const appContent = fs.readFileSync(path.join(rootDir, 'client', 'src', 'App.tsx'), 'utf8');
assert(appContent.includes('external_send_executed = false'), 'App.tsx strictly asserts external_send_executed = false');
assert(!appContent.includes('api.whatsapp.com/send?') && !appContent.includes('wa.me/send?auto=true'), 'Zero automated WhatsApp transmission routes in client UI');

console.log('\n======================================================================');
console.log(`PHASE 9.1 VERIFICATION RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('======================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 PHASE 9.1 ARCHITECTURE & DESIGN SYSTEM VERIFIED AS PASS!');
  process.exit(0);
}
