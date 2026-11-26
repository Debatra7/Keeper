/**
 * admin-auth Edge Function
 *
 * Validates the admin key entirely server-side so the secret never
 * touches the browser. The function returns a short-lived signed
 * token that the frontend stores in sessionStorage; every subsequent
 * admin API call must present that token.
 *
 * Environment secret required (set via `supabase secrets set`):
 *   ADMIN_KEY  –  the secret admin passphrase
 */

import { createHmac } from 'node:crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Sign a payload so we can verify it later without a DB round-trip. */
function signToken(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Build a session token: base64(payload) + "." + hmac */
function createSessionToken(adminKey: string): string {
  const payload = JSON.stringify({
    role: 'admin',
    // 8-hour expiry
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  });
  const encoded = btoa(payload);
  const sig = signToken(encoded, adminKey);
  return `${encoded}.${sig}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // --- Read & validate body ---
  let body: { key?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const submittedKey = typeof body.key === 'string' ? body.key.trim() : '';
  if (!submittedKey) {
    return new Response(JSON.stringify({ error: 'Missing admin key' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // --- Read server-side secret (never sent to browser) ---
  const configuredKey = Deno.env.get('ADMIN_KEY');
  if (!configuredKey) {
    console.error('ADMIN_KEY secret is not configured on this function');
    return new Response(JSON.stringify({ error: 'Admin auth not configured' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // --- Constant-time comparison to prevent timing attacks ---
  const encoder = new TextEncoder();
  const a = encoder.encode(submittedKey.padEnd(256));
  const b = encoder.encode(configuredKey.padEnd(256));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];

  if (diff !== 0) {
    // Artificial 300 ms delay to slow brute-force
    await new Promise((r) => setTimeout(r, 300));
    return new Response(JSON.stringify({ error: 'Invalid admin key' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // --- Issue a short-lived session token ---
  const token = createSessionToken(configuredKey);

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
