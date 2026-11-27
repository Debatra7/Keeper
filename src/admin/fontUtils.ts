const STATIC_INDEX_FONTS = new Set([
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
]);

export interface ParsedGoogleFont {
  family: string;
  stylesheetUrl: string;
}

/**
 * Extracts a Google Font family name and CSS2 stylesheet URL from a Google Fonts link
 * (e.g. https://fonts.google.com/specimen/Agrave+Pro or a css2?family=... URL).
 */
export function parseGoogleFontLink(rawInput: string): ParsedGoogleFont | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^fonts\.google(apis)?\.com\//i.test(trimmed)
      ? `https://${trimmed}`
      : '';

  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  if (host === 'fonts.google.com') {
    const specimenMatch = url.pathname.match(/\/specimen\/([^/]+)/i);
    if (specimenMatch?.[1]) {
      const family = decodeFontName(specimenMatch[1]);
      if (!family) return null;
      return {
        family,
        stylesheetUrl: buildGoogleFontCssUrl(family),
      };
    }

    const selectionFamily = url.searchParams.get('selection.family');
    if (selectionFamily) {
      const firstFamily = selectionFamily.split('|')[0]?.split(':')[0] ?? '';
      const family = decodeFontName(firstFamily);
      if (!family) return null;
      return {
        family,
        stylesheetUrl: buildGoogleFontCssUrl(family),
      };
    }

    return null;
  }

  if (host === 'fonts.googleapis.com') {
    const familyParam = url.searchParams.get('family');
    if (!familyParam) return null;
    const rawFamily = familyParam.split(':')[0] ?? '';
    const family = decodeFontName(rawFamily);
    if (!family) return null;
    return {
      family,
      stylesheetUrl: buildGoogleFontCssUrl(family),
    };
  }

  return null;
}

function decodeFontName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim().replace(/\s+/g, ' ');
  } catch {
    return raw.replace(/\+/g, ' ').trim().replace(/\s+/g, ' ');
  }
}

export function buildGoogleFontCssUrl(family: string): string {
  const encoded = encodeURIComponent(family).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
}

/**
 * Ensures any non-built-in fonts in the list have a Google Fonts <link> in document.head.
 */
export function syncGoogleFontsToDocument(fonts: readonly string[]): void {
  if (typeof document === 'undefined') return;

  const desired = new Set(
    fonts
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && !STATIC_INDEX_FONTS.has(f))
  );

  const existingLinks = document.head.querySelectorAll<HTMLLinkElement>('link[data-keeper-font]');
  const existingMap = new Map<string, HTMLLinkElement>();

  existingLinks.forEach((link) => {
    const fontName = link.getAttribute('data-keeper-font');
    if (!fontName || !desired.has(fontName)) {
      link.remove();
    } else {
      existingMap.set(fontName, link);
    }
  });

  desired.forEach((fontName) => {
    if (existingMap.has(fontName)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = buildGoogleFontCssUrl(fontName);
    link.setAttribute('data-keeper-font', fontName);
    document.head.appendChild(link);
  });
}
