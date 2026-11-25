create table public.keeper_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.keeper_documents enable row level security;
alter table public.keeper_documents replica identity full;
alter publication supabase_realtime add table public.keeper_documents;
grant select, insert, update on public.keeper_documents to authenticated;

create policy "Users can read their Keeper document"
  on public.keeper_documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their Keeper document"
  on public.keeper_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their Keeper document"
  on public.keeper_documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.bump_keeper_document_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger keeper_document_revision
  before update on public.keeper_documents
  for each row execute function public.bump_keeper_document_revision();

create function public.update_keeper_document(p_document jsonb, p_revision bigint)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.keeper_documents
     set document = p_document
   where user_id = (select auth.uid())
     and revision = p_revision;
  return found;
end;
$$;

revoke all on function public.update_keeper_document(jsonb, bigint) from public;
grant execute on function public.update_keeper_document(jsonb, bigint) to authenticated;
