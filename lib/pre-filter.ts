/**
 * Local Pre-Filter (Stage 2 Triage)
 * 
 * Determines whether a scraped Reddit post is an "Obvious Reject"
 * (which gets immediately discarded without spending Gemini API quota)
 * or a valid "Candidate" eligible for Gemini Flash evaluation.
 */

export interface PreFilterResult {
  isCandidate: boolean;
  rejectReason?: string;
  matchedKeyword?: string;
}

export const OBVIOUS_REJECT_PATTERNS: { name: string; regex: RegExp }[] = [
  // Freelancers & service sellers
  { name: 'for_hire_tag', regex: /\[for\s*hire\]|\bfor\s*hire\b/i },
  { name: 'hire_me', regex: /\bhire me\b|\bavailable for hire\b|\bopen for work\b/i },
  { name: 'portfolio_pitch', regex: /\bportfolio\s*:\s*https?:\/\//i },
  { name: 'offering_services', regex: /\bi offer (development|design|seo|marketing|services)\b/i },
  { name: 'developer_pitch', regex: /\b(freelance web developer available|experienced developer looking for)\b/i },
  
  // Community bot & meta announcements
  { name: 'weekly_thread', regex: /\b(weekly|monthly)\s+(roundup|megathread|discussion|digest|showcase)\b/i },
  { name: 'security_report', regex: /\bsecurity\s+report\b/i },
  { name: 'this_weeks_top', regex: /this week's top/i },
  { name: 'rules_announcement', regex: /\b(rules and guidelines|moderator post|sub update|megathread)\b/i },
  { name: 'deleted_or_removed', regex: /^(\[removed\]|\[deleted\])$/i },
];

export const CANDIDATE_SIGNALS: { name: string; regex: RegExp }[] = [
  { name: 'missed_calls', regex: /\bmissed (calls|inquiries|clients|leads)\b/i },
  { name: 'after_hours', regex: /\bafter hours|after-hours|outside business hours|overnight messages\b/i },
  { name: 'message_overload', regex: /\b(too many messages|drowning in dms|overwhelmed with messages|inbox chaos)\b/i },
  { name: 'scheduling_friction', regex: /\b(double booking|scheduling friction|calendar sync|booking chaos|calendly issue)\b/i },
  { name: 'lead_followup', regex: /\b(lead capture|lost leads|following up|intake process|customer drop-off)\b/i },
  { name: 'whatsapp_friction', regex: /\b(whatsapp business|whatsapp messages|route texts|customer texts)\b/i },
  { name: 'manual_operations', regex: /\b(manual data entry|copying to spreadsheet|crm update|automating inquiries)\b/i },
];

export const PRIORITY_BUSINESS_SUBREDDITS = new Set([
  'smallbusiness',
  'smallbusinessowners',
  'restaurantowners',
  'realtors',
  'shopify',
  'entrepreneur',
  'localbusiness',
]);

/**
 * Evaluates whether a raw Reddit post should be sent to Gemini or dropped immediately.
 */
export function evaluatePostWithPreFilter(post: {
  title?: string;
  body?: string;
  subreddit?: string;
}): PreFilterResult {
  const title = (post.title || '').trim();
  const body = (post.body || '').trim();
  const fullText = `${title} ${body}`.trim();
  const sub = (post.subreddit || '').toLowerCase().replace(/^r\//, '');

  // 1. Check for empty or excessively short content
  if (fullText.length < 30) {
    return {
      isCandidate: false,
      rejectReason: `Content too short (${fullText.length} chars), insufficient context for evaluation.`,
    };
  }

  // 2. Check for Obvious Rejects (Freelancer offerings, meta noise, megathreads)
  for (const { name, regex } of OBVIOUS_REJECT_PATTERNS) {
    if (regex.test(title) || regex.test(fullText)) {
      return {
        isCandidate: false,
        rejectReason: `Matched obvious reject pattern: ${name}`,
      };
    }
  }

  // 3. Detect candidate pain signals
  let matchedSignal: string | undefined;
  for (const { name, regex } of CANDIDATE_SIGNALS) {
    if (regex.test(fullText)) {
      matchedSignal = name;
      break;
    }
  }

  // If from a high-intent business subreddit or matches operational signals, accept as candidate
  const isPrioSub = PRIORITY_BUSINESS_SUBREDDITS.has(sub);
  if (matchedSignal || isPrioSub) {
    return {
      isCandidate: true,
      matchedKeyword: matchedSignal || 'general_business_inquiry',
    };
  }

  // If outside priority subreddits and contains zero business friction signals, reject as non-candidate
  return {
    isCandidate: false,
    rejectReason: `Outside target niche: No operational friction signals found in r/${sub || 'unknown'}.`,
  };
}
