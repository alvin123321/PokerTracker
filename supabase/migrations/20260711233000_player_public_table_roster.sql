create or replace function public.player_public_table_roster(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  player_name text,
  status public.session_player_status,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with current_player_seats as (
    select sp.id, sp.session_id, sp.table_id
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where p.user_id = auth.uid()
      and (p_session_ids is null or sp.session_id = any(p_session_ids))
  )
  select
    table_players.id as session_player_id,
    table_players.session_id,
    table_players.table_id,
    players.name as player_name,
    table_players.status,
    table_players.joined_at
  from current_player_seats
  join public.session_players table_players
    on table_players.session_id = current_player_seats.session_id
    and table_players.table_id is not distinct from current_player_seats.table_id
  join public.players players on players.id = table_players.player_id
  order by
    table_players.session_id,
    table_players.table_id,
    case when table_players.status = 'ACTIVE' then 0 else 1 end,
    lower(players.name),
    table_players.joined_at,
    table_players.id;
$$;

revoke all on function public.player_public_table_roster(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_roster(uuid[]) to authenticated;

comment on function public.player_public_table_roster(uuid[])
is 'Returns public-safe table roster names and active/cashed status for tables where the current player is seated.';

notify pgrst, 'reload schema';
