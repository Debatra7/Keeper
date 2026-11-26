import type { FontSize } from '../components/FontSelector';

export interface DeveloperSiteConfig {
  faviconUrl: string;
  siteTitle: string;
  defaultAccent: string;
  defaultBackground: 'solid' | 'gradient' | 'image';
  defaultColor1: string;
  defaultColor2: string;
  defaultImage: string;
  defaultFont: string;
  defaultFontSize: FontSize;
  allowedFonts: string[];
  accentPalette: string[];
}

export const INITIAL_SITE_CONFIG: DeveloperSiteConfig = {
  faviconUrl: '',
  siteTitle: 'Keeper',
  defaultAccent: '#a8b5ff',
  defaultBackground: 'solid',
  defaultColor1: '#08090b',
  defaultColor2: '#242832',
  defaultImage: '',
  defaultFont: 'Roboto',
  defaultFontSize: 16,
  allowedFonts: [
    'Roboto',
    'Roboto Slab',
    'Merriweather',
    'Playfair Display',
    'Black Ops One',
    'Anton',
    'Zeyada',
    'PT Serif',
    'Dancing Script',
    'Caveat',
    'Changa One',
    'Bitter',
    'Orbitron',
    'Pacifico',
  ],
  accentPalette: [
    '#a8b5ff',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#ec4899',
    '#8b5cf6',
    '#ef4444',
    '#14b8a6',
  ],
};
