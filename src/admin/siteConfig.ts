import { supabase } from '../lib/supabase';
import { type DeveloperSiteConfig, INITIAL_SITE_CONFIG } from './types';

const STORAGE_KEY = 'keeper_developer_site_config';

export function readLocalSiteConfig(): DeveloperSiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_SITE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_SITE_CONFIG,
      ...parsed,
      defaultImage: typeof parsed.defaultImage === 'string' ? parsed.defaultImage : '',
      allowedFonts:
        Array.isArray(parsed.allowedFonts) && parsed.allowedFonts.length
          ? parsed.allowedFonts
          : INITIAL_SITE_CONFIG.allowedFonts,
      accentPalette:
        Array.isArray(parsed.accentPalette) && parsed.accentPalette.length
          ? parsed.accentPalette
          : INITIAL_SITE_CONFIG.accentPalette,
    };
  } catch {
    return INITIAL_SITE_CONFIG;
  }
}

export function saveLocalSiteConfig(config: DeveloperSiteConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('keeper:site-config-updated', { detail: config }));
  } catch (err) {
    console.error('Failed to save local site config:', err);
  }
}

export async function fetchRemoteSiteConfig(): Promise<DeveloperSiteConfig | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('keeper_site_config')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (error || !data) return null;

    return {
      faviconUrl: data.favicon_url || '',
      siteTitle: data.site_title || INITIAL_SITE_CONFIG.siteTitle,
      defaultAccent: data.default_accent || INITIAL_SITE_CONFIG.defaultAccent,
      defaultBackground: data.default_background || INITIAL_SITE_CONFIG.defaultBackground,
      defaultColor1: data.default_color1 || INITIAL_SITE_CONFIG.defaultColor1,
      defaultColor2: data.default_color2 || INITIAL_SITE_CONFIG.defaultColor2,
      defaultImage: data.default_image || '',
      defaultFont: data.default_font || INITIAL_SITE_CONFIG.defaultFont,
      defaultFontSize: data.default_font_size || INITIAL_SITE_CONFIG.defaultFontSize,
      allowedFonts: Array.isArray(data.allowed_fonts)
        ? data.allowed_fonts
        : INITIAL_SITE_CONFIG.allowedFonts,
      accentPalette: Array.isArray(data.accent_palette)
        ? data.accent_palette
        : INITIAL_SITE_CONFIG.accentPalette,
    };
  } catch (err) {
    console.warn('Could not fetch remote site config:', err);
    return null;
  }
}

export async function saveRemoteSiteConfig(config: DeveloperSiteConfig): Promise<boolean> {
  saveLocalSiteConfig(config);
  if (!supabase) return true;
  try {
    const { error } = await supabase.from('keeper_site_config').upsert({
      id: 'global',
      favicon_url: config.faviconUrl || null,
      site_title: config.siteTitle,
      default_accent: config.defaultAccent,
      default_background: config.defaultBackground,
      default_color1: config.defaultColor1,
      default_color2: config.defaultColor2,
      default_image: config.defaultImage || null,
      default_font: config.defaultFont,
      default_font_size: config.defaultFontSize,
      allowed_fonts: config.allowedFonts,
      accent_palette: config.accentPalette,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to sync site config to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error updating remote site config:', err);
    return false;
  }
}

export function applySiteConfigToDocument(config: DeveloperSiteConfig) {
  if (config.siteTitle) {
    document.title = config.siteTitle;
  }
  if (config.faviconUrl) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = config.faviconUrl;
  }
}
