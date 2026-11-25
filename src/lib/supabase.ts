import { createClient } from '@supabase/supabase-js';
import { normalizeDocument, type KeeperDocument } from './validation';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export async function readRemoteDocument(_userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_keeper_document');
  if (error) throw error;
  if (data === null) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Remote Keeper document is invalid');
  const { revision, ...rawDocument } = data as Record<string, unknown>;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision)) throw new Error('Remote Keeper revision is invalid');
  const document = normalizeDocument(rawDocument);
  if (!document) throw new Error('Remote Keeper document is invalid');
  return { document, revision };
}

export async function writeRemoteDocument(_userId: string, document: KeeperDocument, revision: number | null) {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('replace_keeper_document', { p_document: document, p_revision: revision });
  if (error) throw error;
  if (data === null) throw new Error('Sync conflict: document changed on another device');
  return data as number;
}
