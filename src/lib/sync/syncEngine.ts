import type { Session, RealtimeChannel } from '@supabase/supabase-js';
import { supabase, readRemoteDocument, writeRemoteDocument } from '../supabase';
import type { KeeperDocument } from '../validation';
import type { Mutation, SyncEngineState, SyncResult, SyncStatus, EntityType, MutationOp, SyncErrorDetails } from './types';
import {
  getDeviceId,
  getOutboxMutations,
  addOutboxMutation,
  removeOutboxMutations,
  getLastServerSeq,
  setLastServerSeq,
  getLastSyncedAt,
  setLastSyncedAt,
  getCloudBackupEnabled,
  setCloudBackupEnabled,
} from './db';
import { mergeRemoteChanges, rebaseDocument } from './conflictResolver';

type StateListener = (state: SyncEngineState) => void;
type DocumentUpdateListener = (doc: KeeperDocument) => void;

export class SyncEngine {
  private deviceId: string;
  private session: Session | null = null;
  private status: SyncStatus = 'offline';
  private pendingCount = 0;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private errorDetails: SyncErrorDetails | null = null;
  private serverSeq = 0;
  private cloudBackupEnabled = true;
  private isOnline = true;

  private isSyncing = false;
  private hasPendingWork = false;
  private syncTimeout: number | null = null;
  private retryTimeout: number | null = null;
  private retryAttempt = 0;
  private realtimeChannel: RealtimeChannel | null = null;

  private stateListeners: Set<StateListener> = new Set();
  private documentListeners: Set<DocumentUpdateListener> = new Set();
  private getCurrentDocument: (() => KeeperDocument) | null = null;

