-- Developer / Global Site Configuration
-- Allows admins to configure site-wide defaults: favicon, default looks (accent, background, colors, font, default wallpaper image),
-- selectable color palette options in settings, and selectable font options in settings.

CREATE TABLE IF NOT EXISTS public.keeper_site_config (
    id TEXT PRIMARY KEY DEFAULT 'global',
    favicon_url TEXT,
    site_title TEXT NOT NULL DEFAULT 'Keeper',
    default_accent TEXT NOT NULL DEFAULT '#a8b5ff',
    default_background TEXT NOT NULL DEFAULT 'solid' CHECK (default_background IN ('solid', 'gradient', 'image')),
    default_color1 TEXT NOT NULL DEFAULT '#08090b',
    default_color2 TEXT NOT NULL DEFAULT '#242832',
    default_image TEXT,
    default_font TEXT NOT NULL DEFAULT 'Roboto',
    default_font_size SMALLINT NOT NULL DEFAULT 16 CHECK (default_font_size IN (14, 16, 20, 24)),
    allowed_fonts JSONB NOT NULL DEFAULT '["Roboto", "Roboto Slab", "Merriweather", "Playfair Display", "Black Ops One", "Anton", "Zeyada", "PT Serif", "Dancing Script", "Caveat", "Changa One", "Bitter", "Orbitron", "Pacifico"]'::jsonb,
    accent_palette JSONB NOT NULL DEFAULT '["#a8b5ff", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure column exists if table was previously created
ALTER TABLE public.keeper_site_config ADD COLUMN IF NOT EXISTS default_image TEXT;

ALTER TABLE public.keeper_site_config ENABLE ROW LEVEL SECURITY;

-- Allow all users (including anonymous visitors) to read global site configuration
DROP POLICY IF EXISTS "Public can view site config" ON public.keeper_site_config;
CREATE POLICY "Public can view site config"
    ON public.keeper_site_config
    FOR SELECT
    USING (true);

-- Allow authenticated users or admin functions to update site config
DROP POLICY IF EXISTS "Authenticated users can update site config" ON public.keeper_site_config;
CREATE POLICY "Authenticated users can update site config"
    ON public.keeper_site_config
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert initial default record if absent
INSERT INTO public.keeper_site_config (
    id,
    favicon_url,
    site_title,
    default_accent,
    default_background,
    default_color1,
    default_color2,
    default_image,
    default_font,
    default_font_size,
    allowed_fonts,
    accent_palette
) VALUES (
    'global',
    NULL,
    'Keeper',
    '#a8b5ff',
    'solid',
    '#08090b',
    '#242832',
    NULL,
    'Roboto',
    16,
    '["Roboto", "Roboto Slab", "Merriweather", "Playfair Display", "Black Ops One", "Anton", "Zeyada", "PT Serif", "Dancing Script", "Caveat", "Changa One", "Bitter", "Orbitron", "Pacifico"]'::jsonb,
    '["#a8b5ff", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"]'::jsonb
) ON CONFLICT (id) DO NOTHING;
