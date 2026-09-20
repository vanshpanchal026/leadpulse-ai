/**
 * Auth utility for LeadPulse Dashboard Passcode Gate.
 * Edge-compatible SHA-256 token hashing for session verification.
 */

const DEFAULT_PASSCODE = 'leadpulse2026';
const SALT = 'leadpulse_v2_secure_auth_salt_';

export function getExpectedPasscode(): string {
  return process.env.DASHBOARD_PASSCODE || DEFAULT_PASSCODE;
}

/**
 * Computes an Edge-compatible SHA-256 token for a given passcode.
 */
export async function generateSessionToken(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${SALT}${passcode}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates a session token against the expected passcode.
 */
export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expectedToken = await generateSessionToken(getExpectedPasscode());
  return token === expectedToken;
}

export const AUTH_COOKIE_NAME = 'leadpulse_session';
