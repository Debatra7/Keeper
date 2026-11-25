-- Migration: 20261125240000_offline_sync_engine.sql
-- Implements Change Data Capture (CDC), outbox sync, optimistic concurrency, and incremental synchronization.

-- 1. Ensure keeper_sync_state has a seq tracker
alter table public.keeper_sync_state add column if not exists seq bigint not null default 0 check (seq >= 0);

-- 2. Create the Change Data Capture (CDC) change log table
create table if not exists public.keeper_change_log (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 128),
  mutation_id text not null check (char_length(mutation_id) between 1 and 128),
  entity_type text not null check (entity_type in ('collection', 'site', 'widget', 'preferences', 'profile', 'checkpoint', 'search_position', 'batch')),
  entity_id text not null check (char_length(entity_id) between 1 and 128),
  op text not null check (op in ('insert', 'update', 'delete', 'patch')),
  data jsonb not null default '{}'::jsonb,
  client_time timestamptz not null default clock_timestamp(),
  server_time timestamptz not null default clock_timestamp()
);

-- Indexes for lightning-fast incremental pull and deduplication
create index if not exists keeper_change_log_user_seq_idx on public.keeper_change_log(user_id, seq);
create unique index if not exists keeper_change_log_user_mutation_idx on public.keeper_change_log(user_id, mutation_id);

-- Enable Row Level Security (RLS)
alter table public.keeper_change_log enable row level security;
grant select, insert, delete on public.keeper_change_log to authenticated;

drop policy if exists keeper_change_log_owner on public.keeper_change_log;
create policy keeper_change_log_owner on public.keeper_change_log
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Realtime notification replica identity
alter table public.keeper_change_log replica identity full;

-- Make sure publication includes sync state and change log for multi-device realtime notifications
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'keeper_change_log'
  ) then
    alter publication supabase_realtime add table public.keeper_change_log;
  end if;
end $$;

