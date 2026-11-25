import type { Collection, Site } from '../../features/collections/types';
import type { DashboardWidget } from '../../features/dashboard/DashboardWidgets';
import type { DataBackup } from '../../features/settings/SettingsPanel';
import type { KeeperDocument } from '../validation';
import type { Mutation, RemoteChange } from './types';
import { safeWebsiteUrl } from '../validation';

/**
 * Apply a single mutation to a KeeperDocument in-memory (optimistic update or rebase)
 */
export function applyMutationToDocument(doc: KeeperDocument, mutation: Mutation): KeeperDocument {
  const { entityType, entityId, op, data } = mutation;

  switch (entityType) {
    case 'collection': {
      if (op === 'delete') {
        return {
          ...doc,
          collections: doc.collections.filter(c => c.id !== entityId),
        };
      }
      if (op === 'insert') {
        const existingIndex = doc.collections.findIndex(c => c.id === entityId);
        const newCollection: Collection = {
          id: entityId,
          name: data?.name ?? 'Untitled',
          color: data?.color ?? '',
          font: data?.font,
          nameFont: data?.nameFont,
          cardFont: data?.cardFont,
          titleFontSize: data?.titleFontSize,
          cardFontSize: data?.cardFontSize,
          sites: Array.isArray(data?.sites) ? data.sites : [],
        };
        if (existingIndex >= 0) {
          const next = [...doc.collections];
          next[existingIndex] = {
            ...next[existingIndex],
            ...newCollection,
            sites: next[existingIndex].sites.length ? next[existingIndex].sites : newCollection.sites,
          };
          return { ...doc, collections: next };
        }
        return {
          ...doc,
          collections: [...doc.collections, newCollection],
        };
      }
      if (op === 'update' || op === 'patch') {
        return {
          ...doc,
          collections: doc.collections.map(c => {
            if (c.id !== entityId) return c;
            return {
              ...c,
              ...(data?.name !== undefined && { name: data.name }),
              ...(data?.color !== undefined && { color: data.color }),
              ...(data?.font !== undefined && { font: data.font }),
              ...(data?.nameFont !== undefined && { nameFont: data.nameFont }),
              ...(data?.cardFont !== undefined && { cardFont: data.cardFont }),
              ...(data?.titleFontSize !== undefined && { titleFontSize: data.titleFontSize }),
              ...(data?.cardFontSize !== undefined && { cardFontSize: data.cardFontSize }),
            };
          }),
        };
      }
      return doc;
    }

    case 'site': {
      const siteUrl = safeWebsiteUrl(data?.url);
      if (op === 'delete') {
        return {
          ...doc,
          collections: doc.collections.map(c => ({
            ...c,
            sites: c.sites.filter(s => s.id !== entityId),
          })),
        };
      }
      if (op === 'insert') {
        const collectionId = data?.collectionId;
        const newSite: Site = {
          id: entityId,
          name: data?.name ?? '',
          url: siteUrl ?? data?.url ?? '',
        };
        return {
          ...doc,
          collections: doc.collections.map(c => {
            if (c.id !== collectionId) {
              // Ensure deduplication if moved
              return { ...c, sites: c.sites.filter(s => s.id !== entityId) };
            }
            const exists = c.sites.some(s => s.id === entityId);
            if (exists) {
              return {
                ...c,
                sites: c.sites.map(s => (s.id === entityId ? { ...s, ...newSite } : s)),
              };
            }
            const sortOrder = data?.sortOrder;
            if (typeof sortOrder === 'number' && sortOrder >= 0 && sortOrder <= c.sites.length) {
              const nextSites = [...c.sites];
              nextSites.splice(sortOrder, 0, newSite);
              return { ...c, sites: nextSites };
            }
            return { ...c, sites: [...c.sites, newSite] };
          }),
        };
      }
      if (op === 'update' || op === 'patch') {
        const targetCollectionId = data?.collectionId;
        return {
          ...doc,
          collections: doc.collections.map(c => {
            const hasSite = c.sites.some(s => s.id === entityId);
            if (targetCollectionId && c.id !== targetCollectionId) {
              // If site moved out of this collection
              return hasSite ? { ...c, sites: c.sites.filter(s => s.id !== entityId) } : c;
            }
            if (targetCollectionId && c.id === targetCollectionId && !hasSite) {
              // Site moved into this collection
              const currentSite = doc.collections
                .flatMap(col => col.sites)
                .find(s => s.id === entityId) ?? { id: entityId, name: data?.name ?? '', url: siteUrl ?? '' };
              const updatedSite: Site = {
                ...currentSite,
                ...(data?.name !== undefined && { name: data.name }),
                ...(data?.url !== undefined && siteUrl && { url: siteUrl }),
              };
              return { ...c, sites: [...c.sites, updatedSite] };
            }
            if (hasSite) {
              return {
                ...c,
                sites: c.sites.map(s => {
                  if (s.id !== entityId) return s;
                  return {
                    ...s,
                    ...(data?.name !== undefined && { name: data.name }),
                    ...(data?.url !== undefined && siteUrl && { url: siteUrl }),
                  };
                }),
              };
            }
            return c;
          }),
        };
      }
      return doc;
    }

    case 'widget': {
      if (op === 'delete') {
        return {
          ...doc,
          widgets: doc.widgets.filter(w => w.id !== entityId),
        };
      }
      if (op === 'insert') {
        const newWidget: DashboardWidget = {
          id: entityId,
          type: data?.type ?? 'clock',
          x: data?.x ?? 0,
          y: data?.y ?? 0,
          width: data?.width ?? 180,
          height: data?.height ?? 130,
        };
        const exists = doc.widgets.some(w => w.id === entityId);
        return {
          ...doc,
          widgets: exists
            ? doc.widgets.map(w => (w.id === entityId ? { ...w, ...newWidget } : w))
            : [...doc.widgets, newWidget],
        };
      }
      if (op === 'update' || op === 'patch') {
        return {
          ...doc,
          widgets: doc.widgets.map(w => {
            if (w.id !== entityId) return w;
            return {
              ...w,
              ...(data?.type !== undefined && { type: data.type }),
              ...(data?.x !== undefined && { x: data.x }),
              ...(data?.y !== undefined && { y: data.y }),
              ...(data?.width !== undefined && { width: data.width }),
              ...(data?.height !== undefined && { height: data.height }),
            };
          }),
        };
      }
      return doc;
    }

    case 'preferences': {
      return {
        ...doc,
        preferences: {
          ...doc.preferences,
          ...(data?.accent !== undefined && { accent: data.accent }),
          ...(data?.background !== undefined && { background: data.background }),
          ...(data?.color1 !== undefined && { color1: data.color1 }),
          ...(data?.color2 !== undefined && { color2: data.color2 }),
          ...(data?.image !== undefined && { image: data.image }),
          ...(data?.imagePath !== undefined && { imagePath: data.imagePath }),
          ...(data?.wallpaperUrls !== undefined && { wallpaperUrls: data.wallpaperUrls }),
          ...(data?.font !== undefined && { font: data.font }),
          ...(data?.size !== undefined && { size: data.size }),
        },
        ...(data?.searchPosition !== undefined && { searchPosition: data.searchPosition }),
      };
    }

    case 'search_position': {
      return {
        ...doc,
        searchPosition: {
          x: typeof data?.x === 'number' ? data.x : doc.searchPosition.x,
          y: typeof data?.y === 'number' ? data.y : doc.searchPosition.y,
        },
      };
    }

    case 'profile': {
      return {
        ...doc,
        profile: {
          ...doc.profile,
          ...(data?.name !== undefined && { name: data.name }),
          ...(data?.hideEmail !== undefined && { hideEmail: data.hideEmail }),
          ...(data?.avatarPath !== undefined && { avatarPath: data.avatarPath }),
        },
      };
    }

    case 'checkpoint': {
      if (op === 'delete') {
        return {
          ...doc,
          checkpoints: doc.checkpoints.filter(cp => cp.exportedAt !== entityId),
        };
      }
      if (op === 'insert') {
        const newCp = data as DataBackup;
        if (!newCp || !newCp.exportedAt) return doc;
        const merged = [...doc.checkpoints.filter(cp => cp.exportedAt !== newCp.exportedAt), newCp]
          .sort((a, b) => Date.parse(a.exportedAt) - Date.parse(b.exportedAt))
          .slice(-5);
        return { ...doc, checkpoints: merged };
      }
      return doc;
    }

    default:
      return doc;
  }
}

