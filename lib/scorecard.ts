import type { Lead } from '../types/lead';

export type PriorityTier = 'immediate' | 'high' | 'medium' | 'skip';

export interface ScorecardResult {
  score: number;
  priority: PriorityTier;
  frictionPoints: string[];
}

/**
 * High-ticket service vertical keywords.
 * Businesses in these categories have high customer lifetime value (LTV)
 * and high margin per transaction, making automation ROI immediately obvious.
 */
export const HIGH_TICKET_KEYWORDS: string[] = [
  'dental',
  'dentist',
  'implant',
  'clinic',
  'hair transplant',
  'hair restoration',
  'interior',
  'interior designer',
  'salon',
  'luxury salon',
  'med spa',
  'medspa',
  'aesthetic',
  'aesthetics',
  'dermatolog',
  'cosmetic',
  'plastic surg',
];

/**
 * Validates whether a given URL or handle looks like a legitimate Instagram presence.
 */
export function isValidInstagramUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === 'none' || trimmed === 'n/a' || trimmed === 'null') return false;
  
  if (trimmed.includes('instagram.com/')) {
    const parts = trimmed.split('instagram.com/')[1]?.split(/[/?#]/)[0];
    return Boolean(parts && parts.length > 1 && parts !== 'p' && parts !== 'reel');
  }
  
  // Also support handle format: @handle or handle
  if (trimmed.startsWith('@') && trimmed.length > 2) return true;
  return trimmed.length > 2 && !trimmed.includes(' ') && !trimmed.includes('/');
}

/**
 * Validates whether a given string is a valid website URL.
 */
export function isValidWebsiteUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === 'none' || trimmed === 'n/a' || trimmed === 'null') return false;

  // Filter out WhatsApp & Facebook URLs
  if (
    trimmed.includes('wa.me') ||
    trimmed.includes('whatsapp.com') ||
    trimmed.includes('api.whatsapp.com') ||
    trimmed.includes('fb.me') ||
    trimmed.includes('facebook.com')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

/**
 * Evaluates whether the lead operates in a verified high-ticket local niche.
 */
export function isHighTicketNiche(data: Partial<Lead>): boolean {
  const searchableText = [
    data.business_type,
    data.business_name,
    data.title,
    data.subreddit_or_handle,
    data.body_text,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return HIGH_TICKET_KEYWORDS.some((kw) => searchableText.includes(kw));
}

/**
 * Determines specific operational and conversion friction points for the business.
 */
export function detectFrictionPoints(data: Partial<Lead>): string[] {
  // If pre-audited friction points exist, use them
  if (Array.isArray(data.audit_friction_points) && data.audit_friction_points.length > 0) {
    return Array.from(new Set(data.audit_friction_points.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)));
  }

  const friction: string[] = [];
  const hasWebsite = isValidWebsiteUrl(data.website_url);
  const reviews = typeof data.review_count === 'number' ? data.review_count : 0;

  if (!hasWebsite) {
    friction.push('Missing official website for capturing direct inbound appointments');
  } else {
    // Check if website has WhatsApp or instant booking cues in existing text/data
    const combinedText = `${data.body_text || ''} ${data.identified_problem || ''}`.toLowerCase();
    if (!combinedText.includes('whatsapp') && !combinedText.includes('wa.me')) {
      friction.push('No direct 1-click WhatsApp booking button or inquiry widget on website');
    }
  }

  if (reviews >= 50) {
    friction.push(`High offline review volume (${reviews} reviews) without 24/7 automated inquiry capture`);
  }

  return friction;
}

/**
 * Calculates a pure, deterministic 10-point prospect score for local leads.
 * 
 * Criteria Breakdown:
 * 1. Active Meta / Google Ads running -> +3 points
 * 2. Google Review count >= 50 (healthy offline flow) -> +2 points
 * 3. Verified Instagram handle / URL present -> +1 point
 * 4. Official Website listed -> +1 point
 * 5. Friction points detected (e.g. no WhatsApp CTA, slow inquiry funnel) -> +2 points
 * 6. High-ticket vertical (dental, clinic, hair transplant, interior, luxury salon) -> +1 point
 * 
 * Total possible: 10 points.
 * 
 * Priority Tiers:
 * - 8–10 points: 'immediate' (🔥 Immediate outreach candidate)
 * - 6–7 points: 'high' (🟢 High potential candidate)
 * - 4–5 points: 'medium' (🟡 Medium priority candidate)
 * - 0–3 points: 'skip' (⚪ Skip / Low viability candidate)
 */
export function calculateProspectScore(data: Partial<Lead>): ScorecardResult {
  let score = 0;
  const frictionPoints = detectFrictionPoints(data);

  // 1. Active Ads (+3 pts)
  if (data.has_active_ads === true) {
    score += 3;
  }

  // 2. Review Count >= 50 (+2 pts)
  const reviewCount = typeof data.review_count === 'number' ? data.review_count : 0;
  if (reviewCount >= 50) {
    score += 2;
  }

  // 3. Instagram Presence (+1 pt)
  if (isValidInstagramUrl(data.instagram_url)) {
    score += 1;
  }

  // 4. Website Listed (+1 pt)
  if (isValidWebsiteUrl(data.website_url)) {
    score += 1;
  }

  // 5. Friction Points (+2 pts)
  if (frictionPoints.length > 0) {
    score += 2;
  }

  // 6. High-Ticket Vertical (+1 pt)
  if (isHighTicketNiche(data)) {
    score += 1;
  }

  // Clamp score strictly between 0 and 10
  const normalizedScore = Math.min(10, Math.max(0, score));

  // Determine Priority Tier
  let priority: PriorityTier = 'skip';
  if (normalizedScore >= 8) {
    priority = 'immediate';
  } else if (normalizedScore >= 6) {
    priority = 'high';
  } else if (normalizedScore >= 4) {
    priority = 'medium';
  } else {
    priority = 'skip';
  }

  return {
    score: normalizedScore,
    priority,
    frictionPoints,
  };
}