-- 3. Core RPC: sync_keeper_changes
-- Handles batch mutations with idempotency, optimistic concurrency, conflict resolution, CDC logging, and incremental pulls
create or replace function public.sync_keeper_changes(
  p_device_id text,
  p_last_seq bigint default 0,
  p_mutations jsonb default '[]'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  current_seq bigint;
  latest_seq bigint;
  applied_ids jsonb := '[]'::jsonb;
  changes jsonb := '[]'::jsonb;
  snapshot jsonb := null;
  m jsonb;
  m_id text;
  m_type text;
  m_entity_id text;
  m_op text;
  m_data jsonb;
  m_client_time timestamptz;
  mutations_count integer;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Ensure sync state exists and lock row for atomic user sync
  insert into public.keeper_sync_state (user_id, revision, seq)
  values (uid, 1, 0)
  on conflict (user_id) do nothing;

  select seq into current_seq
  from public.keeper_sync_state
  where user_id = uid
  for update;

  -- Process incoming mutations
  if jsonb_typeof(p_mutations) = 'array' then
    mutations_count := jsonb_array_length(p_mutations);
    for m in select value from jsonb_array_elements(p_mutations) loop
      m_id := m->>'id';
      m_type := m->>'entityType';
      m_entity_id := m->>'entityId';
      m_op := m->>'op';
      m_data := coalesce(m->'data', '{}'::jsonb);
      m_client_time := coalesce((m->>'clientTime')::timestamptz, clock_timestamp());

      if m_id is null or m_type is null or m_entity_id is null or m_op is null then
        continue;
      end if;

      -- Idempotency check: if mutation already recorded, acknowledge and skip re-applying
      if exists (select 1 from public.keeper_change_log where user_id = uid and mutation_id = m_id) then
        applied_ids := applied_ids || jsonb_build_array(m_id);
        continue;
      end if;

      -- Apply mutation to normalized entity tables with optimistic conflict handling
      if m_type = 'collection' then
        if m_op in ('insert', 'update', 'patch') then
          insert into public.keeper_collections (
            user_id, id, name, color, font_family, name_font_family,
            card_font_family, title_font_size, card_font_size, sort_order, updated_at
          ) values (
            uid,
            m_entity_id,
            coalesce(m_data->>'name', 'Untitled'),
            coalesce(m_data->>'color', ''),
            nullif(m_data->>'font', 'null'),
            nullif(m_data->>'nameFont', 'null'),
            nullif(m_data->>'cardFont', 'null'),
            nullif(m_data->>'titleFontSize', '')::integer,
            nullif(m_data->>'cardFontSize', '')::integer,
            coalesce((m_data->>'sortOrder')::integer, 0),
            clock_timestamp()
          )
          on conflict (user_id, id) do update set
            name = case when m_data ? 'name' then coalesce(m_data->>'name', keeper_collections.name) else keeper_collections.name end,
            color = case when m_data ? 'color' then coalesce(m_data->>'color', keeper_collections.color) else keeper_collections.color end,
            font_family = case when m_data ? 'font' then nullif(m_data->>'font', 'null') else keeper_collections.font_family end,
            name_font_family = case when m_data ? 'nameFont' then nullif(m_data->>'nameFont', 'null') else keeper_collections.name_font_family end,
            card_font_family = case when m_data ? 'cardFont' then nullif(m_data->>'cardFont', 'null') else keeper_collections.card_font_family end,
            title_font_size = case when m_data ? 'titleFontSize' then nullif(m_data->>'titleFontSize', '')::integer else keeper_collections.title_font_size end,
            card_font_size = case when m_data ? 'cardFontSize' then nullif(m_data->>'cardFontSize', '')::integer else keeper_collections.card_font_size end,
            sort_order = case when m_data ? 'sortOrder' then coalesce((m_data->>'sortOrder')::integer, keeper_collections.sort_order) else keeper_collections.sort_order end,
            updated_at = clock_timestamp();
        elsif m_op = 'delete' then
          delete from public.keeper_sites where user_id = uid and collection_id = m_entity_id;
          delete from public.keeper_collections where user_id = uid and id = m_entity_id;
        end if;

      elsif m_type = 'site' then
        if m_op in ('insert', 'update', 'patch') then
          insert into public.keeper_sites (
            user_id, id, collection_id, name, url, sort_order, updated_at
          ) values (
            uid,
            m_entity_id,
            coalesce(m_data->>'collectionId', ''),
            coalesce(m_data->>'name', ''),
            coalesce(m_data->>'url', ''),
            coalesce((m_data->>'sortOrder')::integer, 0),
            clock_timestamp()
          )
          on conflict (user_id, id) do update set
            collection_id = case when m_data ? 'collectionId' then coalesce(m_data->>'collectionId', keeper_sites.collection_id) else keeper_sites.collection_id end,
            name = case when m_data ? 'name' then coalesce(m_data->>'name', keeper_sites.name) else keeper_sites.name end,
            url = case when m_data ? 'url' then coalesce(m_data->>'url', keeper_sites.url) else keeper_sites.url end,
            sort_order = case when m_data ? 'sortOrder' then coalesce((m_data->>'sortOrder')::integer, keeper_sites.sort_order) else keeper_sites.sort_order end,
            updated_at = clock_timestamp();
        elsif m_op = 'delete' then
          delete from public.keeper_sites where user_id = uid and id = m_entity_id;
        end if;

      elsif m_type = 'widget' then
        if m_op in ('insert', 'update', 'patch') then
          insert into public.keeper_widgets (
            user_id, id, widget_type, x, y, width, height, sort_order, updated_at
          ) values (
            uid,
            m_entity_id,
            coalesce(m_data->>'type', 'clock'),
            coalesce((m_data->>'x')::double precision, 0),
            coalesce((m_data->>'y')::double precision, 0),
            coalesce((m_data->>'width')::double precision, 180),
            coalesce((m_data->>'height')::double precision, 130),
            coalesce((m_data->>'sortOrder')::integer, 0),
            clock_timestamp()
          )
          on conflict (user_id, id) do update set
            widget_type = case when m_data ? 'type' then coalesce(m_data->>'type', keeper_widgets.widget_type) else keeper_widgets.widget_type end,
            x = case when m_data ? 'x' then coalesce((m_data->>'x')::double precision, keeper_widgets.x) else keeper_widgets.x end,
            y = case when m_data ? 'y' then coalesce((m_data->>'y')::double precision, keeper_widgets.y) else keeper_widgets.y end,
            width = case when m_data ? 'width' then coalesce((m_data->>'width')::double precision, keeper_widgets.width) else keeper_widgets.width end,
            height = case when m_data ? 'height' then coalesce((m_data->>'height')::double precision, keeper_widgets.height) else keeper_widgets.height end,
            sort_order = case when m_data ? 'sortOrder' then coalesce((m_data->>'sortOrder')::integer, keeper_widgets.sort_order) else keeper_widgets.sort_order end,
            updated_at = clock_timestamp();
        elsif m_op = 'delete' then
          delete from public.keeper_widgets where user_id = uid and id = m_entity_id;
        end if;

      elsif m_type = 'preferences' then
        insert into public.keeper_preferences (
          user_id, accent_color, background_mode, background_color_1, background_color_2,
          background_image, font_family, ui_size, search_position, wallpaper_urls, updated_at
        ) values (
          uid,
          coalesce(m_data->>'accent', '#a8b5ff'),
          coalesce(m_data->>'background', 'solid'),
          coalesce(m_data->>'color1', '#08090b'),
          coalesce(m_data->>'color2', '#242832'),
          coalesce(m_data->>'image', ''),
          coalesce(m_data->>'font', 'Roboto'),
          coalesce(m_data->>'size', 'medium'),
          coalesce(m_data->'searchPosition', '{"x":0,"y":0}'::jsonb),
          coalesce(m_data->'wallpaperUrls', '[]'::jsonb),
          clock_timestamp()
        )
        on conflict (user_id) do update set
          accent_color = case when m_data ? 'accent' then coalesce(m_data->>'accent', keeper_preferences.accent_color) else keeper_preferences.accent_color end,
          background_mode = case when m_data ? 'background' then coalesce(m_data->>'background', keeper_preferences.background_mode) else keeper_preferences.background_mode end,
          background_color_1 = case when m_data ? 'color1' then coalesce(m_data->>'color1', keeper_preferences.background_color_1) else keeper_preferences.background_color_1 end,
          background_color_2 = case when m_data ? 'color2' then coalesce(m_data->>'color2', keeper_preferences.background_color_2) else keeper_preferences.background_color_2 end,
          background_image = case when m_data ? 'image' then coalesce(m_data->>'image', keeper_preferences.background_image) else keeper_preferences.background_image end,
          font_family = case when m_data ? 'font' then coalesce(m_data->>'font', keeper_preferences.font_family) else keeper_preferences.font_family end,
          ui_size = case when m_data ? 'size' then coalesce(m_data->>'size', keeper_preferences.ui_size) else keeper_preferences.ui_size end,
          search_position = case when m_data ? 'searchPosition' then coalesce(m_data->'searchPosition', keeper_preferences.search_position) else keeper_preferences.search_position end,
          wallpaper_urls = case when m_data ? 'wallpaperUrls' then coalesce(m_data->'wallpaperUrls', keeper_preferences.wallpaper_urls) else keeper_preferences.wallpaper_urls end,
          updated_at = clock_timestamp();

      elsif m_type = 'profile' then
        insert into public.keeper_profiles (
          user_id, display_name, hide_email, avatar_path, updated_at
        ) values (
          uid,
          coalesce(m_data->>'name', ''),
          coalesce((m_data->>'hideEmail')::boolean, false),
          m_data->>'avatarPath',
          clock_timestamp()
        )
        on conflict (user_id) do update set
          display_name = case when m_data ? 'name' then coalesce(m_data->>'name', keeper_profiles.display_name) else keeper_profiles.display_name end,
          hide_email = case when m_data ? 'hideEmail' then coalesce((m_data->>'hideEmail')::boolean, keeper_profiles.hide_email) else keeper_profiles.hide_email end,
          avatar_path = case when m_data ? 'avatarPath' then m_data->>'avatarPath' else keeper_profiles.avatar_path end,
          updated_at = clock_timestamp();

      elsif m_type = 'checkpoint' then
        if m_op in ('insert', 'update') then
          insert into public.keeper_checkpoints (user_id, exported_at, version, data)
          values (
            uid,
            (m_data->>'exportedAt')::timestamptz,
            coalesce((m_data->>'version')::smallint, 1),
            m_data - 'version' - 'exportedAt'
          )
          on conflict (user_id, exported_at) do update set data = excluded.data;
        elsif m_op = 'delete' then
          delete from public.keeper_checkpoints where user_id = uid and exported_at = (m_entity_id)::timestamptz;
        end if;
      end if;

      -- Record this applied mutation in the CDC changelog
      insert into public.keeper_change_log (
        user_id, device_id, mutation_id, entity_type, entity_id, op, data, client_time, server_time
      ) values (
        uid, p_device_id, m_id, m_type, m_entity_id, m_op, m_data, m_client_time, clock_timestamp()
      );

      applied_ids := applied_ids || jsonb_build_array(m_id);
    end loop;
  end if;

  -- Compute the new latest server sequence
  select coalesce(max(seq), 0) into latest_seq
  from public.keeper_change_log
  where user_id = uid;

  -- Update sync state sequence and revision to trigger Realtime broadcast
  update public.keeper_sync_state
  set seq = latest_seq,
      revision = revision + 1,
      updated_at = clock_timestamp()
  where user_id = uid;

  -- Incremental sync pull vs bootstrap snapshot
  if p_last_seq = 0 then
    -- Bootstrap full snapshot of active state
    snapshot := public.get_keeper_document();
    changes := '[]'::jsonb;
  else
    -- Fetch incremental changes made by other devices since p_last_seq
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'seq', l.seq,
          'deviceId', l.device_id,
          'mutationId', l.mutation_id,
          'entityType', l.entity_type,
          'entityId', l.entity_id,
          'op', l.op,
          'data', l.data,
          'clientTime', l.client_time,
          'serverTime', l.server_time
        ) order by l.seq asc
      ),
      '[]'::jsonb
    ) into changes
    from public.keeper_change_log l
    where l.user_id = uid
      and l.seq > p_last_seq
      and l.device_id <> p_device_id;
  end if;

  return jsonb_build_object(
    'latestSeq', latest_seq,
    'appliedIds', applied_ids,
    'changes', changes,
    'snapshot', snapshot
  );
