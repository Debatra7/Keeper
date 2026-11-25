export type Preferences = {
  accent: string;
  background: 'solid' | 'gradient' | 'image';
  color1: string;
  color2: string;
  image: string;
  font: string;
  size: 'small' | 'medium' | 'large';
};

export const defaultPreferences: Preferences = {
  accent: '#a8b5ff', background: 'solid', color1: '#08090b', color2: '#242832',
  image: '', font: 'Roboto', size: 'medium',
};

export const readPreferences = (): Preferences => {
  try { const saved = JSON.parse(localStorage.getItem('keeper-preferences') || '{}'); const color = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value); return { ...defaultPreferences, accent: color(saved.accent) ? saved.accent : defaultPreferences.accent, color1: color(saved.color1) ? saved.color1 : defaultPreferences.color1, color2: color(saved.color2) ? saved.color2 : defaultPreferences.color2, background: ['solid','gradient','image'].includes(saved.background) ? saved.background : 'solid', image: typeof saved.image === 'string' && saved.image.length <= 2_100_000 && (/^https:\/\//i.test(saved.image) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/]+=*$/i.test(saved.image)) ? saved.image : '', font: FONT_OPTIONS.includes(saved.font) ? saved.font : 'Roboto', size: ['small','medium','large'].includes(saved.size) ? saved.size : 'medium' } as Preferences; }
  catch { return defaultPreferences; }
};

export const FONT_OPTIONS = ['Roboto', 'Roboto Slab', 'Merriweather', 'Playfair Display', 'Black Ops One', 'Anton', 'Zeyada', 'PT Serif', 'Dancing Script', 'Caveat', 'Changa One', 'Bitter', 'Orbitron', 'Pacifico'] as const;
