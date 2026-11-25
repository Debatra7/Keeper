import type { Collection, Site } from '../features/collections/types';
import { FONT_OPTIONS, type Preferences } from '../features/settings/preferences';
import type { DataBackup, UserProfile } from '../features/settings/SettingsPanel';
import type { DashboardWidget } from '../features/dashboard/DashboardWidgets';

export type KeeperDocument = {
  collections: Collection[];
  preferences: Preferences;
  profile: UserProfile;
  widgets: DashboardWidget[];
  checkpoints: DataBackup[];
  searchPosition: { x: number; y: number };
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const color = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const validFont = (value: unknown) => value === undefined || value === null || FONT_OPTIONS.includes(value as typeof FONT_OPTIONS[number]);

export function safeWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !text(value, 2048) || !value.trim() || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password ? url.hostname.replace(/^www\./i, '') + url.pathname.replace(/\/$/, '') + url.search + url.hash : null;
  } catch { return null; }
}

function validSite(value: unknown): value is Site {
  return record(value) && text(value.id, 100) && text(value.name, 200) && safeWebsiteUrl(value.url) !== null;
}

function validCollection(value: unknown): value is Collection {
  return record(value) && text(value.id, 100) && text(value.name, 200) && (value.color === '' || color(value.color)) && validFont(value.font) && validFont(value.nameFont) && validFont(value.cardFont) && Array.isArray(value.sites) && value.sites.length <= 500 && value.sites.every(validSite);
}

function validPreferences(value: unknown): value is Preferences {
  if (!record(value)) return false;
  const imageOk = value.image === '' || typeof value.image === 'string' && value.image.length <= 2_100_000 && (/^https:\/\//i.test(value.image) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/]+=*$/i.test(value.image));
  return color(value.accent) && ['solid', 'gradient', 'image'].includes(String(value.background)) && color(value.color1) && color(value.color2) && imageOk && FONT_OPTIONS.includes(value.font as typeof FONT_OPTIONS[number]) && ['small', 'medium', 'large'].includes(String(value.size));
}

function validProfile(value: unknown): value is UserProfile {
  return record(value) && text(value.name, 200) && (value.email === undefined || text(value.email, 254)) && (value.hideEmail === undefined || typeof value.hideEmail === 'boolean') && (value.avatarPath === undefined || typeof value.avatarPath === 'string' && text(value.avatarPath, 300) && !value.avatarPath.startsWith('/') && !value.avatarPath.includes('..'));
}

function validWidget(value: unknown): value is DashboardWidget {
  return record(value) && text(value.id, 100) && ['clock', 'calendar'].includes(String(value.type)) && ['x', 'y', 'width', 'height'].every(key => value[key] === undefined || typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key]) <= 5000);
}

export function isBackup(value: unknown): value is DataBackup {
  const position = record(value) && record(value.searchPosition) ? value.searchPosition : null;
  return record(value) && value.version === 1 && typeof value.exportedAt === 'string' && text(value.exportedAt, 40) && !Number.isNaN(Date.parse(value.exportedAt)) && Array.isArray(value.collections) && value.collections.length <= 100 && value.collections.every(validCollection) && validPreferences(value.preferences) && validProfile(value.profile) && (value.widgets === undefined || Array.isArray(value.widgets) && value.widgets.length <= 20 && value.widgets.every(validWidget)) && (value.searchPosition === undefined || !!position && ['x', 'y'].every(key => typeof position[key] === 'number' && Number.isFinite(position[key]) && Math.abs(position[key] as number) <= 5000));
}

export function isKeeperDocument(value: unknown): value is KeeperDocument {
  const searchPosition = record(value) && record(value.searchPosition) ? value.searchPosition : undefined;
  return record(value) && Array.isArray(value.collections) && value.collections.length <= 100 && value.collections.every(validCollection) && validPreferences(value.preferences) && validProfile(value.profile) && Array.isArray(value.widgets) && value.widgets.length <= 20 && value.widgets.every(validWidget) && Array.isArray(value.checkpoints) && value.checkpoints.length <= 5 && value.checkpoints.every(isBackup) && !!searchPosition && ['x', 'y'].every(key => typeof searchPosition[key] === 'number' && Number.isFinite(searchPosition[key]) && Math.abs(searchPosition[key]) <= 5000);
}

export function normalizeDocument(value: unknown): KeeperDocument | null {
  if (!record(value) || !Array.isArray(value.collections) || !value.collections.every(validCollection)) return null;
  const position = record(value.searchPosition) ? value.searchPosition : {};
  const document = {
    collections: value.collections.map(collection => ({ ...collection, sites: collection.sites.map(site => ({ ...site, url: safeWebsiteUrl(site.url)! })) })),
    preferences: value.preferences,
    profile: value.profile,
    widgets: value.widgets ?? [],
    checkpoints: value.checkpoints ?? [],
    searchPosition: { x: typeof position.x === 'number' && Number.isFinite(position.x) && Math.abs(position.x) <= 5000 ? position.x : 0, y: typeof position.y === 'number' && Number.isFinite(position.y) && Math.abs(position.y) <= 5000 ? position.y : 0 },
  };
  return isKeeperDocument(document) ? document : null;
}

