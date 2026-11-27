-- Global configuration is public-readable but must only be changed through
-- the admin-site-config Edge Function, which verifies the admin session.
drop policy if exists "Authenticated users can update site config"
  on public.keeper_site_config;

revoke all on table public.keeper_site_config from public, anon, authenticated;
grant select on table public.keeper_site_config to anon, authenticated;

alter table public.keeper_site_config
  add constraint keeper_site_config_global_id check (id = 'global'),
  add constraint keeper_site_config_allowed_fonts_array
    check (jsonb_typeof(allowed_fonts) = 'array' and jsonb_array_length(allowed_fonts) between 1 and 50),
  add constraint keeper_site_config_accent_palette_array
    check (jsonb_typeof(accent_palette) = 'array' and jsonb_array_length(accent_palette) between 1 and 50);
