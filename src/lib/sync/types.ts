import type { KeeperDocument } from '../validation';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'paused' | 'error';

export type EntityType =
  | 'collection'
  | 'site'
  | 'widget'
  | 'preferences'
  | 'profile'
  | 'checkpoint'
  | 'search_position';

export type MutationOp = 'insert' | 'update' | 'delete' | 'patch';

export interface Mutation<T = any> {
  id: string;              // Client-generated unique UUID
  deviceId: string;        // Client device identifier
  entityType: EntityType;
  entityId: string;
  op: MutationOp;
  data: T;
  clientTime: string;      // ISO 8601 string
  baseVersion?: number;    // Server sequence or revision when mutation originated
}

export interface RemoteChange {
  seq: number;
  deviceId: string;
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  op: MutationOp;
  data: any;
  clientTime: string;
  serverTime: string;
}

export interface SyncResult {
  latestSeq: number;
  appliedIds: string[];
  changes: RemoteChange[];
  snapshot: KeeperDocument | null;
}

export interface SyncErrorDetails {
  code?: string;
  title: string;
  message: string;
  suggestion: string;
  timestamp: string;
  attempt?: number;
}

export interface SyncEngineState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  errorDetails: SyncErrorDetails | null;
  deviceId: string;
  serverSeq: number;
  cloudBackupEnabled: boolean;
  automatedSyncEnabled: boolean;
  isOnline: boolean;
}
