create or replace function public.delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
begin
  current_host_id := public.assert_host();

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  delete from public.transactions
  where session_id = target_session.id;

  delete from public.session_players
  where session_id = target_session.id;

  delete from public.session_tables
  where session_id = target_session.id;

  delete from public.sessions
  where id = target_session.id;
end;
$$;

revoke all on function public.delete_session(uuid) from public, anon, authenticated;
grant execute on function public.delete_session(uuid) to authenticated;

comment on function public.delete_session(uuid)
is 'Deletes a host-owned session and its table-scoped child rows in dependency order so session totals are fully removed.';

notify pgrst, 'reload schema';
