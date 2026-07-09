create or replace function public.remove_session_player(p_session_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session_player public.session_players;
  target_session public.sessions;
begin
  current_host_id := public.assert_host_admin();

  select sp.*
  into target_session_player
  from public.session_players sp
  join public.sessions s on s.id = sp.session_id
  where sp.id = p_session_player_id
    and s.host_id = current_host_id
  for update of sp;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_session_player.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot remove a player from a completed session.';
  end if;

  delete from public.time_calls
  where session_player_id = target_session_player.id;

  delete from public.transactions
  where session_player_id = target_session_player.id;

  delete from public.session_players
  where id = target_session_player.id;
end;
$$;

revoke all on function public.remove_session_player(uuid) from public, anon, authenticated;
grant execute on function public.remove_session_player(uuid) to authenticated;

comment on function public.remove_session_player(uuid)
is 'Host-only removal of a seated player from an active session, including their transactions and call-time rows.';

notify pgrst, 'reload schema';
