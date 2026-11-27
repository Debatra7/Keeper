/**
 * admin-favicon-upload Edge Function
 *
 * Accepts a favicon file upload from an authenticated admin session,
 * stores it in the `site-assets` Supabase Storage bucket (public),
 * and returns the public URL.
 *
 * The admin session token (issued by admin-auth) is verified via HMAC
 * against the ADMIN_KEY secret.
 */

import { createHmac } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-admin-token',
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
const BUCKET = 'site-assets';

function signToken(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a.padEnd(256));
  const bb = encoder.encode(b.padEnd(256));
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
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
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000))
      return false;
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

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Expected multipart form data with a file' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'Missing "file" field' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response(
      JSON.stringify({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` }),
      { status: 413, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(
      JSON.stringify({
        error: `Unsupported file type "${file.type}". Allowed: PNG, JPEG, WebP, SVG, ICO.`,
      }),
      { status: 415, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const storagePath = `favicon.${ext}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Ensure bucket exists (public so favicon URL works without auth)
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  // Ignore "already exists" errors
  if (bucketError && !bucketError.message?.includes('already exists')) {
    console.error('Failed to create bucket:', bucketError);
  }

  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });

  if (uploadError) {
    console.error('Failed to upload favicon:', uploadError);
    return new Response(JSON.stringify({ error: uploadError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return new Response(
    JSON.stringify({
      ok: true,
      url: urlData.publicUrl,
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
});
