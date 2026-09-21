import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Safely parse a date string or Date object into a valid Date.
 * Returns null if invalid or missing.
 */
export function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    // Attempt parseISO first
    try {
      const d = parseISO(value);
      if (isValid(d)) return d;
    } catch {
      // ignore
    }
    // Fallback to standard Date constructor
    try {
      const d = new Date(value);
      if (isValid(d)) return d;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Format date string safely with date-fns format().
 * Returns fallback if date is missing or invalid.
 */
export function formatSafeDate(
  value: string | number | Date | null | undefined,
  pattern: string = 'MMM d, yyyy HH:mm',
  fallback: string = '—'
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
}

/**
 * Format relative distance to now safely using date-fns formatDistanceToNow().
 * Returns fallback if date is missing or invalid.
 */
export function formatSafeRelativeTime(
  value: string | number | Date | null | undefined,
  fallback: string = 'Just now'
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  try {
    return `${formatDistanceToNow(d, { addSuffix: true })}`;
  } catch {
    return fallback;
  }
}

/**
 * Format seconds into human-readable duration (e.g., '1m 24s' or '45s').
 */
export function formatSafeDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0s';
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
