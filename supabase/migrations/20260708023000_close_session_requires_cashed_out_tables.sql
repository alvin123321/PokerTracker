create or replace function public.close_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  pending_player_count integer;
begin
  current_host_id := public.assert_host_admin();

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status = 'COMPLETED'::public.session_status then
    return target_session;
  end if;

  select count(*)
  into pending_player_count
  from public.session_players
  where session_id = target_session.id
    and status <> 'COMPLETED'::public.session_player_status;

  if pending_player_count > 0 then
    raise exception 'Cash out all players before closing this session.';
  end if;

  update public.session_tables
  set
    status = 'CLOSED'::public.session_table_status,
    closed_at = coalesce(closed_at, now())
  where session_id = target_session.id
    and status <> 'CLOSED'::public.session_table_status;

  update public.sessions
  set
    status = 'COMPLETED'::public.session_status,
    closed_at = now()
  where id = target_session.id
  returning * into target_session;

  return target_session;
end;
$$;

grant execute on function public.close_session(uuid) to authenticated;

notify pgrst, 'reload schema';
