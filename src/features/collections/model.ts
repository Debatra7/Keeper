import type { Collection } from './types';
import { normalizeDocument, safeWebsiteUrl } from '../../lib/validation';

const starterCollections: Collection[] = [
  { id: 'work', name: 'Work', color: '#a6b6ff', sites: [{ id: '1', name: 'Linear', url: 'linear.app' }, { id: '2', name: 'Figma', url: 'figma.com' }, { id: '3', name: 'Notion', url: 'notion.so' }, { id: '4', name: 'GitHub', url: 'github.com' }, { id: '5', name: 'Vercel', url: 'vercel.com' }] },
  { id: 'inspiration', name: 'Inspiration', color: '#f2b98c', sites: [{ id: '6', name: 'Are.na', url: 'are.na' }, { id: '7', name: 'Pinterest', url: 'pinterest.com' }, { id: '8', name: 'Dribbble', url: 'dribbble.com' }] },
  { id: 'daily', name: 'Daily', color: '#9dd2bd', sites: [{ id: '9', name: 'YouTube', url: 'youtube.com' }, { id: '10', name: 'Spotify', url: 'open.spotify.com' }, { id: '11', name: 'The New York Times', url: 'nytimes.com' }] },
];

export const createId = () => Math.random().toString(36).slice(2, 10);

export const domainOf = (raw: string) => {
  return safeWebsiteUrl(raw) ?? '';
};

export const faviconFor = (url: string) => `https://www.google.com/s2/favicons?domain=${domainOf(url)}&sz=64`;

export const readCollections = (): Collection[] => {
  try {
    const saved = localStorage.getItem('keeper-data');
    if (!saved) return starterCollections;
    const document = normalizeDocument({ collections: JSON.parse(saved), preferences: { accent: '#000000', background: 'solid', color1: '#000000', color2: '#000000', image: '', font: 'Roboto', size: 16 }, profile: { name: '' }, widgets: [], checkpoints: [] });
    return document?.collections ?? starterCollections;
  } catch { return starterCollections; }
};
