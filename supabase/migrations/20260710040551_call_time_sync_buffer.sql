create or replace function public.request_time_call(
  p_session_id uuid,
  p_session_player_id uuid
)
returns public.time_calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  target_session public.sessions;
  target_session_player public.session_players;
  created_time_call public.time_calls;
  used_call_count integer;
  starts_at timestamptz;
begin
  current_user_id := public.assert_authenticated();

  perform public.expire_running_time_calls(p_session_id);

  select *
  into target_session
  from public.sessions
  where id = p_session_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot call time in a completed session.';
  end if;

  select sp.*
  into target_session_player
  from public.session_players sp
  where sp.id = p_session_player_id
    and sp.session_id = p_session_id
  for update;

  if target_session_player.id is null then
    raise exception 'Player is not in this session.';
  end if;

  if target_session_player.status <> 'ACTIVE'::public.session_player_status then
    raise exception 'Cashed-out players cannot call time.';
  end if;

  if not public.player_belongs_to_current_user(target_session_player.player_id) then
    raise exception 'You can only call time for your own seat.';
  end if;

  if exists (
    select 1
    from public.time_calls tc
    where tc.session_id = p_session_id
      and tc.status = 'RUNNING'::public.time_call_status
  ) then
    raise exception 'A call-time clock is already running.';
  end if;

  select count(*)::integer
  into used_call_count
  from public.time_calls tc
  where tc.session_player_id = p_session_player_id
    and tc.status in (
      'RUNNING'::public.time_call_status,
      'FINISHED'::public.time_call_status,
      'EXPIRED'::public.time_call_status
    );

  if used_call_count >= 3 then
    raise exception 'No call times remaining.';
  end if;

  starts_at := now() + interval '3 seconds';

  insert into public.time_calls (
    session_id,
    session_player_id,
    status,
    started_at,
    expires_at
  )
  values (
    p_session_id,
    p_session_player_id,
    'RUNNING'::public.time_call_status,
    starts_at,
    starts_at + interval '60 seconds'
  )
  returning * into created_time_call;

  return created_time_call;
end;
$$;

revoke all on function public.request_time_call(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_time_call(uuid, uuid) to authenticated;
