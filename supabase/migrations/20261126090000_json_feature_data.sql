-- Keep core, relational entities in their existing tables. Store evolving,
-- feature-owned settings/data as bounded JSONB documents to avoid a column per option.
create table if not exists public.keeper_feature_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

alter table public.keeper_feature_data enable row level security;
grant select, insert, update, delete on public.keeper_feature_data to authenticated;
drop policy if exists keeper_feature_data_owner on public.keeper_feature_data;
create policy keeper_feature_data_owner on public.keeper_feature_data
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.get_keeper_feature_data(p_feature_key text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_feature_key is null or p_feature_key !~ '^[a-z][a-z0-9_-]{0,63}$' then
    raise exception 'Invalid feature key' using errcode = '22023';
  end if;
  return coalesce((select data from public.keeper_feature_data
    where user_id = (select auth.uid()) and feature_key = p_feature_key), '{}'::jsonb);
end $$;

create or replace function public.update_keeper_feature_data(p_feature_key text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_feature_key is null or p_feature_key !~ '^[a-z][a-z0-9_-]{0,63}$' or jsonb_typeof(p_patch) is distinct from 'object' or pg_column_size(p_patch) > 65536 then
    raise exception 'Invalid feature data' using errcode = '22023';
  end if;
  insert into public.keeper_feature_data(user_id, feature_key, data)
    values(uid, p_feature_key, p_patch)
    on conflict(user_id, feature_key) do update
      set data = keeper_feature_data.data || excluded.data, updated_at = now()
    returning data into result;
  return result;
end $$;

create or replace function public.reset_keeper_feature_data(p_feature_key text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_feature_key is null or p_feature_key !~ '^[a-z][a-z0-9_-]{0,63}$' then
    raise exception 'Invalid feature key' using errcode = '22023';
  end if;
  delete from public.keeper_feature_data
    where user_id = (select auth.uid()) and feature_key = p_feature_key;
end $$;

revoke all on function public.get_keeper_feature_data(text) from public;
revoke all on function public.update_keeper_feature_data(text, jsonb) from public;
revoke all on function public.reset_keeper_feature_data(text) from public;
grant execute on function public.get_keeper_feature_data(text) to authenticated;
grant execute on function public.update_keeper_feature_data(text, jsonb) to authenticated;
grant execute on function public.reset_keeper_feature_data(text) to authenticated;
