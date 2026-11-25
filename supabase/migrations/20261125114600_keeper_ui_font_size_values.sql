-- The client stores font sizes as numeric values; keep legacy labels readable too.
alter table public.keeper_preferences
  drop constraint if exists keeper_preferences_ui_size_check;

alter table public.keeper_preferences
  add constraint keeper_preferences_ui_size_check
  check (ui_size in ('small', 'medium', 'large', '14', '16', '20', '24'));
