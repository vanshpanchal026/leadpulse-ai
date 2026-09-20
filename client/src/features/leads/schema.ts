import { z } from 'zod';
import { getOpportunityTier } from '@/lib/utils';
import {
  NormalizedLead,
  EvidenceItem,
  EvidenceClassification,
  ResearchStatus,
  ResearchPriority,
} from './types';

export const RawEvidenceItemSchema = z.object({
  source: z.string().default('unknown'),
  finding: z.string().default(''),
  evidence: z.string().optional().nullable(),
  confidence: z.coerce.number().optional().nullable(),
  classification: z
    .enum(['observed', 'inferred', 'unknown'])
    .catch('observed'),
});

export const RawLeadRecordSchema = z
  .object({
    id: z.string(),
    title: z.string().optional().nullable(),
    business_name: z.string().optional().nullable(),
    business_type: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    source_platform: z.string().default('google_maps'),
    source_url: z.string().default(''),
    phone_number: z.string().optional().nullable(),
    website_url: z.string().optional().nullable(),
    google_maps_url: z.string().optional().nullable(),
    instagram_url: z.string().optional().nullable(),
    rating: z.coerce.number().optional().nullable(),
    review_count: z.coerce.number().default(0),
    has_active_ads: z.boolean().default(false),
    prospect_score: z.coerce.number().default(0),
    opportunity_score: z.coerce.number().default(0),
    confidence_score: z.coerce.number().default(0),
    research_status: z.string().default('pending'),
    research_priority: z.string().default('medium'),
    recommended_service: z.string().optional().nullable(),
    primary_problem: z.string().optional().nullable(),
    why_this_service: z.string().optional().nullable(),
    identified_problem: z.string().optional().nullable(),
    audit_friction_points: z.array(z.string()).optional().nullable(),
    evidence: z.array(z.any()).default([]),
    evidence_summary: z.string().optional().nullable(),
    outreach_status: z.string().default('draft'),
    status: z.string().default('new'),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
  })
  .passthrough();

export type RawLeadRecord = z.infer<typeof RawLeadRecordSchema>;

export const LeadsApiResponseSchema = z.union([
  z.array(RawLeadRecordSchema),
  z.object({
    leads: z.array(RawLeadRecordSchema),
    total: z.number().optional(),
    source: z.string().optional(),
  }),
  z.object({
    items: z.array(RawLeadRecordSchema),
    total: z.number().optional(),
  }),
]);

/**
 * Normalizes a raw lead into a consistent frontend NormalizedLead model
 */
export function normalizeLead(raw: RawLeadRecord): NormalizedLead {
  const name =
    (raw.business_name && raw.business_name.trim()) ||
    (raw.title && raw.title.trim()) ||
    'Unnamed Business';

  const category =
    (raw.business_type && raw.business_type.trim()) ||
    'General Services';

  const location =
    (raw.address && raw.address.trim()) ||
    'Delhi NCR';

  // Opportunity Score comes directly from backend data (no recalculation)
  let score = 0;
  if (typeof raw.opportunity_score === 'number' && raw.opportunity_score > 0) {
    score = Math.round(raw.opportunity_score);
  } else if ((raw as any).lead_analysis?.opportunity_score) {
    score = Math.round((raw as any).lead_analysis.opportunity_score);
  } else if (typeof raw.prospect_score === 'number' && raw.prospect_score > 0) {
    score = Math.min(100, Math.round(raw.prospect_score * 10));
  }

  const tier = getOpportunityTier(score);

  // Parse evidence array safely
  const parsedEvidence: EvidenceItem[] = [];
  let observedCount = 0;
  let inferredCount = 0;
  let unknownCount = 0;

  if (Array.isArray(raw.evidence)) {
    for (const item of raw.evidence) {
      if (item && typeof item === 'object') {
        const classification: EvidenceClassification =
          item.classification === 'inferred'
            ? 'inferred'
            : item.classification === 'unknown'
            ? 'unknown'
            : 'observed';

        if (classification === 'observed') observedCount++;
        else if (classification === 'inferred') inferredCount++;
        else unknownCount++;

        parsedEvidence.push({
          source: String(item.source || 'system'),
          finding: String(item.finding || item.text || ''),
          evidence: item.evidence ? String(item.evidence) : undefined,
          confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
          classification,
        });
      }
    }
  }

  // Fallback: If deep research is pending or evidence array is empty, load discovery friction points as observed evidence
  if (parsedEvidence.length === 0 && Array.isArray(raw.audit_friction_points)) {
    for (const friction of raw.audit_friction_points) {
      if (friction) {
        observedCount++;
        parsedEvidence.push({
          source: raw.source_platform || 'discovery',
          finding: String(friction),
          classification: 'observed',
          confidence: 0.85,
        });
      }
    }
  }

  // Normalize confidence (convert 1-10 to 0-1 if needed)
  let conf = raw.confidence_score || 0;
  if (conf > 1 && conf <= 10) {
    conf = conf / 10;
  }

  // Normalize research status safely
  const statusStr = String(raw.research_status || '').toLowerCase();
  const validStatus: ResearchStatus =
    statusStr === 'complete' || statusStr === 'completed'
      ? 'complete'
      : statusStr === 'partial' || statusStr === 'pending' || statusStr === 'failed'
      ? statusStr
      : 'pending';

  // Normalize research priority safely
  const priorityStr = String(raw.research_priority || '').toLowerCase();
  const validPriority: ResearchPriority =
    priorityStr === 'high' || priorityStr === 'medium' || priorityStr === 'low'
      ? priorityStr
      : 'medium';

  return {
    id: String(raw.id),
    name,
    sourcePlatform: String(raw.source_platform || 'google_maps'),
    sourceUrl: String(raw.source_url || ''),
    category,
    location,
    phone: raw.phone_number || null,
    websiteUrl: raw.website_url || null,
    hasWebsite: Boolean(raw.website_url && raw.website_url.trim()),
    googleMapsUrl: raw.google_maps_url || null,
    instagramUrl: raw.instagram_url || null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    reviewCount: typeof raw.review_count === 'number' ? raw.review_count : 0,
    hasActiveAds: Boolean(raw.has_active_ads),
    opportunityScore: score,
    opportunityTier: tier,
    confidenceScore: conf,
    researchStatus: validStatus,
    researchPriority: validPriority,
    recommendedService: raw.recommended_service || 'WhatsApp Automation',
    primaryProblem:
      raw.primary_problem ||
      raw.identified_problem ||
      (Array.isArray(raw.audit_friction_points) && raw.audit_friction_points[0]) ||
      null,
    whyThisService:
      raw.why_this_service ||
      (Array.isArray(raw.audit_friction_points) && raw.audit_friction_points.length > 0
        ? `Identified ${raw.audit_friction_points.length} operational conversion barriers: ${raw.audit_friction_points.join('; ')}`
        : null),
    evidence: parsedEvidence,
    evidenceSummary:
      raw.evidence_summary ||
      (parsedEvidence.length > 0
        ? `Identified ${parsedEvidence.length} operational friction point${parsedEvidence.length > 1 ? 's' : ''} during discovery triage.`
        : null),
    observedCount,
    inferredCount,
    unknownCount,
    outreachStatus: raw.outreach_status || 'draft',
    status: raw.status || 'new',
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
    raw,
  };
}
