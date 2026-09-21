import { NormalizedLead } from '@/features/leads/types';
import { ResearchRunRecord } from '@/features/research/types';

export interface ScoreTierCount {
  immediate: number;
  high: number;
  medium: number;
  low: number;
}

export interface ServiceDistributionItem {
  service: string;
  count: number;
  percentage: number;
}

export interface GeographicDistributionItem {
  location: string;
  count: number;
  averageScore: number;
}

export interface FunnelStageItem {
  stage: string;
  count: number;
  percentage: number;
}

export interface ResearchTelemetryStats {
  totalRuns: number;
  totalTokens: number;
  totalToolCalls: number;
  totalApifyCalls: number;
  completedRuns: number;
  failedRuns: number;
}

export interface ExportLeadRow {
  'Business Name': string;
  'Category / Vertical': string;
  'Location': string;
  'Opportunity Score': number;
  'Opportunity Tier': string;
  'Confidence Score': number;
  'Recommended Service': string;
  'Primary Problem': string;
  'Why This Service': string;
  'Star Rating': number | string;
  'Review Count': number;
  'Active Meta Ads': string;
  'Has Official Website': string;
  'Website URL': string;
  'Google Maps URL': string;
  'Instagram URL': string;
  'Phone Number': string;
  'Research Status': string;
  'Outreach Status': string;
  'Observed Evidence Count': number;
  'Inferred Evidence Count': number;
  'Unknown Evidence Count': number;
  'Discovered / Created At': string;
  'Last Updated At': string;
  [key: string]: unknown;
}
