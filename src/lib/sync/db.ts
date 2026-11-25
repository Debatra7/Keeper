import type { Mutation } from './types';

const DB_NAME = 'keeper_sync_storage_v1';
const DB_VERSION = 1;
const STORE_OUTBOX = 'outbox';
const STORE_META = 'metadata';

const DEVICE_ID_KEY = 'keeper_device_id';
const LAST_SEQ_KEY = 'keeper_last_server_seq';
const LAST_SYNCED_KEY = 'keeper_last_synced_at';
const CLOUD_BACKUP_ENABLED_KEY = 'keeper_cloud_backup_enabled';
const LOCAL_STORAGE_OUTBOX_KEY = 'keeper_sync_outbox_fallback';

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) {
      cachedDeviceId = existing.trim();
      return cachedDeviceId;
    }
  } catch {
    // LocalStorage might be restricted
  }

  const generated = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  try {
    localStorage.setItem(DEVICE_ID_KEY, generated);
  } catch {
    // Ignore storage errors
  }
  cachedDeviceId = generated;
  return generated;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let indexedDBAvailable = typeof indexedDB !== 'undefined';

function openDatabase(): Promise<IDBDatabase> {
  if (!indexedDBAvailable) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        indexedDBAvailable = false;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
      request.onblocked = () => {
        // Handle blocked database
      };
    } catch (err) {
      indexedDBAvailable = false;
      reject(err);
    }
  });

  return dbPromise;
}

// Fallback methods using localStorage
function getLocalStorageOutbox(): Mutation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalStorageOutbox(mutations: Mutation[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_OUTBOX_KEY, JSON.stringify(mutations));
  } catch {
    // Storage full or unavailable
  }
}

export async function addOutboxMutation(mutation: Mutation): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.put(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
    const list = getLocalStorageOutbox();
    const filtered = list.filter(m => m.id !== mutation.id);
    filtered.push(mutation);
    setLocalStorageOutbox(filtered);
  }
}

export async function getOutboxMutations(): Promise<Mutation[]> {
  try {
    const db = await openDatabase();
    return await new Promise<Mutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as Mutation[];
        // Sort chronologically by clientTime
        results.sort((a, b) => Date.parse(a.clientTime) - Date.parse(b.clientTime));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
    const list = getLocalStorageOutbox();
    list.sort((a, b) => Date.parse(a.clientTime) - Date.parse(b.clientTime));
    return list;
  }
}

export async function removeOutboxMutations(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const idSet = new Set(ids);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback
    const list = getLocalStorageOutbox();
    const remaining = list.filter(m => !idSet.has(m.id));
    setLocalStorageOutbox(remaining);
  }
}

export async function clearOutbox(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
    setLocalStorageOutbox([]);
  }
}

export function getLastServerSeq(): number {
  try {
    const val = localStorage.getItem(LAST_SEQ_KEY);
    if (!val) return 0;
    const parsed = Number(val);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setLastServerSeq(seq: number): void {
  try {
    localStorage.setItem(LAST_SEQ_KEY, String(seq));
  } catch {
    // Ignore storage errors
  }
}

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(timestamp: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, timestamp);
  } catch {
    // Ignore storage errors
  }
}

export function getCloudBackupEnabled(): boolean {
  try {
    const val = localStorage.getItem(CLOUD_BACKUP_ENABLED_KEY);
    if (val === null) return true; // Enabled by default
    return val === 'true';
  } catch {
    return true;
  }
}

export function setCloudBackupEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CLOUD_BACKUP_ENABLED_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

export function resetSyncMetadata(): void {
  try {
    localStorage.removeItem(LAST_SEQ_KEY);
    localStorage.removeItem(LAST_SYNCED_KEY);
  } catch {
    // Ignore
  }
}
