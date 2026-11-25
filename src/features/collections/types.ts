export type Site = { id: string; name: string; url: string };
export type Collection = { id: string; name: string; color: string; font?: string; nameFont?: string | null; cardFont?: string | null; sites: Site[] };