  constructor() {
    this.deviceId = getDeviceId();
    this.serverSeq = getLastServerSeq();
    this.lastSyncedAt = getLastSyncedAt();
    this.cloudBackupEnabled = getCloudBackupEnabled();
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!this.cloudBackupEnabled) {
      this.status = 'paused';
    } else if (!this.isOnline) {
      this.status = 'offline';
    } else {
      this.status = 'synced';
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public getState(): SyncEngineState {
    return {
      status: this.status,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      errorDetails: this.errorDetails,
      deviceId: this.deviceId,
      serverSeq: this.serverSeq,
      cloudBackupEnabled: this.cloudBackupEnabled,
      isOnline: this.isOnline,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onRemoteUpdate(listener: DocumentUpdateListener): () => void {
    this.documentListeners.add(listener);
    return () => {
      this.documentListeners.delete(listener);
    };
  }

  private notifyState(): void {
    const state = this.getState();
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in sync state listener:', err);
      }
    }
  }

  private notifyDocument(doc: KeeperDocument): void {
    for (const listener of this.documentListeners) {
      try {
        listener(doc);
      } catch (err) {
        console.error('Error in document update listener:', err);
      }
    }
  }

  public setCloudBackupEnabled(enabled: boolean): void {
    if (this.cloudBackupEnabled === enabled) return;
    this.cloudBackupEnabled = enabled;
    setCloudBackupEnabled(enabled);

    if (!enabled) {
      if (this.syncTimeout) window.clearTimeout(this.syncTimeout);
      if (this.retryTimeout) window.clearTimeout(this.retryTimeout);
      this.status = 'paused';
      this.errorDetails = null;
      this.notifyState();
    } else {
      this.status = this.isOnline ? 'syncing' : 'offline';
      this.notifyState();
      this.scheduleSync(50);
    }
  }

  public setSession(
    session: Session | null,
    getCurrentDocument: () => KeeperDocument,
    onDocumentUpdated?: DocumentUpdateListener
  ): void {
    const prevUserId = this.session?.user.id;
    const nextUserId = session?.user.id;
    this.session = session;
    this.getCurrentDocument = getCurrentDocument;

    if (onDocumentUpdated) {
      this.documentListeners.add(onDocumentUpdated);
    }

    if (prevUserId !== nextUserId) {
      this.serverSeq = getLastServerSeq();
      if (this.realtimeChannel && supabase) {
        void supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }

      if (nextUserId && supabase) {
        this.setupRealtime(nextUserId);
        if (this.cloudBackupEnabled) {
          this.scheduleSync(100);
        }
      } else {
        this.status = this.cloudBackupEnabled ? 'offline' : 'paused';
        this.notifyState();
      }
    }

    void this.refreshPendingCount();
  }

  private setupRealtime(userId: string): void {
    if (!supabase) return;

    this.realtimeChannel = supabase
      .channel(`keeper_sync:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'keeper_sync_state',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (this.cloudBackupEnabled) {
            this.scheduleSync(100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'keeper_change_log',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const newRow = payload.new as { device_id?: string; seq?: number };
          if (newRow?.device_id && newRow.device_id !== this.deviceId && this.cloudBackupEnabled) {
            this.scheduleSync(50);
          }
        }
      )
      .subscribe();
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    this.retryAttempt = 0;
    this.errorDetails = null;
    if (this.cloudBackupEnabled) {
      this.scheduleSync(100);
    } else {
      this.status = 'paused';
      this.notifyState();
    }
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.status = this.cloudBackupEnabled ? 'offline' : 'paused';
    if (this.cloudBackupEnabled) {
      this.errorDetails = this.parseError(new Error('Internet disconnected'));
    }
    this.notifyState();
  };

  public async refreshPendingCount(): Promise<number> {
    const outbox = await getOutboxMutations();
    this.pendingCount = outbox.length;
    this.notifyState();
    return this.pendingCount;
  }

  /**
   * Capture a local mutation (CDC), save to outbox, and trigger sync.
   */
  public async queueMutation<T = any>(
    entityType: EntityType,
    entityId: string,
    op: MutationOp,
    data: T
  ): Promise<Mutation<T>> {
    const mutation: Mutation<T> = {
      id: `mut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
      deviceId: this.deviceId,
      entityType,
      entityId,
      op,
      data,
      clientTime: new Date().toISOString(),
      baseVersion: this.serverSeq,
    };

    await addOutboxMutation(mutation);
    await this.refreshPendingCount();
    if (this.cloudBackupEnabled) {
      this.scheduleSync(300);
    }
    return mutation;
  }

  public scheduleSync(delayMs = 250): void {
    if (!this.cloudBackupEnabled) return;
    if (this.syncTimeout) {
      window.clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = window.setTimeout(() => {
      void this.sync();
    }, delayMs);
  }

  private parseError(err: any): SyncErrorDetails {
    const msg = String(err?.message || err || '');
    const code = err?.code || err?.status || err?.statusCode;
    const now = new Date().toISOString();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        code: 'NETWORK_OFFLINE',
        title: 'Device is offline',
        message: 'Your browser is currently disconnected from the internet.',
        suggestion: 'Changes are safely preserved in this browser’s local database. Sync will automatically resume as soon as connection returns.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    if (!this.session?.user.id) {
      return {
        code: 'AUTH_REQUIRED',
        title: 'Not signed in',
        message: 'Cloud backup requires an active signed-in account.',
        suggestion: 'Sign in or create an account in Settings to sync across your devices.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    if (/auth|session|jwt|token|login|401|403|42501/i.test(msg) || code === '42501') {
      return {
        code: 'AUTH_EXPIRED',
        title: 'Authentication session expired',
        message: 'Your security token has expired or permissions were denied.',
        suggestion: 'Please sign out and sign back in to renew your cloud session.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    if (/fetch|network|timeout|Failed to fetch|NetworkError/i.test(msg)) {
      return {
        code: 'SERVER_UNREACHABLE',
        title: 'Cloud server unreachable',
        message: 'Unable to establish a connection with the database endpoint within timeout limit.',
        suggestion: 'Check if your network or firewall allows requests to your Supabase instance. Retrying automatically.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    if (/duplicate key|unique constraint|23505/i.test(msg)) {
      return {
        code: 'CONCURRENCY_RETRY',
        title: 'Concurrent write in progress',
        message: 'Another sync batch was processed simultaneously.',
        suggestion: 'The sync engine will deduplicate and reconcile on the next heartbeat.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    if (/PGRST202|Could not find the function public\.sync_keeper_changes/i.test(msg) || code === 'PGRST202') {
      return {
        code: 'PGRST202',
        title: 'CDC Sync Migration Required on Server',
        message: 'The function "sync_keeper_changes" has not been deployed to your Supabase project yet.',
        suggestion: 'Run the migration SQL (20261125240000_offline_sync_engine.sql) in your Supabase SQL Editor to enable incremental CDC sync.',
        timestamp: now,
        attempt: this.retryAttempt,
      };
    }

    return {
      code: code ? String(code) : 'SYNC_ERROR',
      title: 'Cloud sync encountered an issue',
      message: msg.slice(0, 300) || 'An unexpected error occurred during change transmission.',
      suggestion: 'Click “Retry sync” or check your connection. All local edits are securely saved in this browser.',
      timestamp: now,
      attempt: this.retryAttempt,
    };
  }

  public async sync(): Promise<void> {
    if (!this.cloudBackupEnabled) {
      this.status = 'paused';
      this.notifyState();
      return;
    }

    if (!this.session?.user.id || !supabase) {
      this.status = 'offline';
      this.errorDetails = this.parseError(new Error('User not signed in'));
      await this.refreshPendingCount();
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
      this.errorDetails = this.parseError(new Error('Device is offline'));
      this.notifyState();
      return;
    }

    if (this.isSyncing) {
      this.hasPendingWork = true;
      return;
    }

    this.isSyncing = true;
    this.status = 'syncing';
    this.notifyState();

    try {
      const outbox = await getOutboxMutations();
      this.pendingCount = outbox.length;

      // Push pending mutations and pull incremental changes in a single atomic RPC
      const payload = {
        p_device_id: this.deviceId,
        p_last_seq: this.serverSeq,
        p_mutations: outbox,
      };

      const { data, error } = await supabase.rpc('sync_keeper_changes', payload);

      if (error) {
        // If the new CDC incremental RPC is not yet created on the Supabase backend:
        // Gracefully fall back to standard document synchronization so the user is never blocked!
        if (error.code === 'PGRST202' || /public\.sync_keeper_changes/i.test(error.message || '')) {
          await this.fallbackDocumentSync(outbox);
          return;
        }
        throw error;
      }

      const result = data as SyncResult;

      // 1. Remove acknowledged mutations from outbox
      if (result.appliedIds && result.appliedIds.length > 0) {
        await removeOutboxMutations(result.appliedIds);
      }

      // 2. Process incoming server state (incremental changes or bootstrap snapshot)
      if (result.snapshot && this.getCurrentDocument) {
        const remainingOutbox = await getOutboxMutations();
        const rebased = rebaseDocument(result.snapshot, remainingOutbox);
        this.notifyDocument(rebased);
      } else if (result.changes && result.changes.length > 0 && this.getCurrentDocument) {
        const currentDoc = this.getCurrentDocument();
        const remainingOutbox = await getOutboxMutations();
        const merged = mergeRemoteChanges(currentDoc, result.changes, remainingOutbox);
        this.notifyDocument(merged);
      }

      // 3. Update sequence and timestamp
      if (typeof result.latestSeq === 'number') {
        this.serverSeq = result.latestSeq;
        setLastServerSeq(this.serverSeq);
      }

      const now = new Date().toISOString();
      this.lastSyncedAt = now;
      setLastSyncedAt(now);

      this.retryAttempt = 0;
      this.lastError = null;
      this.errorDetails = null;
      await this.refreshPendingCount();

      this.status = 'synced';
      this.notifyState();
    } catch (err: any) {
      const isNetwork = !navigator.onLine || /fetch|network|timeout/i.test(err?.message || '');
      this.status = isNetwork ? 'offline' : 'error';
      this.lastError = err?.message || 'Sync failed';
      this.errorDetails = this.parseError(err);
      this.notifyState();

      // Exponential backoff retry
      this.retryAttempt++;
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, Math.min(this.retryAttempt, 5)));
      if (this.retryTimeout) window.clearTimeout(this.retryTimeout);
      this.retryTimeout = window.setTimeout(() => {
        void this.sync();
      }, backoffMs);
    } finally {
      this.isSyncing = false;
      if (this.hasPendingWork) {
        this.hasPendingWork = false;
        this.scheduleSync(50);
      }
    }
  }

  private async fallbackDocumentSync(outbox: Mutation[]): Promise<void> {
    if (!this.getCurrentDocument || !this.session?.user.id) return;
    const userId = this.session.user.id;
    const currentDoc = this.getCurrentDocument();

    try {
      const remote = await readRemoteDocument(userId);

      if (outbox.length > 0 || !remote) {
        try {
          await writeRemoteDocument(userId, currentDoc, remote?.revision ?? null);
        } catch {
          const latest = await readRemoteDocument(userId);
          if (latest) {
            await writeRemoteDocument(userId, currentDoc, latest.revision);
          }
        }
      } else if (remote?.document) {
        this.notifyDocument(remote.document);
      }

      if (outbox.length > 0) {
        await removeOutboxMutations(outbox.map(m => m.id));
      }

      const now = new Date().toISOString();
      this.lastSyncedAt = now;
      setLastSyncedAt(now);
      this.retryAttempt = 0;
      this.lastError = null;
      this.errorDetails = {
        code: 'PGRST202_COMPAT_MODE',
        title: 'Compatibility Sync Mode Active',
        message: 'Cloud sync succeeded using document mode. The advanced RPC "sync_keeper_changes" is not yet deployed to your Supabase project.',
        suggestion: 'To enable full Change Data Capture (CDC) and multi-device incremental sync, execute the SQL migration in your Supabase SQL Editor.',
        timestamp: now,
      };

      await this.refreshPendingCount();
      this.status = 'synced';
      this.notifyState();
    } catch (fallbackErr: any) {
      this.status = 'error';
      this.lastError = fallbackErr?.message || 'Fallback sync failed';
      this.errorDetails = this.parseError(fallbackErr);
      this.notifyState();
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    if (this.syncTimeout) window.clearTimeout(this.syncTimeout);
    if (this.retryTimeout) window.clearTimeout(this.retryTimeout);
    if (this.realtimeChannel && supabase) {
      void supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

// Singleton sync engine instance for the app
export const syncEngine = new SyncEngine();
