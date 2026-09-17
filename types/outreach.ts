/**
 * LeadPulse AI V2 — Phase 7 Outreach & Human Approval Types
 */

export type ApprovalStatus = 'awaiting_human_approval' | 'approved' | 'rejected';
export type DraftStatus = 'draft' | 'rejected';

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

export interface OutreachEvidenceItem {
  field: string;
  source: string;
  raw_value: unknown;
  confidence: number;
  extracted_at?: string;
  validation_source?: string;
}

export interface OutreachDraft {
  message: string;
  service: string;
  evidence_used: OutreachEvidenceItem[];
  confidence: number;
  status: DraftStatus;
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
  approval_status: ApprovalStatus;
  lifecycle_status?: 'research_ready' | 'outreach_draft' | 'validated' | 'awaiting_human_approval' | 'approved' | 'rejected';
  regeneration_count: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachActionResponse {
  success: boolean;
  record: OutreachRecord;
  message: string;
  external_send_executed: boolean;
}
