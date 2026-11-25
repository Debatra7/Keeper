import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMutationToDocument, rebaseDocument, mergeRemoteChanges } from './conflictResolver';
import type { KeeperDocument } from '../validation';
import type { Mutation, RemoteChange } from './types';

const initialDoc: KeeperDocument = {
  collections: [
    {
      id: 'col_1',
      name: 'Work',
      color: '#ff0000',
      sites: [
        { id: 'site_1', name: 'GitHub', url: 'github.com' },
        { id: 'site_2', name: 'Slack', url: 'slack.com' },
      ],
    },
    {
      id: 'col_2',
      name: 'Personal',
      color: '#00ff00',
      sites: [],
    },
  ],
  preferences: {
    accent: '#a8b5ff',
    background: 'solid',
    color1: '#08090b',
    color2: '#242832',
    image: '',
    wallpaperUrls: [],
    font: 'Roboto',
    size: 16,
  },
  profile: {
    name: 'Alice',
    email: 'alice@example.com',
  },
  widgets: [
    { id: 'w_1', type: 'clock', x: 0, y: 0, width: 180, height: 130 },
  ],
  checkpoints: [],
  searchPosition: { x: 0, y: 0 },
};

test('CDC / Optimistic: collection insert and update applies correctly', () => {
  const insertMutation: Mutation = {
    id: 'm1',
    deviceId: 'dev_1',
    entityType: 'collection',
    entityId: 'col_3',
    op: 'insert',
    data: { name: 'Reading', color: '#0000ff', sites: [] },
    clientTime: new Date('2026-01-01T10:00:00Z').toISOString(),
  };

  const doc1 = applyMutationToDocument(initialDoc, insertMutation);
  assert.equal(doc1.collections.length, 3);
  assert.equal(doc1.collections[2].name, 'Reading');
  assert.equal(doc1.collections[2].color, '#0000ff');

  const updateMutation: Mutation = {
    id: 'm2',
    deviceId: 'dev_1',
    entityType: 'collection',
    entityId: 'col_3',
    op: 'update',
    data: { name: 'Reading & Books' },
    clientTime: new Date('2026-01-01T10:05:00Z').toISOString(),
  };

  const doc2 = applyMutationToDocument(doc1, updateMutation);
  assert.equal(doc2.collections[2].name, 'Reading & Books');
  assert.equal(doc2.collections[2].color, '#0000ff'); // preserved
});

test('CDC / Optimistic: site operations (insert, reorder, delete)', () => {
  const addSite: Mutation = {
    id: 'm3',
    deviceId: 'dev_1',
    entityType: 'site',
    entityId: 'site_3',
    op: 'insert',
    data: { name: 'Linear', url: 'linear.app', collectionId: 'col_1' },
    clientTime: new Date('2026-01-01T10:00:00Z').toISOString(),
  };

  const doc1 = applyMutationToDocument(initialDoc, addSite);
  const col1 = doc1.collections.find(c => c.id === 'col_1');
  assert.equal(col1?.sites.length, 3);
  assert.equal(col1?.sites[2].name, 'Linear');

  const deleteSite: Mutation = {
    id: 'm4',
    deviceId: 'dev_1',
    entityType: 'site',
    entityId: 'site_1',
    op: 'delete',
    data: null,
    clientTime: new Date('2026-01-01T10:02:00Z').toISOString(),
  };

  const doc2 = applyMutationToDocument(doc1, deleteSite);
  const col2 = doc2.collections.find(c => c.id === 'col_1');
  assert.equal(col2?.sites.length, 2);
  assert.ok(!col2?.sites.some(s => s.id === 'site_1'));
});

test('Cross-Collection Move: moving site between collections', () => {
  const moveMutation: Mutation = {
    id: 'm_move',
    deviceId: 'dev_1',
    entityType: 'site',
    entityId: 'site_1',
    op: 'update',
    data: { collectionId: 'col_2' },
    clientTime: new Date('2026-01-01T10:10:00Z').toISOString(),
  };

  const movedDoc = applyMutationToDocument(initialDoc, moveMutation);
  const col1 = movedDoc.collections.find(c => c.id === 'col_1');
  const col2 = movedDoc.collections.find(c => c.id === 'col_2');

  assert.ok(!col1?.sites.some(s => s.id === 'site_1'));
  assert.ok(col2?.sites.some(s => s.id === 'site_1'));
  assert.equal(col2?.sites.find(s => s.id === 'site_1')?.name, 'GitHub');
});

