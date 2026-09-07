/**
 * Code-Level Anti-Spam & Tone Validator for Outreach Messages
 * 
 * Enforces strict peer-to-peer tone guardrails before any AI-generated
 * outreach message can be saved to Supabase or displayed on the dashboard.
 */

export interface ValidationCheckDetails {
  bannedPhrases: {
    passed: boolean;
    detected: string[];
  };
  length: {
    passed: boolean;
    sentenceCount: number;
    charCount: number;
    details?: string;
  };
  placeholders: {
    passed: boolean;
    detected: string[];
  };
  schema: {
    passed: boolean;
    details?: string;
  };
}

export interface LeadValidationResult {
  isValid: boolean;
  errors: string[];
  checks: ValidationCheckDetails;
  sanitizedPitch: string;
}

export const BANNED_PHRASES: string[] = [
  // Agency / Corporate We phrasing
  'we help',
  'we specialize',
  'our team',
  'our agency',
  'our clients',
  'we offer',
  'reach out anytime',
  'feel free to reach out',
  
  // Meeting / Sales Call CTAs
  'would you be open to a quick chat',
  'would you be open to a brief chat',
  'would you be open to a quick call',
  'would you be open to a call',
  'would you be open to chatting',
  'quick chat',
  'brief chat',
  'hop on a call',
  'jump on a call',
  'book a call',
  'schedule a call',
  'schedule a demo',
  'let\'s connect',
  'feel free to dm',
  'dm me',
  'shoot me a dm',
  'inbox me',
  'pm me',
  
  // Marketing / Agency Buzzwords
  'game-changer',
  'game changer',
  'streamline',
  'streamlining',
  'leverage',
  'leveraging',
  'tailored solution',
  'cutting-edge',
  'synergy',
  'all-in-one solution',
  'seamlessly integrate',
  'transform your business',
];

/**
 * Counts sentences reliably while ignoring common abbreviations like e.g., i.e., vs.
 */
export function countSentences(text: string): number {
  if (!text || !text.trim()) return 0;
  
  // Clean text and protect abbreviations
  const normalized = text
    .replace(/\b(e\.g\.|i\.e\.|vs\.|approx\.|etc\.|dr\.|mr\.|mrs\.)/gi, (m) => m.replace(/\./g, ''))
    .trim();
    
  // Split on punctuation followed by whitespace or end of string
  const sentences = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
    
  return sentences.length;
}

/**
 * Checks for unresolved placeholder tokens such as [Name], [Company], {client}, <website>, etc.
 */
export function detectPlaceholders(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  
  // Match [Name], [Company], [Your Name], etc.
  const bracketMatches = text.match(/\[[^\]]{2,30}\]/g) || [];
  // Match {name}, {company}, etc.
  const curlyMatches = text.match(/\{[^}]{2,30}\}/g) || [];
  // Match <name>, <company>, etc.
  const angleMatches = text.match(/<[^>]{2,30}>/g) || [];
  
  matches.push(...bracketMatches, ...curlyMatches, ...angleMatches);
  return Array.from(new Set(matches));
}

/**
 * Code-level validator for pitch and lead schema
 */
export function validateLeadOutput(payload: {
  is_potential_lead?: boolean;
  confidence_score?: number | string;
  business_type?: string;
  identified_problem?: string;
  recommended_first_message?: string;
}): LeadValidationResult {
  const errors: string[] = [];
  const pitch = (payload.recommended_first_message || '').trim();
  const pitchLower = pitch.toLowerCase();
  
  // 1. Check Banned Phrases
  const detectedBanned = BANNED_PHRASES.filter((phrase) => pitchLower.includes(phrase));
  const bannedCheckPassed = detectedBanned.length === 0;
  if (!bannedCheckPassed) {
    errors.push(`Contains banned phrase(s): ${detectedBanned.map((p) => `"${p}"`).join(', ')}`);
  }
  
  // 2. Check Length & Sentence Count (2 to 3 sentences max, <= 400 characters)
  const sentenceCount = countSentences(pitch);
  const charCount = pitch.length;
  let lengthCheckPassed = true;
  let lengthDetails = 'OK';
  
  if (charCount < 20) {
    lengthCheckPassed = false;
    lengthDetails = `Too short (${charCount} chars). Pitch must contain concrete technical advice.`;
    errors.push(lengthDetails);
  } else if (sentenceCount > 3) {
    lengthCheckPassed = false;
    lengthDetails = `Too many sentences (${sentenceCount}/3 max). Keep strictly to 2-3 casual sentences.`;
    errors.push(lengthDetails);
  } else if (charCount > 400) {
    lengthCheckPassed = false;
    lengthDetails = `Too long (${charCount}/400 max characters). Exceeds peer brevity limit.`;
    errors.push(lengthDetails);
  }
  
  // 3. Check Unresolved Placeholders
  const detectedPlaceholders = detectPlaceholders(pitch);
  const placeholderCheckPassed = detectedPlaceholders.length === 0;
  if (!placeholderCheckPassed) {
    errors.push(`Contains unfilled template placeholder(s): ${detectedPlaceholders.join(', ')}`);
  }
  
  // 4. Check Schema & Sanity
  let schemaPassed = true;
  let schemaDetails = 'OK';
  const score = Number(payload.confidence_score);
  
  if (payload.is_potential_lead !== true) {
    schemaPassed = false;
    schemaDetails = 'is_potential_lead is not true';
    errors.push(schemaDetails);
  } else if (isNaN(score) || score < 7 || score > 10) {
    schemaPassed = false;
    schemaDetails = `Confidence score (${payload.confidence_score}) is below qualification threshold of 7 or invalid.`;
    errors.push(schemaDetails);
  } else if (!payload.business_type || !payload.business_type.trim()) {
    schemaPassed = false;
    schemaDetails = 'Missing business_type';
    errors.push(schemaDetails);
  } else if (!payload.identified_problem || !payload.identified_problem.trim()) {
    schemaPassed = false;
    schemaDetails = 'Missing identified_problem';
    errors.push(schemaDetails);
  }
  
  const isValid = bannedCheckPassed && lengthCheckPassed && placeholderCheckPassed && schemaPassed;
  
  return {
    isValid,
    errors,
    checks: {
      bannedPhrases: {
        passed: bannedCheckPassed,
        detected: detectedBanned,
      },
      length: {
        passed: lengthCheckPassed,
        sentenceCount,
        charCount,
        details: lengthDetails,
      },
      placeholders: {
        passed: placeholderCheckPassed,
        detected: detectedPlaceholders,
      },
      schema: {
        passed: schemaPassed,
        details: schemaDetails,
      },
    },
    sanitizedPitch: pitch.replace(/\s+/g, ' ').trim(),
  };
}
