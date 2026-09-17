import { OpportunityTier } from '@/lib/utils';

export type EvidenceClassification = 'observed' | 'inferred' | 'unknown';

export interface EvidenceItem {
  source: string;
  finding: string;
  evidence?: string;
  confidence?: number;
  classification: EvidenceClassification;
}

export type ResearchStatus = 'complete' | 'partial' | 'pending' | 'failed';
export type ResearchPriority = 'high' | 'medium' | 'low';

export interface NormalizedLead {
  id: string;
  name: string;
  sourcePlatform: string;
  sourceUrl: string;
  category: string;
  location: string;
  phone: string | null;
  websiteUrl: string | null;
  hasWebsite: boolean;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  rating: number | null;
  reviewCount: number;
  hasActiveAds: boolean;
  opportunityScore: number;
  opportunityTier: OpportunityTier;
  confidenceScore: number;
  researchStatus: ResearchStatus;
  researchPriority: ResearchPriority;
  recommendedService: string;
  primaryProblem: string | null;
  whyThisService: string | null;
  evidence: EvidenceItem[];
  evidenceSummary?: string | null;
  observedCount: number;
  inferredCount: number;
  unknownCount: number;
  outreachStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, any>;
}

export interface LeadsFilterState {
  search: string;
  opportunityTier: 'all' | OpportunityTier;
  researchStatus: 'all' | ResearchStatus;
  category: string;
  marketingActivity: 'all' | 'active_ads' | 'organic_only';
}

export interface SpecialistFindings {
  website?: Record<string, any> | null;
  ads?: Record<string, any> | null;
  maps?: Record<string, any> | null;
}

export interface LeadReportResponse {
  lead: Record<string, any>;
  discovery: Record<string, any>;
  specialists: SpecialistFindings;
  opportunity: {
    opportunity_score?: number;
    primary_problem?: string | null;
    recommended_service?: string | null;
    why_this_service?: string | null;
    evidence?: EvidenceItem[];
    confidence?: number;
  };
  analysis: {
    qualification_status?: string;
    priority?: string;
    opportunity_score?: number;
    primary_problem?: string | null;
    recommended_service?: string | null;
    why_this_service?: string | null;
    confidence?: number;
    research_status?: string;
    limitations?: string[];
  };
  outreach: {
    draft?: Record<string, any> | null;
    outreach_status?: string;
    external_send_executed?: boolean;
  };
  metadata: {
    research_status?: string;
    confidence_score?: number;
    agent_version?: string;
    prompt_version?: string;
    model_name?: string;
    research_timestamp?: string | null;
    research_run_id?: string | null;
    token_usage?: Record<string, any>;
  };
}