test('Optimistic Rebase: pending mutations replayed on top of updated base', () => {
  const pending: Mutation[] = [
    {
      id: 'm_pending_1',
      deviceId: 'dev_1',
      entityType: 'preferences',
      entityId: 'user_preferences',
      op: 'update',
      data: { accent: '#ff00aa' },
      clientTime: new Date('2026-01-01T11:00:00Z').toISOString(),
    },
    {
      id: 'm_pending_2',
      deviceId: 'dev_1',
      entityType: 'widget',
      entityId: 'w_2',
      op: 'insert',
      data: { type: 'calendar', x: 250, y: 0, width: 228, height: 230 },
      clientTime: new Date('2026-01-01T11:01:00Z').toISOString(),
    },
  ];

  // Server bootstrap comes in with new collection from another device
  const updatedBase: KeeperDocument = {
    ...initialDoc,
    collections: [
      ...initialDoc.collections,
      { id: 'col_remote', name: 'Remote Project', color: '#123456', sites: [] },
    ],
  };

  const rebased = rebaseDocument(updatedBase, pending);
  // Contains remote collection
  assert.ok(rebased.collections.some(c => c.id === 'col_remote'));
  // Replays pending local mutations cleanly
  assert.equal(rebased.preferences.accent, '#ff00aa');
  assert.equal(rebased.widgets.length, 2);
  assert.ok(rebased.widgets.some(w => w.id === 'w_2'));
});

test('Conflict Resolution: multi-device editing different entities has zero conflict', () => {
  // Device 1 modified collection 'col_1' name offline
  const pendingMutations: Mutation[] = [
    {
      id: 'd1_m1',
      deviceId: 'dev_1',
      entityType: 'collection',
      entityId: 'col_1',
      op: 'update',
      data: { name: 'Work Updated by Dev1' },
      clientTime: new Date('2026-01-01T10:00:00Z').toISOString(),
    },
  ];

  // Device 2 added a widget and changed preferences font
  const remoteChanges: RemoteChange[] = [
    {
      seq: 10,
      deviceId: 'dev_2',
      mutationId: 'd2_m1',
      entityType: 'widget',
      entityId: 'w_remote',
      op: 'insert',
      data: { type: 'calendar', x: 100, y: 100, width: 228, height: 230 },
      clientTime: new Date('2026-01-01T10:05:00Z').toISOString(),
      serverTime: new Date('2026-01-01T10:05:01Z').toISOString(),
    },
    {
      seq: 11,
      deviceId: 'dev_2',
      mutationId: 'd2_m2',
      entityType: 'preferences',
      entityId: 'user_preferences',
      op: 'update',
      data: { font: 'Merriweather' },
      clientTime: new Date('2026-01-01T10:06:00Z').toISOString(),
      serverTime: new Date('2026-01-01T10:06:01Z').toISOString(),
    },
  ];

  const merged = mergeRemoteChanges(initialDoc, remoteChanges, pendingMutations);
  // Device 2 changes incorporated
  assert.ok(merged.widgets.some(w => w.id === 'w_remote'));
  assert.equal(merged.preferences.font, 'Merriweather');
  // Device 1 pending change preserved
  const finalDoc = rebaseDocument(merged, pendingMutations);
  assert.equal(finalDoc.collections.find(c => c.id === 'col_1')?.name, 'Work Updated by Dev1');
  assert.equal(finalDoc.preferences.font, 'Merriweather');
  assert.ok(finalDoc.widgets.some(w => w.id === 'w_remote'));
});

