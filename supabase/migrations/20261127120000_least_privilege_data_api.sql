-- Require explicit grants for future public API objects.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Keep implementation functions outside the exposed Data API schema.
alter function public.sync_keeper_changes(text, bigint, jsonb) set schema keeper_private;
alter function keeper_private.sync_keeper_changes(text, bigint, jsonb)
  rename to sync_keeper_changes_impl;
alter function public.clear_keeper_data(jsonb) set schema keeper_private;
alter function keeper_private.clear_keeper_data(jsonb) rename to clear_keeper_data_impl;
alter function public.replace_keeper_document(jsonb, bigint) set schema keeper_private;
alter function keeper_private.replace_keeper_document(jsonb, bigint)
  rename to replace_keeper_document_impl;
alter function public.update_keeper_feature_data(text, jsonb) set schema keeper_private;
alter function keeper_private.update_keeper_feature_data(text, jsonb)
  rename to update_keeper_feature_data_impl;
alter function public.reset_keeper_feature_data(text) set schema keeper_private;
alter function keeper_private.reset_keeper_feature_data(text)
  rename to reset_keeper_feature_data_impl;

revoke all on all functions in schema keeper_private from public, anon, authenticated, service_role;

-- Public RPC wrappers retain the existing API while running the implementation
-- with the function owner's privileges. Each implementation scopes writes to
-- auth.uid(); the empty search path prevents object-shadowing attacks.
create function public.sync_keeper_changes(
  p_device_id text,
  p_last_seq bigint default 0,
  p_mutations jsonb default '[]'::jsonb
) returns jsonb
language sql security definer set search_path = '' as $$
  select keeper_private.sync_keeper_changes_impl(p_device_id, p_last_seq, p_mutations)
$$;

create function public.clear_keeper_data(p_checkpoints jsonb) returns bigint
language sql security definer set search_path = '' as $$
  select keeper_private.clear_keeper_data_impl(p_checkpoints)
$$;

create function public.replace_keeper_document(p_document jsonb, p_revision bigint default null)
returns bigint language sql security definer set search_path = '' as $$
  select keeper_private.replace_keeper_document_impl(p_document, p_revision)
$$;

create function public.update_keeper_feature_data(p_feature_key text, p_patch jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select keeper_private.update_keeper_feature_data_impl(p_feature_key, p_patch)
$$;

create function public.reset_keeper_feature_data(p_feature_key text)
returns void language sql security definer set search_path = '' as $$
  select keeper_private.reset_keeper_feature_data_impl(p_feature_key)
$$;

-- Authenticated clients read only their own rows through RLS and realtime;
-- all writes go through the scoped RPCs above.
revoke all on table public.keeper_sync_state, public.keeper_profiles,
  public.keeper_preferences, public.keeper_collections, public.keeper_sites,
  public.keeper_widgets, public.keeper_checkpoints, public.keeper_change_log,
  public.keeper_feature_data, public.keeper_site_config
  from public, anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.keeper_sync_state, public.keeper_profiles, public.keeper_preferences,
  public.keeper_collections, public.keeper_sites, public.keeper_widgets,
  public.keeper_checkpoints, public.keeper_change_log, public.keeper_feature_data
  from authenticated;

grant select on table public.keeper_sync_state, public.keeper_profiles,
  public.keeper_preferences, public.keeper_collections, public.keeper_sites,
  public.keeper_widgets, public.keeper_checkpoints, public.keeper_change_log,
  public.keeper_feature_data, public.keeper_site_config
  to authenticated;
grant select on table public.keeper_site_config to anon;

revoke all on all sequences in schema public from public, anon, authenticated;

-- Profile storage keys match the avatar_path constraint; delete is required by
-- the account-data wipe flow.
drop policy if exists "Users can view their profile picture" on storage.objects;
drop policy if exists "Users can upload their profile picture" on storage.objects;
drop policy if exists "Users can update their profile picture" on storage.objects;
drop policy if exists "Users can delete their profile picture" on storage.objects;

create policy "Users can view their profile picture"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-pictures'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );
create policy "Users can upload their profile picture"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );
create policy "Users can update their profile picture"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-pictures'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  )
  with check (
    bucket_id = 'profile-pictures'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );
create policy "Users can delete their profile picture"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-pictures'
    and name in (
      (select auth.uid())::text || '/avatar.jpg',
      (select auth.uid())::text || '/avatar.png',
      (select auth.uid())::text || '/avatar.webp'
    )
  );

-- Remove default PUBLIC/anon execution and grant the app RPCs only to signed-in
-- users and the trusted service role.
revoke all on all functions in schema public from public, anon, authenticated, service_role;
grant execute on function public.clear_keeper_data(jsonb) to authenticated, service_role;
grant execute on function public.get_keeper_document() to authenticated, service_role;
grant execute on function public.get_keeper_feature_data(text) to authenticated, service_role;
grant execute on function public.replace_keeper_document(jsonb, bigint) to authenticated, service_role;
grant execute on function public.reset_keeper_feature_data(text) to authenticated, service_role;
grant execute on function public.sync_keeper_changes(text, bigint, jsonb) to authenticated, service_role;
grant execute on function public.update_keeper_feature_data(text, jsonb) to authenticated, service_role;
