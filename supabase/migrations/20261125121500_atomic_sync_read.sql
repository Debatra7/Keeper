create or replace function public.get_keeper_document() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); result jsonb;
begin
  select jsonb_build_object(
    'revision',(select revision from public.keeper_sync_state where user_id=uid),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'color',c.color,'font',c.font_family,'nameFont',c.name_font_family,'cardFont',c.card_font_family,'titleFontSize',c.title_font_size,'cardFontSize',c.card_font_size,'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'url',s.url) order by s.sort_order) from public.keeper_sites s where s.user_id=c.user_id and s.collection_id=c.id),'[]'::jsonb)) order by c.sort_order) from public.keeper_collections c where c.user_id=uid),'[]'::jsonb),
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