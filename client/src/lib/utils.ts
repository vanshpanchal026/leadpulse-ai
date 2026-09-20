import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as percentage string (safely handles 0-1 and 0-100 scales)
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0%';
  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
}

export type OpportunityTier = 'Immediate' | 'High Potential' | 'Medium' | 'Low';

/**
 * Determine opportunity tier from score directly
 * - 80–100 → Immediate
 * - 60–79 → High Potential
 * - 40–59 → Medium
 * - 0–39 → Low
 */
export function getOpportunityTier(score: number): OpportunityTier {
  if (score >= 80) return 'Immediate';
  if (score >= 60) return 'High Potential';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Format opportunity score with design token classes and tier label
 * - score >= 80: High priority violet accent (info-bg / info-fg / info-border)
 * - score >= 40: Neutral muted
 * - score < 40: Neutral disabled
 */
export function getOpportunityScoreColor(score: number): {
  textClass: string;
  bgClass: string;
  borderClass: string;
  label: OpportunityTier;
} {
  const tier = getOpportunityTier(score);
  if (score >= 80) {
    return {
      textClass: 'text-[hsl(var(--info-fg))] font-semibold tabular-nums',
      bgClass: 'bg-[hsl(var(--info-bg))]',
      borderClass: 'border-[hsl(var(--info-border))]',
      label: tier,
    };
  }

  if (score >= 40) {
    return {
      textClass: 'text-muted-foreground font-medium tabular-nums',
      bgClass: 'bg-secondary',
      borderClass: 'border-border',
      label: tier,
    };
  }

  return {
    textClass: 'text-[hsl(var(--disabled))] font-normal tabular-nums',
    bgClass: 'bg-secondary',
    borderClass: 'border-border',
    label: tier,
  };
}

export interface StructuredPoint {
  raw: string;
  number?: string;
  label?: string;
  text: string;
}

/**
 * Parses multi-point rationale, reasoning, or analysis text into structured points.
 * Correctly splits:
 * - Inline numbered items: "1. Observed Problem: ... 2. Business Consequence: ..."
 * - Newline delimited items: "1. ...\n2. ..."
 * - Inline or multiline bullet points: "• ... • ..." or "- ... - ..."
 * - Single text string fallback
 */
export function parseStructuredPoints(rawText?: string | null): StructuredPoint[] {
  if (!rawText || rawText.trim() === '' || rawText.trim().toLowerCase() === 'unknown') {
    return [];
  }

  const text = rawText.trim();
  let items: string[] = [];

  if (text.includes('\n')) {
    items = text
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  } else {
    // Match inline numbered patterns: "1. ... 2. ... 3. ..." or "1) ... 2) ..."
    const numberedMatches = [...text.matchAll(/(?:^|\s+)(\d+[\.\)]\s+[\s\S]*?)(?=(?:\s+\d+[\.\)]\s+|$))/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);

    if (numberedMatches.length > 1) {
      items = numberedMatches;
    } else {
      // Match inline bullets: "• ... • ..." or "- ... - ..."
      const bulletMatches = [...text.matchAll(/(?:^|\s+)([•\-\*]\s+[\s\S]*?)(?=(?:\s+[•\-\*]\s+|$))/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);

      if (bulletMatches.length > 1) {
        items = bulletMatches;
      } else {
        items = [text];
      }
    }
  }

  return items.map((item, index) => {
    // Match optional number/bullet prefix and optional label (e.g., "1. Observed Problem: ...")
    const match = item.match(/^(?:(\d+)[\.\)]\s*|[•\-\*]\s*)?(?:([A-Za-z\s]{2,35}:)\s*)?(.*)$/);
    if (match) {
      const num = match[1] || (items.length > 1 ? String(index + 1) : undefined);
      const label = match[2]?.trim();
      const content = match[3]?.trim() || item;
      return {
        raw: item,
        number: num,
        label,
        text: content,
      };
    }
    return {
      raw: item,
      number: items.length > 1 ? String(index + 1) : undefined,
      text: item,
    };
  });
}

