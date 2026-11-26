import type { Collection } from './types';
import { normalizeDocument, safeWebsiteUrl } from '../../lib/validation';

export const createId = () => Math.random().toString(36).slice(2, 10);

export const domainOf = (raw: string) => {
  return safeWebsiteUrl(raw) ?? '';
};

export const faviconFor = (url: string) => `https://www.google.com/s2/favicons?domain=${domainOf(url)}&sz=64`;

export const readCollections = (): Collection[] => {
  try {
    const saved = localStorage.getItem('keeper-data');
    if (saved === null) return [{ id: createId(), name: 'Favorites', color: '', sites: [] }];
    const document = normalizeDocument({ collections: JSON.parse(saved), preferences: { accent: '#000000', background: 'solid', color1: '#000000', color2: '#000000', image: '', font: 'Roboto', size: 16 }, profile: { name: '' }, widgets: [], checkpoints: [] });
    return document?.collections ?? [];
  } catch { return []; }
};
