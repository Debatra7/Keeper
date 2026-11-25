import { FONT_SIZES, type FontSize } from '../../components/FontSelector';

export type Preferences = {
  accent: string;
  background: 'solid' | 'gradient' | 'image';
  color1: string;
  color2: string;
  image: string;
  imagePath?: string;
  wallpaperUrls: string[];
  font: string;
  size: FontSize;
};

export const defaultPreferences: Preferences = {
  accent: '#a8b5ff', background: 'solid', color1: '#08090b', color2: '#242832',
  image: '', wallpaperUrls: [], font: 'Roboto', size: 16,
};

export const readPreferences = (): Preferences => {
  try { const saved = JSON.parse(localStorage.getItem('keeper-preferences') || '{}'); const color = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value); const size: FontSize = FONT_SIZES.some(option => option.value === saved.size) ? saved.size : saved.size === 'small' ? 14 : saved.size === 'large' ? 20 : 16; const wallpaperUrls = Array.isArray(saved.wallpaperUrls) ? saved.wallpaperUrls.filter((url: unknown): url is string => typeof url === 'string' && url.length <= 2048 && /^https:\/\//i.test(url)).slice(0, 25) : []; return { ...defaultPreferences, accent: color(saved.accent) ? saved.accent : defaultPreferences.accent, color1: color(saved.color1) ? saved.color1 : defaultPreferences.color1, color2: color(saved.color2) ? saved.color2 : defaultPreferences.color2, background: ['solid','gradient','image'].includes(saved.background) ? saved.background : 'solid', image: typeof saved.image === 'string' && saved.image.length <= 2048 && /^https:\/\//i.test(saved.image) ? saved.image : '', wallpaperUrls, font: FONT_OPTIONS.includes(saved.font) ? saved.font : 'Roboto', size }; }
  catch { return defaultPreferences; }
};

export const FONT_OPTIONS = ['Roboto', 'Roboto Slab', 'Merriweather', 'Playfair Display', 'Black Ops One', 'Anton', 'Zeyada', 'PT Serif', 'Dancing Script', 'Caveat', 'Changa One', 'Bitter', 'Orbitron', 'Pacifico'] as const;
