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
