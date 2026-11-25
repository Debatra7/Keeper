create function public.clear_keeper_data(p_checkpoints jsonb) returns bigint
language plpgsql security invoker set search_path='' as $$
declare uid uuid := (select auth.uid()); current_revision bigint; cp jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_checkpoints) <> 'array' or jsonb_array_length(p_checkpoints) > 5 then
    raise exception 'Invalid checkpoint list' using errcode='22023';
  end if;

  insert into public.keeper_sync_state(user_id,revision) values(uid,1) on conflict(user_id) do nothing;
  select revision into current_revision from public.keeper_sync_state where user_id=uid for update;
  delete from public.keeper_collections where user_id=uid;
  delete from public.keeper_widgets where user_id=uid;
  delete from public.keeper_checkpoints where user_id=uid;
  for cp in select value from jsonb_array_elements(p_checkpoints) loop
    insert into public.keeper_checkpoints(user_id,exported_at,version,data)
    values(uid,(cp->>'exportedAt')::timestamptz,coalesce((cp->>'version')::smallint,1),cp-'version'-'exportedAt');
  end loop;
  insert into public.keeper_profiles(user_id,display_name,hide_email,avatar_path)
    values(uid,'',false,null)
    on conflict(user_id) do update set display_name='',hide_email=false,avatar_path=null,updated_at=now();
  insert into public.keeper_preferences(user_id,accent_color,background_mode,background_color_1,background_color_2,background_image,font_family,ui_size,search_position)
    values(uid,'#a8b5ff','solid','#08090b','#242832','','Roboto','medium','{"x":0,"y":0}'::jsonb)
    on conflict(user_id) do update set accent_color='#a8b5ff',background_mode='solid',background_color_1='#08090b',background_color_2='#242832',background_image='',font_family='Roboto',ui_size='medium',search_position='{"x":0,"y":0}'::jsonb,updated_at=now();
  update public.keeper_sync_state set revision=revision+1,updated_at=now() where user_id=uid returning revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.clear_keeper_data(jsonb) from public;
grant execute on function public.clear_keeper_data(jsonb) to authenticated;