/**
 * Rebase: Applies base document plus all pending mutations sequentially
 */
export function rebaseDocument(base: KeeperDocument, pendingMutations: Mutation[]): KeeperDocument {
  let result = base;
  for (const mutation of pendingMutations) {
    result = applyMutationToDocument(result, mutation);
  }
  return result;
}

/**
 * Merge remote changes received from other devices into local state with conflict resolution.
 */
export function mergeRemoteChanges(
  currentDoc: KeeperDocument,
  remoteChanges: RemoteChange[],
  pendingMutations: Mutation[]
): KeeperDocument {
  if (!remoteChanges.length) return currentDoc;

  // Set of entity keys currently modified in the pending outbox
  const pendingEntities = new Map<string, Mutation>();
  for (const m of pendingMutations) {
    pendingEntities.set(`${m.entityType}:${m.entityId}`, m);
  }

  let merged = currentDoc;

  for (const change of remoteChanges) {
    const key = `${change.entityType}:${change.entityId}`;
    const pending = pendingEntities.get(key);

    // If there is no local pending mutation on this entity, apply remote change cleanly
    if (!pending) {
      merged = applyMutationToDocument(merged, {
        id: change.mutationId,
        deviceId: change.deviceId,
        entityType: change.entityType,
        entityId: change.entityId,
        op: change.op,
        data: change.data,
        clientTime: change.clientTime,
      });
      continue;
    }

    // Conflict Resolution:
    // Both local and remote modified the same entity concurrently!
    // We resolve based on entity type and field granularity.

    if (change.entityType === 'preferences' || change.entityType === 'profile') {
      // Field-level 3-way merge:
      // Merge remote fields into base, then local pending fields override where conflict occurs
      merged = applyMutationToDocument(merged, {
        id: change.mutationId,
        deviceId: change.deviceId,
        entityType: change.entityType,
        entityId: change.entityId,
        op: change.op,
        data: change.data,
        clientTime: change.clientTime,
      });
      // Re-apply local pending mutation fields on top (optimistic local preference)
      merged = applyMutationToDocument(merged, pending);
      continue;
    }

    // For collections & sites & widgets:
    // If one side deleted, deletion takes precedence (tombstone)
    if (change.op === 'delete' || pending.op === 'delete') {
      merged = applyMutationToDocument(merged, {
        id: change.mutationId,
        deviceId: change.deviceId,
        entityType: change.entityType,
        entityId: change.entityId,
        op: 'delete',
        data: null,
        clientTime: change.clientTime,
      });
      continue;
    }

    // Deterministic Last-Write-Wins (LWW) based on timestamp comparison
    const remoteTime = Date.parse(change.clientTime || change.serverTime);
    const localTime = Date.parse(pending.clientTime);

    if (remoteTime > localTime) {
      // Remote is newer: apply remote
      merged = applyMutationToDocument(merged, {
        id: change.mutationId,
        deviceId: change.deviceId,
        entityType: change.entityType,
        entityId: change.entityId,
        op: change.op,
        data: change.data,
        clientTime: change.clientTime,
      });
    } else {
      // Local is newer or tie: preserve local optimistic update
      merged = applyMutationToDocument(merged, pending);
    }
  }

  return merged;
}
