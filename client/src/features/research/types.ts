export type ResearchRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type SpecialistType = 'website' | 'ads' | 'maps' | 'triage' | 'opportunity' | 'analyst';

export type SpecialistStatus =
  | 'Running'
  | 'Complete'
  | 'Partial'
  | 'Failed'
  | 'Pending'
  | 'Unknown';

export type EpistemicClassification = 'OBSERVED' | 'INFERRED' | 'UNKNOWN';

export interface SpecialistCardData {
  id: SpecialistType;
  name: string;
  description: string;
  status: SpecialistStatus;
  epistemic: EpistemicClassification;
  evidenceCount: number;
  limitation?: string | null;
}

export interface ResearchRunRecord {
  run_id: string;
  campaign_id?: string | null;
  status: ResearchRunStatus;
  started_at?: string | null;
  completed_at?: string | null;
  queries_generated: number;
  businesses_found: number;
  businesses_filtered: number;
  businesses_triaged: number;
  businesses_researched: number;
  qualified_leads: number;
  total_tokens: number;
  tool_calls: number;
  apify_calls: number;
  errors: Array<{ specialist?: string; error?: string; stage?: string; [key: string]: any }>;
  configuration: Record<string, any>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ResearchRunListResponse {
  items: ResearchRunRecord[];
  total: number;
  limit: number;
  offset: number;
}

export type ResearchDepth = 'standard' | 'deep' | 'comprehensive';

export interface CampaignFormData {
  campaignName: string;
  location: string;
  vertical: string;
  leadLimit: number;
  researchDepth: ResearchDepth;
  enabledSpecialists: SpecialistType[];
}
