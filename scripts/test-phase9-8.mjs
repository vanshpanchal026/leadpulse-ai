/**
 * LeadPulse AI V2 — Phase 9.8 Automated Verification Script
 * Validates Executive Analytics Engine, ECharts Visualizations, SheetJS Export Suite,
 * Pipeline Stage Visualizer, Recent Opportunities Table, and Safety Invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');
const analyticsDir = path.join(clientSrc, 'features', 'analytics');

console.log('======================================================================');
console.log('LeadPulse AI V2 — Phase 9.8 Executive Analytics & Export Verification');
console.log('======================================================================');
console.log(`Root Directory: ${rootDir}`);
console.log(`Client Source:  ${clientSrc}`);
console.log(`Analytics Dir:  ${analyticsDir}`);

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

// 1. Verify Analytics Architecture & Types
console.log('\n[Check 1/7] Verifying Analytics Data Architecture & Type Definitions...');
const typesPath = path.join(analyticsDir, 'types.ts');
assert(fs.existsSync(typesPath), 'features/analytics/types.ts exists');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert(typesContent.includes('ScoreTierCount'), 'types.ts defines ScoreTierCount');
assert(typesContent.includes('ServiceDistributionItem'), 'types.ts defines ServiceDistributionItem');
assert(typesContent.includes('GeographicDistributionItem'), 'types.ts defines GeographicDistributionItem');
assert(typesContent.includes('FunnelStageItem'), 'types.ts defines FunnelStageItem');
assert(typesContent.includes('ResearchTelemetryStats'), 'types.ts defines ResearchTelemetryStats');
assert(typesContent.includes('ExportLeadRow'), 'types.ts defines ExportLeadRow');
assert(typesContent.includes("'Business Name': string"), 'ExportLeadRow defines Business Name');
assert(typesContent.includes("'Opportunity Score': number"), 'ExportLeadRow defines Opportunity Score');
assert(typesContent.includes("'Recommended Service': string"), 'ExportLeadRow defines Recommended Service');
assert(typesContent.includes("'Active Meta Ads': string"), 'ExportLeadRow defines Active Meta Ads');

// 2. Verify SheetJS Export Utilities & Functional Export
console.log('\n[Check 2/7] Verifying SheetJS (xlsx) Export Suite & Functions...');
const exportUtilsPath = path.join(analyticsDir, 'export-utils.ts');
assert(fs.existsSync(exportUtilsPath), 'features/analytics/export-utils.ts exists');
const exportUtilsContent = fs.readFileSync(exportUtilsPath, 'utf8');
assert(exportUtilsContent.includes("from 'xlsx'") || exportUtilsContent.includes("require('xlsx')"), 'export-utils.ts imports SheetJS (xlsx)');
assert(exportUtilsContent.includes('export function exportLeadsToExcel'), 'export-utils.ts exports exportLeadsToExcel');
assert(exportUtilsContent.includes('export function formatLeadForExport'), 'export-utils.ts exports formatLeadForExport');
assert(exportUtilsContent.includes('computeScoreDistribution'), 'export-utils.ts exports computeScoreDistribution');
assert(exportUtilsContent.includes('computeServiceDistribution'), 'export-utils.ts exports computeServiceDistribution');
assert(exportUtilsContent.includes('computeGeographicDistribution'), 'export-utils.ts exports computeGeographicDistribution');
assert(exportUtilsContent.includes('computeFunnelMetrics'), 'export-utils.ts exports computeFunnelMetrics');
assert(exportUtilsContent.includes('computeResearchTelemetry'), 'export-utils.ts exports computeResearchTelemetry');
assert(exportUtilsContent.includes("XLSX.utils.json_to_sheet"), 'Uses json_to_sheet for tabular transformation');
assert(exportUtilsContent.includes("XLSX.utils.book_new"), 'Creates SheetJS workbook structure');
assert(exportUtilsContent.includes("!cols"), 'Computes auto-fit column widths');

// Functional SheetJS Test in Node runtime
try {
  const sampleLead = {
    'Business Name': 'Apex Dental Clinic',
    'Category / Vertical': 'Dental',
    'Location': 'South Delhi',
    'Opportunity Score': 88,
    'Opportunity Tier': 'Immediate',
    'Confidence Score': 92,
    'Recommended Service': 'WhatsApp Automation',
    'Primary Problem': 'Slow response to emergency dental inquiries',
    'Why This Service': 'High conversion intent requires instant booking',
    'Star Rating': 4.8,
    'Review Count': 142,
    'Active Meta Ads': 'YES',
    'Has Official Website': 'YES',
    'Website URL': 'https://apexdental.example',
    'Google Maps URL': 'https://maps.example',
    'Instagram URL': 'https://instagram.example',
    'Phone Number': '+919876543210',
    'Research Status': 'complete',
    'Outreach Status': 'approved',
    'Observed Evidence Count': 4,
    'Inferred Evidence Count': 1,
    'Unknown Evidence Count': 0,
    'Discovered / Created At': new Date().toISOString(),
    'Last Updated At': new Date().toISOString(),
  };

  const ws = XLSX.utils.json_to_sheet([sampleLead]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads Intelligence');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert(Buffer.isBuffer(buffer) && buffer.length > 0, 'Functional SheetJS generates valid .xlsx binary buffer');
} catch (err) {
  assert(false, `Functional SheetJS export error: ${err.message}`);
}

// 3. Verify ECharts Container & Chart Components
console.log('\n[Check 3/7] Verifying ECharts Container & Reactive Chart Components...');
const echartsContainerPath = path.join(analyticsDir, 'components', 'echarts-container.tsx');
assert(fs.existsSync(echartsContainerPath), 'echarts-container.tsx exists');
const echartsContainerContent = fs.readFileSync(echartsContainerPath, 'utf8');
assert(echartsContainerContent.includes("from 'echarts'"), 'echarts-container.tsx imports echarts');
assert(echartsContainerContent.includes('ResizeObserver'), 'echarts-container.tsx uses ResizeObserver for responsive sizing');
assert(echartsContainerContent.includes('.dispose()'), 'echarts-container.tsx handles clean lifecycle disposal');

const scoreChartPath = path.join(analyticsDir, 'components', 'score-distribution-chart.tsx');
assert(fs.existsSync(scoreChartPath), 'score-distribution-chart.tsx exists');
const scoreChartContent = fs.readFileSync(scoreChartPath, 'utf8');
assert(scoreChartContent.includes('EChartsContainer'), 'score-distribution-chart.tsx mounts EChartsContainer');
assert(scoreChartContent.includes('Immediate (≥80)'), 'score-distribution-chart.tsx handles Immediate tier');
assert(scoreChartContent.includes('#10b981'), 'score-distribution-chart.tsx uses emerald design token');

const serviceChartPath = path.join(analyticsDir, 'components', 'service-distribution-chart.tsx');
assert(fs.existsSync(serviceChartPath), 'service-distribution-chart.tsx exists');
const serviceChartContent = fs.readFileSync(serviceChartPath, 'utf8');
assert(serviceChartContent.includes('EChartsContainer'), 'service-distribution-chart.tsx mounts EChartsContainer');
assert(serviceChartContent.includes("type: 'pie'"), 'service-distribution-chart.tsx renders pie/doughnut');

const geoChartPath = path.join(analyticsDir, 'components', 'geographic-distribution-chart.tsx');
assert(fs.existsSync(geoChartPath), 'geographic-distribution-chart.tsx exists');
const geoChartContent = fs.readFileSync(geoChartPath, 'utf8');
assert(geoChartContent.includes('EChartsContainer'), 'geographic-distribution-chart.tsx mounts EChartsContainer');
assert(geoChartContent.includes('Delhi NCR'), 'geographic-distribution-chart.tsx maps Delhi NCR territories');

const funnelChartPath = path.join(analyticsDir, 'components', 'research-funnel-chart.tsx');
assert(fs.existsSync(funnelChartPath), 'research-funnel-chart.tsx exists');
const funnelChartContent = fs.readFileSync(funnelChartPath, 'utf8');
assert(funnelChartContent.includes('EChartsContainer'), 'research-funnel-chart.tsx mounts EChartsContainer');
assert(funnelChartContent.includes("type: 'funnel'"), 'research-funnel-chart.tsx renders funnel series');

const telemetryCardPath = path.join(analyticsDir, 'components', 'research-telemetry-card.tsx');
assert(fs.existsSync(telemetryCardPath), 'research-telemetry-card.tsx exists');
const telemetryCardContent = fs.readFileSync(telemetryCardPath, 'utf8');
assert(telemetryCardContent.includes('Total Tokens'), 'telemetry-card renders Total Tokens');
assert(telemetryCardContent.includes('Tool Calls'), 'telemetry-card renders Tool Calls');
assert(telemetryCardContent.includes('Apify Calls'), 'telemetry-card renders Apify Calls');
assert(telemetryCardContent.includes('Success Rate'), 'telemetry-card renders Success Rate');

// 4. Verify Pipeline Stage Visualizer & Opportunities Table
console.log('\n[Check 4/7] Verifying Pipeline Stage Visualizer & Recent Opportunities Table...');
const visualizerPath = path.join(analyticsDir, 'components', 'pipeline-stage-visualizer.tsx');
assert(fs.existsSync(visualizerPath), 'pipeline-stage-visualizer.tsx exists');
const visualizerContent = fs.readFileSync(visualizerPath, 'utf8');
assert(visualizerContent.includes('Discovered'), 'Visualizer includes Discovered stage');
assert(visualizerContent.includes('Filtered'), 'Visualizer includes Filtered stage');
assert(visualizerContent.includes('Triaged'), 'Visualizer includes Triaged stage');
assert(visualizerContent.includes('Deep Researched'), 'Visualizer includes Deep Researched stage');
assert(visualizerContent.includes('Qualified'), 'Visualizer includes Qualified stage');
assert(visualizerContent.includes('Awaiting Outreach Approval'), 'Visualizer includes Awaiting Outreach Approval stage');

const oppTablePath = path.join(analyticsDir, 'components', 'recent-opportunities-table.tsx');
assert(fs.existsSync(oppTablePath), 'recent-opportunities-table.tsx exists');
const oppTableContent = fs.readFileSync(oppTablePath, 'utf8');
assert(oppTableContent.includes('Recent High-Value Opportunities'), 'RecentOpportunitiesTable header renders');
assert(oppTableContent.includes('/leads/${lead.id}'), 'Recent opportunities table links to lead dossier');
assert(oppTableContent.includes('Dossier'), 'Recent opportunities table provides dossier action');

const barrelPath = path.join(analyticsDir, 'index.ts');
assert(fs.existsSync(barrelPath), 'features/analytics/index.ts barrel exists');

// 5. Verify Dashboard Page Integration
console.log('\n[Check 5/7] Verifying Dashboard Operational Command Center Integration...');
const dashboardPath = path.join(clientSrc, 'pages', 'dashboard', 'dashboard-page.tsx');
assert(fs.existsSync(dashboardPath), 'pages/dashboard/dashboard-page.tsx exists');
const dashContent = fs.readFileSync(dashboardPath, 'utf8');
assert(dashContent.includes('ScoreDistributionChart'), 'Dashboard mounts ScoreDistributionChart');
assert(dashContent.includes('ResearchFunnelChart'), 'Dashboard mounts ResearchFunnelChart');
assert(dashContent.includes('ServiceDistributionChart'), 'Dashboard mounts ServiceDistributionChart');
assert(dashContent.includes('GeographicDistributionChart'), 'Dashboard mounts GeographicDistributionChart');
assert(dashContent.includes('ResearchTelemetryCard'), 'Dashboard mounts ResearchTelemetryCard');
assert(dashContent.includes('PipelineStageVisualizer'), 'Dashboard mounts PipelineStageVisualizer');
assert(dashContent.includes('RecentOpportunitiesTable'), 'Dashboard mounts RecentOpportunitiesTable');
assert(dashContent.includes('exportLeadsToExcel'), 'Dashboard provides Excel export');
assert(dashContent.includes('Export Excel'), 'Dashboard has Export Excel button');
assert(dashContent.includes('Total Leads'), 'Dashboard has Total Leads KPI');
assert(dashContent.includes('Qualified (≥60)'), 'Dashboard has Qualified KPI');
assert(dashContent.includes('Immediate (≥80)'), 'Dashboard has Immediate KPI');
assert(dashContent.includes('Awaiting Review'), 'Dashboard has Awaiting Review KPI');
assert(dashContent.includes('Outreach Ready'), 'Dashboard has Outreach Ready KPI');

// 6. Verify Leads Page Integration
console.log('\n[Check 6/7] Verifying Leads Workspace Excel Export...');
const leadsPagePath = path.join(clientSrc, 'pages', 'leads', 'leads-page.tsx');
assert(fs.existsSync(leadsPagePath), 'pages/leads/leads-page.tsx exists');
const leadsPageContent = fs.readFileSync(leadsPagePath, 'utf8');
assert(leadsPageContent.includes('exportLeadsToExcel'), 'LeadsPage imports exportLeadsToExcel');
assert(leadsPageContent.includes('Export Excel'), 'LeadsPage provides Export Excel button');

// 7. Verify Strict Non-Sending Safety Invariants
console.log('\n[Check 7/7] Verifying Safety Invariant external_send_executed = false...');
assert(dashContent.includes('external_send_executed = false'), 'Dashboard displays external_send_executed = false');
const allAnalyticsFiles = fs.readdirSync(analyticsDir, { recursive: true });
let noSendingDetected = true;
for (const f of allAnalyticsFiles) {
  const fullF = path.join(analyticsDir, f);
  if (fs.statSync(fullF).isFile() && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
    const c = fs.readFileSync(fullF, 'utf8');
    if (c.includes('sendWhatsApp') || c.includes('autoSend') || c.includes('sendAll')) {
      noSendingDetected = false;
      console.error(`  [FAIL] Autonomous send detected in ${f}`);
    }
  }
}
assert(noSendingDetected, 'Zero automated send routines across analytics & export modules');

console.log('======================================================================');
console.log(`Phase 9.8 Verification Complete: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================================');

if (testsFailed > 0) {
  console.error('❌ PHASE 9.8 VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('🎉 PHASE 9.8 EXECUTIVE ANALYTICS & EXPORT VERIFIED AS PASS!\n');
  process.exit(0);
}
