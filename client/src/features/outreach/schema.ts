import { z } from 'zod';
import { PreSendQualityResult, PersonalizationQualityResult, OutreachQualityLevel } from './types';

export const OutreachMessageSchema = z
  .string()
  .trim()
  .min(1, 'Outreach message cannot be empty.')
  .max(450, 'Message cannot exceed 450 characters.');

export const OutreachEvidenceItemSchema = z.object({
  field: z.string().default(''),
  source: z.string().default('unknown'),
  raw_value: z.unknown().optional(),
  confidence: z.number().default(0.5),
  extracted_at: z.string().optional(),
  validation_source: z.string().optional(),
});

export const OutreachValidationResultSchema = z.object({
  valid: z.boolean(),
  reasons: z.array(z.string()).default([]),
  errors: z.array(z.string()).optional(),
  character_count: z.number().default(0),
  sentence_count: z.number().default(0),
  detected_service: z.string().nullable().optional(),
  banned_phrase_found: z.boolean().default(false),
  unsupported_claim_detected: z.boolean().default(false),
  placeholder_detected: z.boolean().default(false),
  unsupported_service: z.boolean().default(false),
});

export const OutreachDraftSchema = z.object({
  message: z.string(),
  service: z.string(),
  evidence_used: z.array(OutreachEvidenceItemSchema).default([]),
  confidence: z.number().default(0.5),
  status: z.enum(['draft', 'rejected']).default('draft'),
  validation_reasons: z.array(z.string()).default([]),
  character_count: z.number().default(0),
  sentence_count: z.number().default(0),
});