test('Conflict Resolution: field-level merge for preferences (3-way merge)', () => {
  // Dev 1 changed accent color
  const pending: Mutation[] = [
    {
      id: 'p1',
      deviceId: 'dev_1',
      entityType: 'preferences',
      entityId: 'user_preferences',
      op: 'update',
      data: { accent: '#ff5500' },
      clientTime: new Date('2026-01-01T12:00:00Z').toISOString(),
    },
  ];

  // Dev 2 concurrently changed font and background
  const remote: RemoteChange[] = [
    {
      seq: 20,
      deviceId: 'dev_2',
      mutationId: 'r1',
      entityType: 'preferences',
      entityId: 'user_preferences',
      op: 'update',
      data: { font: 'Pacifico', background: 'gradient' },
      clientTime: new Date('2026-01-01T12:01:00Z').toISOString(),
      serverTime: new Date('2026-01-01T12:01:01Z').toISOString(),
    },
  ];

  const merged = mergeRemoteChanges(initialDoc, remote, pending);
  // Both Dev 1's accent and Dev 2's font/background are preserved!
  assert.equal(merged.preferences.accent, '#ff5500');
  assert.equal(merged.preferences.font, 'Pacifico');
  assert.equal(merged.preferences.background, 'gradient');
});

test('Conflict Resolution: Last-Write-Wins (LWW) on exact same field conflict', () => {
  // Dev 1 renamed collection at 12:00
  const pending: Mutation[] = [
    {
      id: 'p_lww',
      deviceId: 'dev_1',
      entityType: 'collection',
      entityId: 'col_1',
      op: 'update',
      data: { name: 'Name From Dev 1 (Earlier)' },
      clientTime: new Date('2026-01-01T12:00:00Z').toISOString(),
    },
  ];

  // Dev 2 renamed same collection at 12:05 (newer)
  const remote: RemoteChange[] = [
    {
      seq: 30,
      deviceId: 'dev_2',
      mutationId: 'r_lww',
      entityType: 'collection',
      entityId: 'col_1',
      op: 'update',
      data: { name: 'Name From Dev 2 (Later)' },
      clientTime: new Date('2026-01-01T12:05:00Z').toISOString(),
      serverTime: new Date('2026-01-01T12:05:01Z').toISOString(),
    },
  ];

  const merged = mergeRemoteChanges(initialDoc, remote, pending);
  // Remote is newer, so it wins
  assert.equal(merged.collections.find(c => c.id === 'col_1')?.name, 'Name From Dev 2 (Later)');
});

test('Conflict Resolution: Remote delete wins over local update (tombstone)', () => {
  const pending: Mutation[] = [
    {
      id: 'p_del',
      deviceId: 'dev_1',
      entityType: 'collection',
      entityId: 'col_1',
      op: 'update',
      data: { name: 'Local update' },
      clientTime: new Date('2026-01-01T12:00:00Z').toISOString(),
    },
  ];

  const remote: RemoteChange[] = [
    {
      seq: 40,
      deviceId: 'dev_2',
      mutationId: 'r_del',
      entityType: 'collection',
      entityId: 'col_1',
      op: 'delete',
      data: null,
      clientTime: new Date('2026-01-01T12:01:00Z').toISOString(),
      serverTime: new Date('2026-01-01T12:01:01Z').toISOString(),
    },
  ];

  const merged = mergeRemoteChanges(initialDoc, remote, pending);
  assert.ok(!merged.collections.some(c => c.id === 'col_1'));
});

test('Checkpoints: merge maintains top 5 sorted chronologically', () => {
  let doc = initialDoc;
  for (let i = 1; i <= 7; i++) {
    const cp = {
      version: 1 as const,
      exportedAt: new Date(`2026-01-0${i}T10:00:00Z`).toISOString(),
      collections: [],
      preferences: initialDoc.preferences,
      profile: initialDoc.profile,
    };
    doc = applyMutationToDocument(doc, {
      id: `cp_mut_${i}`,
      deviceId: 'dev_1',
      entityType: 'checkpoint',
      entityId: cp.exportedAt,
      op: 'insert',
      data: cp,
      clientTime: cp.exportedAt,
    });
  }

  // Capped at 5
  assert.equal(doc.checkpoints.length, 5);
  // Oldest kept is day 3
  assert.equal(doc.checkpoints[0].exportedAt, new Date('2026-01-03T10:00:00Z').toISOString());
  // Newest kept is day 7
  assert.equal(doc.checkpoints[4].exportedAt, new Date('2026-01-07T10:00:00Z').toISOString());
});
