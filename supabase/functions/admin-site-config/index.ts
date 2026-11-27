/**
 * admin-site-config Edge Function
 *
 * Verifies the HMAC-signed admin session token issued by `admin-auth`
 * and updates `public.keeper_site_config` using the service role key,
 * so admin-authenticated sessions can persist global site config without
 * requiring a separate Supabase user login.
 */

import { createHmac } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-admin-token',
};

function signToken(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function constantTimeEqual(aStr: string, bStr: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(aStr.padEnd(256));
  const b = encoder.encode(bStr.padEnd(256));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function verifyAdminToken(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;

  const expectedSig = signToken(encoded, secret);
  if (!constantTimeEqual(sig, expectedSig)) return false;

  try {
    const payload = JSON.parse(atob(encoded)) as { role?: string; exp?: number };
    if (payload.role !== 'admin') return false;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const configuredKey = Deno.env.get('ADMIN_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!configuredKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration incomplete' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const headerToken =
    req.headers.get('x-admin-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerToken || !verifyAdminToken(headerToken.trim(), configuredKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized admin session' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from('keeper_site_config').upsert({
    id: 'global',
    favicon_url: typeof body.faviconUrl === 'string' && body.faviconUrl ? body.faviconUrl : null,
    site_title: typeof body.siteTitle === 'string' && body.siteTitle ? body.siteTitle : 'Keeper',
    default_accent:
      typeof body.defaultAccent === 'string' && body.defaultAccent ? body.defaultAccent : '#a8b5ff',
    default_background:
      body.defaultBackground === 'solid' ||
      body.defaultBackground === 'gradient' ||
      body.defaultBackground === 'image'
        ? body.defaultBackground
        : 'solid',
    default_color1:
      typeof body.defaultColor1 === 'string' && body.defaultColor1 ? body.defaultColor1 : '#08090b',
    default_color2:
      typeof body.defaultColor2 === 'string' && body.defaultColor2 ? body.defaultColor2 : '#242832',
    default_image:
      typeof body.defaultImage === 'string' && body.defaultImage ? body.defaultImage : null,
    default_font:
      typeof body.defaultFont === 'string' && body.defaultFont ? body.defaultFont : 'Roboto',
    default_font_size:
      body.defaultFontSize === 14 ||
      body.defaultFontSize === 16 ||
      body.defaultFontSize === 20 ||
      body.defaultFontSize === 24
        ? body.defaultFontSize
        : 16,
    allowed_fonts: Array.isArray(body.allowedFonts) ? body.allowedFonts : undefined,
    accent_palette: Array.isArray(body.accentPalette) ? body.accentPalette : undefined,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to upsert keeper_site_config:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
