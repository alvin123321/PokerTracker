create or replace function public.delete_session_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_table public.session_tables;
  target_session public.sessions;
begin
  current_host_id := public.assert_host_admin();

  select st.*
  into target_table
  from public.session_tables st
  join public.sessions s on s.id = st.session_id
  where st.id = p_table_id
    and s.host_id = current_host_id
  for update of st;

  if target_table.id is null then
    raise exception 'Table not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_table.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot delete a table from a completed session.';
  end if;

  delete from public.time_calls tc
  using public.session_players sp
  where tc.session_player_id = sp.id
    and sp.table_id = target_table.id;

  delete from public.transactions t
  using public.session_players sp
  where t.session_player_id = sp.id
    and sp.table_id = target_table.id;

  delete from public.transactions
  where table_id = target_table.id;

  delete from public.session_players
  where table_id = target_table.id;

  delete from public.session_tables
  where id = target_table.id;
end;
$$;

revoke all on function public.delete_session_table(uuid) from public, anon, authenticated;
grant execute on function public.delete_session_table(uuid) to authenticated;

comment on function public.delete_session_table(uuid)
is 'Host-admin-only deletion of a table from an active session, including seated players, transactions, and call-time rows.';

notify pgrst, 'reload schema';
