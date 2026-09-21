import { OpportunityTier } from '@/lib/utils';
import { EvidenceItem } from '../leads/types';

export type OutreachApprovalStatus =
  | 'awaiting_human_approval'
  | 'approved'
  | 'rejected'
  | 'needs_revision';

export type OutreachFilterStatus =
  | 'all'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_revision'
  | 'missing_draft';

export type OutreachQualityLevel = 'PASS' | 'WARNING' | 'BLOCKED' | 'BLOCK';

export interface PersonalizationQualityResult {
  businessNameUsed: boolean;
  problemReferenced: boolean;
  serviceReferenced: boolean;
  locationReferenced: boolean;
  evidenceReferenced: boolean;
  genericOpeningDetected: boolean;
}

export interface PreSendQualityResult {
  level: OutreachQualityLevel;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  characterCount: number;
  sentenceCount: number;
  hasBannedPhrases: boolean;
  hasPlaceholders: boolean;
  hasExcessivePunctuation: boolean;
  hasExcessiveCaps: boolean;
  hasExcessiveEmojis: boolean;
  personalization: PersonalizationQualityResult;
}

export interface OutreachEvidenceItem {
  field: string;
  source: string;
  raw_value: unknown;
  confidence: number;
  extracted_at?: string;
  validation_source?: string;
}

export interface OutreachValidationResult {
  valid: boolean;
  reasons: string[];
  errors?: string[];
  character_count: number;
  sentence_count: number;
  detected_service?: string | null;
  banned_phrase_found: boolean;
  unsupported_claim_detected: boolean;
  placeholder_detected: boolean;
  unsupported_service: boolean;
}

export interface OutreachDraft {
  message: string;
  service: string;
  evidence_used: OutreachEvidenceItem[];
  confidence: number;
  status: 'draft' | 'rejected';
  validation_reasons: string[];
  character_count: number;
  sentence_count: number;
}

export interface OutreachRecord {
  lead_id: string;
  business_name: string;
  opportunity_score: number;
  primary_problem: string;
  recommended_service: string;
  confidence: number;
  evidence: OutreachEvidenceItem[];
  draft: OutreachDraft;
  validation: OutreachValidationResult;
  approval_status: OutreachApprovalStatus;
  lifecycle_status?: string;
  regeneration_count: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  reviewer: string;
  channel: string;
  notes?: string;
}

export interface OutreachItem {
  id: string;
  businessName: string;
  location: string;
  category: string;
  opportunityScore: number;
  opportunityTier: OpportunityTier;
  confidence: number;
  primaryProblem: string;
  recommendedService: string;
  whyThisService?: string | null;
  pitchAngle?: string | null;
  valueHypothesis?: string | null;
  channel: string;
  draftMessage: string;
  originalDraft: string;
  approvalStatus: OutreachApprovalStatus;
  validationReasons: string[];
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  googleMapsUrl: string | null;
  hasActiveAds: boolean;
  researchStatus: string;
  outreachStatus: string;
  reviewPriority: 'high' | 'medium' | 'low';
  evidence: EvidenceItem[];
  evidenceSummary?: string | null;
  observedCount: number;
  inferredCount: number;
  unknownCount: number;
  hasDraft: boolean;
  history: OutreachHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OutreachActionResponse {
  success: boolean;
  record?: OutreachRecord;
  message: string;
  external_send_executed: boolean;
}