export const OutreachRecordSchema = z.object({
  lead_id: z.string(),
  business_name: z.string(),
  opportunity_score: z.number().default(0),
  primary_problem: z.string().default(''),
  recommended_service: z.string().default(''),
  confidence: z.number().default(0.5),
  evidence: z.array(OutreachEvidenceItemSchema).default([]),
  draft: OutreachDraftSchema,
  validation: OutreachValidationResultSchema,
  approval_status: z.enum(['awaiting_human_approval', 'approved', 'rejected', 'needs_revision']).default('awaiting_human_approval'),
  lifecycle_status: z.string().optional(),
  regeneration_count: z.number().default(0),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export const OutreachListResponseSchema = z.array(OutreachRecordSchema);

export const OutreachActionResponseSchema = z.object({
  success: z.boolean(),
  record: OutreachRecordSchema.optional(),
  message: z.string(),
  external_send_executed: z.boolean(),
});

export const BANNED_SALES_PHRASES = [
  'we help',
  'we specialize',
  'hop on a call',
  'book a demo',
  'game-changer',
  'game changer',
  'leverage',
  'our team',
  'our clients',
  'reach out anytime',
  'tailored solution',
  'synergy',
  'quick chat',
  'free consultation call',
  'act now',
  'limited time',
  'guaranteed results',
];

export const TEMPLATE_PLACEHOLDERS = [
  '[name]',
  '[company]',
  '[business]',
  '[clinic]',
  '{name}',
  '{company}',
  '{business}',
  '<business>',
  '<name>',
  'your business',
  'insert name',
];

export const GENERIC_OPENINGS = [
  'dear sir',
  'dear madam',
  'to whom it may concern',
  'hey there, i came across',
  'hello friend',
];

/**
 * Deterministic pre-send quality and anti-spam validator.
 * Provides advisory feedback to the human reviewer before approval.
 */
export function validateDraftQuality(
  message: string,
  businessName?: string,
  context?: {
    location?: string;
    service?: string;
    primaryProblem?: string;
    evidenceSnippet?: string;
  }
): PreSendQualityResult {
  const trimmed = message.trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  const charCount = trimmed.length;
  // Sentence count regex: matches sequences of characters ending with . ! or ?
  const sentenceMatches = trimmed.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  const sentenceCount = sentenceMatches.length || (trimmed.length > 0 ? 1 : 0);

  // 1. Empty / Extremely short check
  if (!trimmed) {
    errors.push('Message is completely empty.');
  } else if (trimmed.length < 25) {
    warnings.push('Message is extremely short (under 25 characters).');
  }

  // 2. Length check
  if (charCount > 300) {
    if (charCount > 360) {
      errors.push(`Excessive length: ${charCount} chars (hard cap is 360 chars).`);
    } else {
      warnings.push(`Draft is slightly long (${charCount} chars). Ideal WhatsApp pitch is under 300 chars.`);
    }
  }

  // 3. Sentence count check
  if (sentenceCount > 4) {
    warnings.push(`Too many sentences (${sentenceCount}). High-converting pitches are 2–3 sentences.`);
  } else if (sentenceCount < 1 && trimmed.length > 0) {
    warnings.push('Message lacks complete sentence ending punctuation (. or ?).');
  }

  // 4. Banned sales / spam agency phrases
  const lower = trimmed.toLowerCase();
  let hasBanned = false;
  for (const phrase of BANNED_SALES_PHRASES) {
    if (lower.includes(phrase)) {
      errors.push(`Spam phrase detected: "${phrase}". Use peer-to-peer consultative phrasing.`);
      hasBanned = true;
    }
  }

  // 5. Template placeholders
  let hasPlaceholders = false;
  for (const placeholder of TEMPLATE_PLACEHOLDERS) {
    if (lower.includes(placeholder)) {
      errors.push(`Unfilled template placeholder detected: "${placeholder}".`);
      hasPlaceholders = true;
    }
  }

  // 6. Excessive punctuation
  let hasExcessivePunct = false;
  if (/!{2,}|\?{2,}|\.{4,}/.test(trimmed)) {
    warnings.push('Repeated punctuation marks detected (e.g. "!!" or "???"). Keep punctuation professional.');
    hasExcessivePunct = true;
  }

  // 7. Excessive capitalization
  let hasExcessiveCaps = false;
  const uppercaseWords = trimmed.match(/\b[A-Z]{3,}\b/g) || [];
  const spamCaps = uppercaseWords.filter(
    (w) => !['CEO', 'CTO', 'CRM', 'CTA', 'SEO', 'API', 'URL', 'SMS', 'DOM', 'AI', 'INR', 'USD', 'NCR'].includes(w)
  );
  if (spamCaps.length > 0) {
    warnings.push(`Excessive capitalization in words: ${spamCaps.join(', ')}.`);
    hasExcessiveCaps = true;
  }

  // 8. Excessive emojis
  let hasExcessiveEmojis = false;
  const emojiMatches = trimmed.match(/\p{Extended_Pictographic}/gu) || [];
  if (emojiMatches.length > 2) {
    warnings.push(`Excessive emojis (${emojiMatches.length} detected). Business outreach should use minimal or zero emojis.`);
    hasExcessiveEmojis = true;
  }

  // 9. URL spam check
  const urlMatches = trimmed.match(/https?:\/\/|www\./gi) || [];
  if (urlMatches.length > 1) {
    warnings.push('Multiple URLs detected. Pitches should avoid link spam in cold outreach.');
  }

  // 10. Generic Opening check
  let genericOpening = false;
  for (const op of GENERIC_OPENINGS) {
    if (lower.startsWith(op)) {
      warnings.push(`Generic mass-outreach opening detected ("${op}"). Address the specific business directly.`);
      genericOpening = true;
      break;
    }
  }

  // 11. Personalization quality evaluation
  let businessNameUsed = false;
  if (businessName) {
    const firstBizWord = businessName.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (firstBizWord && firstBizWord.length > 2 && lower.includes(firstBizWord)) {
      businessNameUsed = true;
    }
  }

  let locationReferenced = false;
  if (context?.location) {
    const locWord = context.location.split(/[,\s]+/)[0]?.toLowerCase();
    if (locWord && locWord.length > 2 && lower.includes(locWord)) {
      locationReferenced = true;
    }
  }

  let serviceReferenced = false;
  if (context?.service) {
    const srvWords = context.service.toLowerCase().split(/[\s_]+/);
    if (srvWords.some((w) => w.length > 3 && lower.includes(w))) {
      serviceReferenced = true;
    }
  }

  let problemReferenced = false;
  if (context?.primaryProblem) {
    const probWords = context.primaryProblem.toLowerCase().split(/[\s_]+/);
    if (probWords.some((w) => w.length > 4 && lower.includes(w))) {
      problemReferenced = true;
    }
  }

  let evidenceReferenced = false;
  if (context?.evidenceSnippet) {
    // Check if any metric or key term is echoed
    const metrics = context.evidenceSnippet.match(/\d+/g) || [];
    if (metrics.some((m) => trimmed.includes(m))) {
      evidenceReferenced = true;
    }
  }

  const personalization: PersonalizationQualityResult = {
    businessNameUsed,
    problemReferenced,
    serviceReferenced,
    locationReferenced,
    evidenceReferenced,
    genericOpeningDetected: genericOpening,
  };

  // Determine overall quality level: 'PASS' | 'WARNING' | 'BLOCK' | 'BLOCKED'
  let level: OutreachQualityLevel = 'PASS';
  if (errors.length > 0) {
    level = 'BLOCK';
  } else if (warnings.length > 0) {
    level = 'WARNING';
  }

  return {
    level,
    isValid: errors.length === 0,
    errors,
    warnings,
    characterCount: charCount,
    sentenceCount,
    hasBannedPhrases: hasBanned,
    hasPlaceholders,
    hasExcessivePunctuation: hasExcessivePunct,
    hasExcessiveCaps,
    hasExcessiveEmojis,
    personalization,
  };
}
