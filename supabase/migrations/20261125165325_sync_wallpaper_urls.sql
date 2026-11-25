alter table public.keeper_preferences add column if not exists wallpaper_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(wallpaper_urls)='array' and jsonb_array_length(wallpaper_urls)<=25);
update public.keeper_preferences
set wallpaper_urls = jsonb_build_array(background_image), updated_at = now()
where wallpaper_urls = '[]'::jsonb and background_image ~ '^https://';

update public.keeper_sync_state
set revision = revision + 1, updated_at = now()
where user_id in (select user_id from public.keeper_preferences where jsonb_array_length(wallpaper_urls) > 0);

create or replace function public.get_keeper_document() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); result jsonb;
begin
  if not exists (select 1 from public.keeper_sync_state where user_id=uid) then return null; end if;
  select jsonb_build_object(
    'revision',(select revision from public.keeper_sync_state where user_id=uid),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'color',c.color,'font',c.font_family,'nameFont',c.name_font_family,'cardFont',c.card_font_family,'titleFontSize',c.title_font_size,'cardFontSize',c.card_font_size,'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'url',s.url) order by s.sort_order) from public.keeper_sites s where s.user_id=c.user_id and s.collection_id=c.id),'[]'::jsonb)) order by c.sort_order) from public.keeper_collections c where c.user_id=uid),'[]'::jsonb),
    'profile',coalesce((select jsonb_build_object('name',p.display_name,'email','','hideEmail',p.hide_email,'avatarPath',p.avatar_path) from public.keeper_profiles p where p.user_id=uid),'{}'::jsonb),
    'preferences',coalesce((select jsonb_build_object('accent',p.accent_color,'background',p.background_mode,'color1',p.background_color_1,'color2',p.background_color_2,'image',p.background_image,'font',p.font_family,'size',p.ui_size) from public.keeper_preferences p where p.user_id=uid),'{}'::jsonb),
    'widgets',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'type',w.widget_type,'x',w.x,'y',w.y,'width',w.width,'height',w.height) order by w.sort_order) from public.keeper_widgets w where w.user_id=uid),'[]'::jsonb),
    'checkpoints',coalesce((select jsonb_agg(c.data || jsonb_build_object('version',c.version,'exportedAt',c.exported_at) order by c.exported_at) from public.keeper_checkpoints c where c.user_id=uid),'[]'::jsonb),
    'searchPosition',coalesce((select p.search_position from public.keeper_preferences p where p.user_id=uid),'{"x":0,"y":0}'::jsonb),
    'wallpaperUrls',coalesce((select p.wallpaper_urls from public.keeper_preferences p where p.user_id=uid),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.replace_keeper_document(p_document jsonb,p_revision bigint default null) returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); current_revision bigint; c jsonb; s jsonb; w jsonb; cp jsonb; idx integer; site_idx integer; sp jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.keeper_sync_state(user_id,revision) values(uid,1) on conflict(user_id) do nothing;
  select revision into current_revision from public.keeper_sync_state where user_id=uid for update;
  if p_revision is not null and p_revision<>current_revision then return null; end if;
  insert into public.keeper_profiles(user_id,display_name,hide_email,avatar_path) values(uid,coalesce(p_document->'profile'->>'name',''),coalesce((p_document->'profile'->>'hideEmail')::boolean,false),p_document->'profile'->>'avatarPath') on conflict(user_id) do update set display_name=excluded.display_name,hide_email=excluded.hide_email,avatar_path=excluded.avatar_path,updated_at=now();
  sp:=coalesce(p_document->'searchPosition','{"x":0,"y":0}'::jsonb);
  insert into public.keeper_preferences(user_id,accent_color,background_mode,background_color_1,background_color_2,background_image,font_family,ui_size,search_position,wallpaper_urls) values(uid,p_document->'preferences'->>'accent',p_document->'preferences'->>'background',p_document->'preferences'->>'color1',p_document->'preferences'->>'color2',p_document->'preferences'->>'image',p_document->'preferences'->>'font',p_document->'preferences'->>'size',sp,coalesce(p_document->'wallpaperUrls','[]'::jsonb)) on conflict(user_id) do update set accent_color=excluded.accent_color,background_mode=excluded.background_mode,background_color_1=excluded.background_color_1,background_color_2=excluded.background_color_2,background_image=excluded.background_image,font_family=excluded.font_family,ui_size=excluded.ui_size,search_position=excluded.search_position,wallpaper_urls=excluded.wallpaper_urls,updated_at=now();
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



