import * as XLSX from 'xlsx';
import { NormalizedLead } from '@/features/leads/types';
import { ResearchRunRecord } from '@/features/research/types';
import {
  ExportLeadRow,
  ScoreTierCount,
  ServiceDistributionItem,
  GeographicDistributionItem,
  FunnelStageItem,
  ResearchTelemetryStats,
} from './types';

/**
 * Format a NormalizedLead into an executive-ready tabular row for Excel export.
 */
export function formatLeadForExport(lead: NormalizedLead): ExportLeadRow {
  return {
    'Business Name': lead.name || 'Unknown Business',
    'Category / Vertical': lead.category || 'Local Business',
    'Location': lead.location || 'Delhi NCR',
    'Opportunity Score': lead.opportunityScore ?? 0,
    'Opportunity Tier': lead.opportunityTier || 'Low',
    'Confidence Score': lead.confidenceScore ?? 0,
    'Recommended Service': lead.recommendedService || 'WhatsApp Automation',
    'Primary Problem': lead.primaryProblem || 'N/A',
    'Why This Service': lead.whyThisService || 'N/A',
    'Star Rating': lead.rating !== null && lead.rating !== undefined ? lead.rating : 'N/A',
    'Review Count': lead.reviewCount ?? 0,
    'Active Meta Ads': lead.hasActiveAds ? 'YES' : 'NO',
    'Has Official Website': lead.hasWebsite ? 'YES' : 'NO',
    'Website URL': lead.websiteUrl || 'N/A',
    'Google Maps URL': lead.googleMapsUrl || 'N/A',
    'Instagram URL': lead.instagramUrl || 'N/A',
    'Phone Number': lead.phone || 'N/A',
    'Research Status': lead.researchStatus || 'pending',
    'Outreach Status': lead.outreachStatus || 'draft',
    'Observed Evidence Count': lead.observedCount ?? 0,
    'Inferred Evidence Count': lead.inferredCount ?? 0,
    'Unknown Evidence Count': lead.unknownCount ?? 0,
    'Discovered / Created At': lead.createdAt || 'N/A',
    'Last Updated At': lead.updatedAt || 'N/A',
  };
}

/**
 * Generates an Excel (.xlsx) file containing formatted lead intelligence data
 * and triggers a client-side download via SheetJS.
 */
export function exportLeadsToExcel(
  leads: NormalizedLead[],
  filenamePrefix = 'leadpulse_leads'
): { success: boolean; rowCount: number; filename: string } {
  if (!leads || leads.length === 0) {
    return { success: false, rowCount: 0, filename: '' };
  }

  const rows: ExportLeadRow[] = leads.map(formatLeadForExport);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    let maxLen = key.length;
    for (const r of rows) {
      const val = r[key];
      const strVal = val !== undefined && val !== null ? String(val) : '';
      if (strVal.length > maxLen) {
        maxLen = strVal.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Intelligence');

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, filename);

  return {
    success: true,
    rowCount: rows.length,
    filename,
  };
}

/**
 * Computes analytics and aggregates from leads and research runs data.
 */
export function computeScoreDistribution(leads: NormalizedLead[]): ScoreTierCount {
  const tiers: ScoreTierCount = { immediate: 0, high: 0, medium: 0, low: 0 };
  for (const lead of leads) {
    const score = lead.opportunityScore ?? 0;
    if (score >= 80) tiers.immediate++;
    else if (score >= 60) tiers.high++;
    else if (score >= 40) tiers.medium++;
    else tiers.low++;
  }
  return tiers;
}

export function computeServiceDistribution(leads: NormalizedLead[]): ServiceDistributionItem[] {
  const map: Record<string, number> = {};
  for (const lead of leads) {
    const s = lead.recommendedService || 'WhatsApp Automation';
    map[s] = (map[s] || 0) + 1;
  }
  const total = leads.length || 1;
  return Object.entries(map)
    .map(([service, count]) => ({
      service,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeGeographicDistribution(leads: NormalizedLead[]): GeographicDistributionItem[] {
  const map: Record<string, { count: number; totalScore: number }> = {};
  for (const lead of leads) {
    let loc = 'Delhi NCR';
    const rawLoc = (lead.location || '').toLowerCase();
    if (rawLoc.includes('gurgaon') || rawLoc.includes('gurugram')) loc = 'Gurgaon';
    else if (rawLoc.includes('noida') || rawLoc.includes('greater noida')) loc = 'Noida';
    else if (rawLoc.includes('south delhi') || rawLoc.includes('hauz khas') || rawLoc.includes('saket') || rawLoc.includes('gk')) loc = 'South Delhi';
    else if (rawLoc.includes('west delhi') || rawLoc.includes('punjabi bagh') || rawLoc.includes('rajouri')) loc = 'West Delhi';
    else if (rawLoc.includes('delhi')) loc = 'Central Delhi';

    if (!map[loc]) {
      map[loc] = { count: 0, totalScore: 0 };
    }
    map[loc].count++;
    map[loc].totalScore += lead.opportunityScore ?? 0;
  }

  return Object.entries(map).map(([location, data]) => ({
    location,
    count: data.count,
    averageScore: Math.round(data.totalScore / (data.count || 1)),
  }));
}

export function computeFunnelMetrics(leads: NormalizedLead[], runs: ResearchRunRecord[] = []): FunnelStageItem[] {
  const totalFound = leads.length;
  if (totalFound === 0) return [];
  const filtered = leads.filter((l) => l.researchStatus !== 'pending').length;
  const researched = leads.filter((l) => l.researchStatus === 'complete' || l.researchStatus === 'partial').length;
  const qualified = leads.filter((l) => (l.opportunityScore ?? 0) >= 60).length;
  const outreachReady = leads.filter((l) => l.outreachStatus === 'approved' || l.outreachStatus === 'awaiting_human_approval').length;

  return [
    { stage: 'Discovered', count: totalFound, percentage: 100 },
    { stage: 'Triaged', count: filtered, percentage: Math.round((filtered / totalFound) * 100) },
    { stage: 'Deep Researched', count: researched, percentage: Math.round((researched / totalFound) * 100) },
    { stage: 'Qualified (≥60)', count: qualified, percentage: Math.round((qualified / totalFound) * 100) },
    { stage: 'Outreach Ready', count: outreachReady, percentage: Math.round((outreachReady / totalFound) * 100) },
  ];
}

export function computeResearchTelemetry(runs: ResearchRunRecord[] = []): ResearchTelemetryStats {
  let totalTokens = 0;
  let totalToolCalls = 0;
  let totalApifyCalls = 0;
  let completedRuns = 0;
  let failedRuns = 0;

  for (const r of runs) {
    totalTokens += r.total_tokens || 0;
    totalToolCalls += r.tool_calls || 0;
    totalApifyCalls += r.apify_calls || 0;
    if (r.status === 'completed') completedRuns++;
    if (r.status === 'failed') failedRuns++;
  }

  return {
    totalRuns: runs.length,
    totalTokens,
    totalToolCalls,
    totalApifyCalls,
    completedRuns,
    failedRuns,
  };
}
