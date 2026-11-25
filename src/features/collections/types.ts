import type { FontSize } from '../../components/FontSelector';

export type Site = { id: string; name: string; url: string };
export type Collection = { id: string; name: string; color: string; font?: string; nameFont?: string | null; titleFontSize?: FontSize; cardFont?: string | null; cardFontSize?: FontSize; sites: Site[] };
