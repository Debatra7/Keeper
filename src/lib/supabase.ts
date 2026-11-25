import { createClient } from '@supabase/supabase-js';
import { normalizeDocument, type KeeperDocument } from './validation';
import type { DataBackup } from '../features/settings/SettingsPanel';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export async function readRemoteDocument(_userId: string, signal?: AbortSignal) {
  if (!supabase) return null;
  const query = supabase.rpc('get_keeper_document');
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (data === null) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Remote Keeper document is invalid');
  const { revision, ...rawDocument } = data as Record<string, unknown>;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision)) throw new Error('Remote Keeper revision is invalid');
  const document = normalizeDocument(rawDocument);
  if (!document) throw new Error('Remote Keeper document is invalid');
  return { document, revision };
}

export async function writeRemoteDocument(_userId: string, document: KeeperDocument, revision: number | null, signal?: AbortSignal) {
  if (!supabase) return;
  const query = supabase.rpc('replace_keeper_document', { p_document: document, p_revision: revision });
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (data === null) throw new Error('Sync conflict: document changed on another device');
  return data as number;
}

export async function clearRemoteKeeperData(_userId: string, checkpoints: DataBackup[]) {
  if (!supabase) throw new Error('Cloud sync is unavailable');
  const { data, error } = await supabase.rpc('clear_keeper_data', { p_checkpoints: checkpoints });
  if (error) throw error;
  if (typeof data !== 'number' || !Number.isSafeInteger(data)) throw new Error('Cloud data could not be cleared');
  return data;
}
