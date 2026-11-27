/**
 * Client-side admin auth helpers.
 *
 * The actual key validation happens inside the Supabase Edge Function
 * `admin-auth`. This module only sends the key there and stores the
 * returned session token — the secret never lives in the JS bundle.
 */

const SESSION_KEY = 'keeper_dev_admin_token';
const SESSION_EXPIRES_AT_KEY = 'keeper_dev_admin_expires_at';
export const ADMIN_SESSION_DURATION_MS = 60 * 60 * 1000;

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`;

export type AdminAuthResult = { ok: true } | { ok: false; error: string };

/** Call the edge function with the submitted key. */
export async function verifyAdminKey(key: string): Promise<AdminAuthResult> {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    const data = (await res.json()) as { token?: string; error?: string };

    if (!res.ok || !data.token) {
      return { ok: false, error: data.error ?? 'Invalid admin key' };
    }

    // Store the server-issued token (not the raw key) and a 60-minute client expiry
    sessionStorage.setItem(SESSION_KEY, data.token);
    sessionStorage.setItem(
      SESSION_EXPIRES_AT_KEY,
      String(Date.now() + ADMIN_SESSION_DURATION_MS)
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach authentication service. Check your connection.' };
  }
}

/** Return remaining milliseconds before the 60-minute admin session expires. */
export function getAdminSessionRemainingMs(): number {
  const rawExpiresAt = sessionStorage.getItem(SESSION_EXPIRES_AT_KEY);
  const expiresAt = rawExpiresAt ? Number(rawExpiresAt) : NaN;
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, expiresAt - Date.now());
}

/** Check whether the current browser session has a valid admin token. */
export function isAdminAuthenticated(): boolean {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) return false;

  if (getAdminSessionRemainingMs() <= 0) {
    clearAdminSession();
    return false;
  }

  try {
    const [encoded] = token.split('.');
    const payload = JSON.parse(atob(encoded)) as { role?: string; exp?: number };
    if (payload.role !== 'admin') return false;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      clearAdminSession();
      return false;
    }
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
}

/** Clear the admin session. */
export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}
