import { FONT_SIZES, type FontSize } from '../../components/FontSelector';
import { readLocalSiteConfig } from '../../admin/siteConfig';

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
  accent: '#a8b5ff',
  background: 'solid',
  color1: '#08090b',
  color2: '#242832',
  image: '',
  wallpaperUrls: [],
  font: 'Roboto',
  size: 16,
};

export const getSiteDefaultPreferences = (): Preferences => {
  const siteConfig = readLocalSiteConfig();
  return {
    ...defaultPreferences,
    accent: siteConfig.defaultAccent || defaultPreferences.accent,
    background: siteConfig.defaultBackground || defaultPreferences.background,
    color1: siteConfig.defaultColor1 || defaultPreferences.color1,
    color2: siteConfig.defaultColor2 || defaultPreferences.color2,
    image: siteConfig.defaultImage || defaultPreferences.image,
    font: siteConfig.defaultFont || defaultPreferences.font,
    size: siteConfig.defaultFontSize || defaultPreferences.size,
  };
};

export const readPreferences = (): Preferences => {
  const baseDefaults = getSiteDefaultPreferences();
  const allowedFonts = getAllowedFonts();
  try {
    const saved = JSON.parse(localStorage.getItem('keeper-preferences') || '{}');
    const color = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
    const size: FontSize = FONT_SIZES.some((option) => option.value === saved.size)
      ? saved.size
      : saved.size === 'small'
        ? 14
        : saved.size === 'large'
          ? 20
          : baseDefaults.size;
    const wallpaperUrls = Array.isArray(saved.wallpaperUrls)
      ? saved.wallpaperUrls
          .filter(
            (url: unknown): url is string =>
              typeof url === 'string' && url.length <= 2048 && /^https:\/\//i.test(url)
          )
          .slice(0, 25)
      : [];
    return {
      ...baseDefaults,
      accent: color(saved.accent) ? saved.accent : baseDefaults.accent,
      color1: color(saved.color1) ? saved.color1 : baseDefaults.color1,
      color2: color(saved.color2) ? saved.color2 : baseDefaults.color2,
      background: ['solid', 'gradient', 'image'].includes(saved.background)
        ? saved.background
        : baseDefaults.background,
      image:
        typeof saved.image === 'string' &&
        saved.image.length <= 2048 &&
        /^https:\/\//i.test(saved.image)
          ? saved.image
          : baseDefaults.image,
      wallpaperUrls,
      font: allowedFonts.includes(saved.font) ? saved.font : baseDefaults.font,
      size,
    };
  } catch {
    return baseDefaults;
  }
};

export function getAllowedFonts(): string[] {
  try {
    const siteConfig = readLocalSiteConfig();
    if (Array.isArray(siteConfig.allowedFonts) && siteConfig.allowedFonts.length) {
      return siteConfig.allowedFonts;
    }
  } catch {
    // fallback
  }
  return [...FONT_OPTIONS];
}

export const FONT_OPTIONS = [
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
] as const;
