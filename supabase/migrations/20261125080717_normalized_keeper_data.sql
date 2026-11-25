-- Normalize the per-user document while keeping revisioned, atomic client sync.
create table public.keeper_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table public.keeper_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 200),
  hide_email boolean not null default false,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (avatar_path is null or avatar_path in (user_id::text || '/avatar.jpg', user_id::text || '/avatar.png', user_id::text || '/avatar.webp'))
);

create table public.keeper_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accent_color text not null default '#a8b5ff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_mode text not null default 'solid' check (background_mode in ('solid','gradient','image')),
  background_color_1 text not null default '#08090b' check (background_color_1 ~ '^#[0-9A-Fa-f]{6}$'),
  background_color_2 text not null default '#242832' check (background_color_2 ~ '^#[0-9A-Fa-f]{6}$'),
  background_image text not null default '',
  font_family text not null default 'Roboto',
  ui_size text not null default 'medium' check (ui_size in ('small','medium','large')),
  search_position jsonb not null default '{"x":0,"y":0}'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(search_position) = 'object' and jsonb_typeof(search_position->'x') = 'number' and jsonb_typeof(search_position->'y') = 'number' and abs((search_position->>'x')::double precision) <= 5000 and abs((search_position->>'y')::double precision) <= 5000)
);

create table public.keeper_collections (
  id text not null check (char_length(id) between 1 and 100),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  color text not null default '' check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  font_family text,
  name_font_family text,
  card_font_family text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index keeper_collections_user_order_idx on public.keeper_collections(user_id,sort_order);

create table public.keeper_sites (
  id text not null check (char_length(id) between 1 and 100),
  user_id uuid not null,
  collection_id text not null,
  name text not null check (char_length(name) <= 200),
  url text not null check (char_length(url) <= 2048),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  foreign key (user_id,collection_id) references public.keeper_collections(user_id,id) on delete cascade
);
create index keeper_sites_collection_order_idx on public.keeper_sites(user_id,collection_id,sort_order);

create table public.keeper_widgets (
  id text not null check (char_length(id) between 1 and 100),
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_type text not null check (widget_type in ('clock','calendar')),
  x double precision not null default 0 check (abs(x) <= 5000),
  y double precision not null default 0 check (abs(y) <= 5000),
  width double precision not null default 180 check (width between 1 and 5000),
  height double precision not null default 130 check (height between 1 and 5000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table public.keeper_checkpoints (
  user_id uuid not null references auth.users(id) on delete cascade,
  exported_at timestamptz not null,
  version smallint not null default 1 check (version = 1),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id,exported_at)
);

create table public.keeper_documents_legacy (like public.keeper_documents including all);
insert into public.keeper_documents_legacy select * from public.keeper_documents;

insert into public.keeper_sync_state(user_id,revision,updated_at)
select user_id,revision,updated_at from public.keeper_documents;
insert into public.keeper_profiles(user_id,display_name,hide_email,avatar_path)
select user_id,coalesce(document->'profile'->>'name',''),coalesce((document->'profile'->>'hideEmail')::boolean,false),document->'profile'->>'avatarPath' from public.keeper_documents;
insert into public.keeper_preferences(user_id,accent_color,background_mode,background_color_1,background_color_2,background_image,font_family,ui_size,search_position)
select user_id,document->'preferences'->>'accent',document->'preferences'->>'background',document->'preferences'->>'color1',document->'preferences'->>'color2',document->'preferences'->>'image',document->'preferences'->>'font',document->'preferences'->>'size',coalesce(document->'searchPosition','{"x":0,"y":0}'::jsonb) from public.keeper_documents;
insert into public.keeper_collections(user_id,id,name,color,font_family,name_font_family,card_font_family,sort_order)
select d.user_id,c->>'id',c->>'name',coalesce(c->>'color',''),nullif(c->>'font','null'),nullif(c->>'nameFont','null'),nullif(c->>'cardFont','null'),(a.ord-1)::integer
from public.keeper_documents d cross join lateral jsonb_array_elements(d.document->'collections') with ordinality a(c,ord);
insert into public.keeper_sites(user_id,id,collection_id,name,url,sort_order)
select d.user_id,s->>'id',c->>'id',s->>'name',s->>'url',(a.ord-1)::integer
from public.keeper_documents d cross join lateral jsonb_array_elements(d.document->'collections') c cross join lateral jsonb_array_elements(c->'sites') with ordinality a(s,ord);
insert into public.keeper_widgets(user_id,id,widget_type,x,y,width,height,sort_order)
select d.user_id,w->>'id',w->>'type',coalesce((w->>'x')::double precision,0),coalesce((w->>'y')::double precision,0),coalesce((w->>'width')::double precision,180),coalesce((w->>'height')::double precision,130),(a.ord-1)::integer
from public.keeper_documents d cross join lateral jsonb_array_elements(coalesce(d.document->'widgets','[]'::jsonb)) with ordinality a(w,ord);
insert into public.keeper_checkpoints(user_id,exported_at,version,data)
select d.user_id,(cp->>'exportedAt')::timestamptz,coalesce((cp->>'version')::smallint,1),cp-'version'-'exportedAt'
from public.keeper_documents d cross join lateral jsonb_array_elements(coalesce(d.document->'checkpoints','[]'::jsonb)) cp;

create schema keeper_private;
alter table public.keeper_documents_legacy set schema keeper_private;
revoke all on schema keeper_private from public,anon,authenticated;
revoke all on keeper_private.keeper_documents_legacy from public,anon,authenticated;

alter table public.keeper_sync_state enable row level security;
alter table public.keeper_profiles enable row level security;
alter table public.keeper_preferences enable row level security;
alter table public.keeper_collections enable row level security;
alter table public.keeper_sites enable row level security;
alter table public.keeper_widgets enable row level security;
alter table public.keeper_checkpoints enable row level security;
grant select,insert,update,delete on public.keeper_sync_state,public.keeper_profiles,public.keeper_preferences,public.keeper_collections,public.keeper_sites,public.keeper_widgets,public.keeper_checkpoints to authenticated;

create policy keeper_sync_state_owner on public.keeper_sync_state for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_profiles_owner on public.keeper_profiles for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_preferences_owner on public.keeper_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_collections_owner on public.keeper_collections for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_sites_owner on public.keeper_sites for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_widgets_owner on public.keeper_widgets for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy keeper_checkpoints_owner on public.keeper_checkpoints for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

alter table public.keeper_sync_state replica identity full;
alter publication supabase_realtime add table public.keeper_sync_state;

create function public.get_keeper_document() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); result jsonb;
begin
  select jsonb_build_object(
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'color',c.color,'font',c.font_family,'nameFont',c.name_font_family,'cardFont',c.card_font_family,'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'url',s.url) order by s.sort_order) from public.keeper_sites s where s.user_id=c.user_id and s.collection_id=c.id),'[]'::jsonb)) order by c.sort_order) from public.keeper_collections c where c.user_id=uid),'[]'::jsonb),
    'profile',coalesce((select jsonb_build_object('name',p.display_name,'email','','hideEmail',p.hide_email,'avatarPath',p.avatar_path) from public.keeper_profiles p where p.user_id=uid),'{}'::jsonb),
    'preferences',coalesce((select jsonb_build_object('accent',p.accent_color,'background',p.background_mode,'color1',p.background_color_1,'color2',p.background_color_2,'image',p.background_image,'font',p.font_family,'size',p.ui_size) from public.keeper_preferences p where p.user_id=uid),'{}'::jsonb),
    'widgets',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'type',w.widget_type,'x',w.x,'y',w.y,'width',w.width,'height',w.height) order by w.sort_order) from public.keeper_widgets w where w.user_id=uid),'[]'::jsonb),
    'checkpoints',coalesce((select jsonb_agg(c.data || jsonb_build_object('version',c.version,'exportedAt',c.exported_at) order by c.exported_at) from public.keeper_checkpoints c where c.user_id=uid),'[]'::jsonb),
    'searchPosition',coalesce((select p.search_position from public.keeper_preferences p where p.user_id=uid),'{"x":0,"y":0}'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_keeper_document() from public;
grant execute on function public.get_keeper_document() to authenticated;

create function public.replace_keeper_document(p_document jsonb,p_revision bigint default null) returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); current_revision bigint; c jsonb; s jsonb; w jsonb; cp jsonb; idx integer; site_idx integer; sp jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.keeper_sync_state(user_id,revision) values(uid,1) on conflict(user_id) do nothing;
  select revision into current_revision from public.keeper_sync_state where user_id=uid for update;
  if p_revision is not null and p_revision<>current_revision then return null; end if;
  insert into public.keeper_profiles(user_id,display_name,hide_email,avatar_path) values(uid,coalesce(p_document->'profile'->>'name',''),coalesce((p_document->'profile'->>'hideEmail')::boolean,false),p_document->'profile'->>'avatarPath') on conflict(user_id) do update set display_name=excluded.display_name,hide_email=excluded.hide_email,avatar_path=excluded.avatar_path,updated_at=now();
  sp:=coalesce(p_document->'searchPosition','{"x":0,"y":0}'::jsonb);
  insert into public.keeper_preferences(user_id,accent_color,background_mode,background_color_1,background_color_2,background_image,font_family,ui_size,search_position) values(uid,p_document->'preferences'->>'accent',p_document->'preferences'->>'background',p_document->'preferences'->>'color1',p_document->'preferences'->>'color2',p_document->'preferences'->>'image',p_document->'preferences'->>'font',p_document->'preferences'->>'size',sp) on conflict(user_id) do update set accent_color=excluded.accent_color,background_mode=excluded.background_mode,background_color_1=excluded.background_color_1,background_color_2=excluded.background_color_2,background_image=excluded.background_image,font_family=excluded.font_family,ui_size=excluded.ui_size,search_position=excluded.search_position,updated_at=now();
  delete from public.keeper_collections where user_id=uid;
  idx:=0;
  for c in select value from jsonb_array_elements(coalesce(p_document->'collections','[]'::jsonb)) loop
    insert into public.keeper_collections(user_id,id,name,color,font_family,name_font_family,card_font_family,sort_order) values(uid,c->>'id',c->>'name',coalesce(c->>'color',''),nullif(c->>'font','null'),nullif(c->>'nameFont','null'),nullif(c->>'cardFont','null'),idx);
    site_idx:=0;
    for s in select value from jsonb_array_elements(coalesce(c->'sites','[]'::jsonb)) loop
      insert into public.keeper_sites(user_id,id,collection_id,name,url,sort_order) values(uid,s->>'id',c->>'id',s->>'name',s->>'url',site_idx);
      site_idx:=site_idx+1;
    end loop;
    idx:=idx+1;
  end loop;
  delete from public.keeper_widgets where user_id=uid;
  idx:=0;
  for w in select value from jsonb_array_elements(coalesce(p_document->'widgets','[]'::jsonb)) loop
    insert into public.keeper_widgets(user_id,id,widget_type,x,y,width,height,sort_order) values(uid,w->>'id',w->>'type',coalesce((w->>'x')::double precision,0),coalesce((w->>'y')::double precision,0),coalesce((w->>'width')::double precision,180),coalesce((w->>'height')::double precision,130),idx);
    idx:=idx+1;
  end loop;
  delete from public.keeper_checkpoints where user_id=uid;
  for cp in select value from jsonb_array_elements(coalesce(p_document->'checkpoints','[]'::jsonb)) loop
    insert into public.keeper_checkpoints(user_id,exported_at,version,data) values(uid,(cp->>'exportedAt')::timestamptz,coalesce((cp->>'version')::smallint,1),cp-'version'-'exportedAt');
  end loop;
  update public.keeper_sync_state set revision=revision+1,updated_at=now() where user_id=uid returning revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.replace_keeper_document(jsonb,bigint) from public;
grant execute on function public.replace_keeper_document(jsonb,bigint) to authenticated;
