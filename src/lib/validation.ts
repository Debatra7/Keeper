import type { Collection, Site } from '../features/collections/types';
import { FONT_OPTIONS, type Preferences } from '../features/settings/preferences';
import { FONT_SIZES, type FontSize } from '../components/FontSelector';
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
const normalizeFontSize = (value: unknown): FontSize => {
  // Accept numeric strings returned by the database (SQL ->> returns text).
  const coerced = typeof value === 'string' ? Number(value) : value;
  if (FONT_SIZES.some(option => option.value === coerced)) return coerced as FontSize;
  if (value === 'small') return 14;
  if (value === 'large') return 20;
  if (typeof coerced === 'number' && coerced >= 10 && coerced <= 24) return FONT_SIZES.reduce((closest, option) => Math.abs(option.value - coerced) < Math.abs(closest - coerced) ? option.value : closest, 16 as FontSize);
  return 16;
};

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

function validFontSize(value: unknown): boolean {
  // Accept both numeric values and numeric strings (from DB text columns).
  const coerced = typeof value === 'string' ? Number(value) : value;
  return value === undefined || value === null || [14, 16, 20, 24].includes(coerced as number);
}

function validCollection(value: unknown): value is Collection {
  return record(value) && text(value.id, 100) && text(value.name, 200) && (value.color === '' || color(value.color)) && validFont(value.font) && validFont(value.nameFont) && validFont(value.cardFont) && validFontSize(value.titleFontSize) && validFontSize(value.cardFontSize) && Array.isArray(value.sites) && value.sites.length <= 500 && value.sites.every(validSite);
}

function validPreferences(value: unknown): value is Preferences {
  if (!record(value)) return false;
  const imageOk = value.image === '' || typeof value.image === 'string' && value.image.length <= 2048 && /^https:\/\//i.test(value.image);
  const imagePathOk = value.imagePath === undefined || value.imagePath === '' || typeof value.imagePath === 'string' && value.imagePath.length <= 300 && !value.imagePath.startsWith('/') && !value.imagePath.includes('..');
  // Accept numeric strings for size (database returns text columns as strings).
  const sizeNum = typeof value.size === 'string' ? Number(value.size) : value.size;
  const wallpaperUrlsOk = Array.isArray(value.wallpaperUrls) && value.wallpaperUrls.length <= 25 && value.wallpaperUrls.every(url => typeof url === 'string' && url.length <= 2048 && /^https:\/\//i.test(url));
  return color(value.accent) && ['solid', 'gradient', 'image'].includes(String(value.background)) && color(value.color1) && color(value.color2) && imageOk && imagePathOk && wallpaperUrlsOk && FONT_OPTIONS.includes(value.font as typeof FONT_OPTIONS[number]) && (FONT_SIZES.some(size => size.value === sizeNum) || ['small', 'medium', 'large'].includes(String(value.size)));
}

function validProfile(value: unknown): value is UserProfile {
  return record(value) && text(value.name, 200) && (value.email === undefined || text(value.email, 254)) && (value.hideEmail === undefined || typeof value.hideEmail === 'boolean') && (value.avatarPath === undefined || value.avatarPath === null || typeof value.avatarPath === 'string' && text(value.avatarPath, 300) && !value.avatarPath.startsWith('/') && !value.avatarPath.includes('..'));
}

function validWidget(value: unknown): value is DashboardWidget {
  return record(value) && text(value.id, 100) && ['clock', 'calendar'].includes(String(value.type)) && ['x', 'y', 'width', 'height'].every(key => value[key] === undefined || typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key] as number) <= 5000);
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
  if (!record(value)) return null;

  // Coerce font size fields that may arrive as strings from the database (SQL ->> operator returns text).
  const rawCollections = Array.isArray(value.collections)
    ? value.collections.map((col: unknown) => {
        if (!record(col)) return col;
        return {
          ...col,
          titleFontSize: col.titleFontSize == null ? undefined : normalizeFontSize(col.titleFontSize),
          cardFontSize:  col.cardFontSize  == null ? undefined : normalizeFontSize(col.cardFontSize),
        };
      })
    : value.collections;

  if (!Array.isArray(rawCollections) || !rawCollections.every(validCollection)) return null;

  // Coerce preferences.size from string to number if needed.
  const rawPreferences = record(value.preferences)
    ? { ...value.preferences, image: typeof value.preferences.image === 'string' && /^https:\/\//i.test(value.preferences.image) && value.preferences.image.length <= 2048 ? value.preferences.image : '', wallpaperUrls: (Array.isArray(value.wallpaperUrls) ? value.wallpaperUrls : Array.isArray(value.preferences.wallpaperUrls) ? value.preferences.wallpaperUrls : []).filter((url): url is string => typeof url === 'string' && url.length <= 2048 && /^https:\/\//i.test(url)).slice(0, 25), size: normalizeFontSize(value.preferences.size) }
    : value.preferences;

  const rawCheckpoints = Array.isArray(value.checkpoints)
    ? value.checkpoints.map((checkpoint: unknown) => {
        if (!record(checkpoint)) return checkpoint;
        const checkpointPreferences = record(checkpoint.preferences)
          ? { ...checkpoint.preferences, image: typeof checkpoint.preferences.image === 'string' && /^https:\/\//i.test(checkpoint.preferences.image) && checkpoint.preferences.image.length <= 2048 ? checkpoint.preferences.image : '', size: normalizeFontSize(checkpoint.preferences.size) }
          : checkpoint.preferences;
        const checkpointCollections = Array.isArray(checkpoint.collections)
          ? checkpoint.collections.map((collection: unknown) => {
              if (!record(collection)) return collection;
              return {
                ...collection,
                titleFontSize: collection.titleFontSize == null ? undefined : normalizeFontSize(collection.titleFontSize),
                cardFontSize: collection.cardFontSize == null ? undefined : normalizeFontSize(collection.cardFontSize),
              };
            })
          : checkpoint.collections;
        const checkpointProfile = record(checkpoint.profile) && checkpoint.profile.avatarPath === null
          ? { ...checkpoint.profile, avatarPath: undefined }
          : checkpoint.profile;
        return { ...checkpoint, preferences: checkpointPreferences, collections: checkpointCollections, profile: checkpointProfile };
      })
    : value.checkpoints;

  const position = record(value.searchPosition) ? value.searchPosition : {};
  const document = {
    collections: rawCollections.map(collection => ({
      ...collection,
      sites: collection.sites.map((site: Site) => ({ ...site, url: safeWebsiteUrl(site.url)! })),
    })),
    preferences: rawPreferences,
    profile: record(value.profile) && value.profile.avatarPath === null
      ? { ...value.profile, avatarPath: undefined }
      : value.profile,
    widgets: value.widgets ?? [],
    checkpoints: rawCheckpoints ?? [],
    searchPosition: {
      x: typeof position.x === 'number' && Number.isFinite(position.x) && Math.abs(position.x) <= 5000 ? position.x : 0,
      y: typeof position.y === 'number' && Number.isFinite(position.y) && Math.abs(position.y) <= 5000 ? position.y : 0,
    },
  };
  return isKeeperDocument(document) ? document : null;
}