end $$;

revoke all on function public.sync_keeper_changes(text, bigint, jsonb) from public;
grant execute on function public.sync_keeper_changes(text, bigint, jsonb) to authenticated;

-- Also update clear_keeper_data so it cleans the change log cleanly and advances seq
create or replace function public.clear_keeper_data(p_checkpoints jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  current_revision bigint;
  latest_seq bigint;
  cp jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_checkpoints) <> 'array' or jsonb_array_length(p_checkpoints) > 5 then
    raise exception 'Invalid checkpoint list' using errcode = '22023';
  end if;

  insert into public.keeper_sync_state(user_id, revision, seq) values(uid, 1, 0) on conflict(user_id) do nothing;
  select revision into current_revision from public.keeper_sync_state where user_id = uid for update;

  delete from public.keeper_collections where user_id = uid;
  delete from public.keeper_widgets where user_id = uid;
  delete from public.keeper_checkpoints where user_id = uid;
  delete from public.keeper_change_log where user_id = uid;

  for cp in select value from jsonb_array_elements(p_checkpoints) loop
    insert into public.keeper_checkpoints(user_id, exported_at, version, data)
    values(uid, (cp->>'exportedAt')::timestamptz, coalesce((cp->>'version')::smallint, 1), cp - 'version' - 'exportedAt');
  end loop;

  insert into public.keeper_profiles(user_id, display_name, hide_email, avatar_path)
    values(uid, '', false, null)
    on conflict(user_id) do update set display_name = '', hide_email = false, avatar_path = null, updated_at = now();

  insert into public.keeper_preferences(user_id, accent_color, background_mode, background_color_1, background_color_2, background_image, font_family, ui_size, search_position, wallpaper_urls)
    values(uid, '#a8b5ff', 'solid', '#08090b', '#242832', '', 'Roboto', 'medium', '{"x":0,"y":0}'::jsonb, '[]'::jsonb)
    on conflict(user_id) do update set accent_color = '#a8b5ff', background_mode = 'solid', background_color_1 = '#08090b', background_color_2 = '#242832', background_image = '', font_family = 'Roboto', ui_size = 'medium', search_position = '{"x":0,"y":0}'::jsonb, wallpaper_urls = '[]'::jsonb, updated_at = now();

  update public.keeper_sync_state
  set revision = revision + 1,
      seq = 0,
      updated_at = now()
  where user_id = uid
  returning revision into current_revision;

  return current_revision;
end $$;

revoke all on function public.clear_keeper_data(jsonb) from public;
grant execute on function public.clear_keeper_data(jsonb) to authenticated;
