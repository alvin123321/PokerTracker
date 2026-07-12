create or replace function public.player_public_table_summaries(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  active_player_count integer,
  total_active_player_chips numeric
)
language sql
security definer
set search_path = ''
as $$
  with current_player_seats as (
    select sp.id, sp.session_id, sp.table_id
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where p.user_id = auth.uid()
      and (p_session_ids is null or sp.session_id = any(p_session_ids))
  )
  select
    current_player_seats.id as session_player_id,
    current_player_seats.session_id,
    current_player_seats.table_id,
    count(game_players.id) filter (where game_players.status = 'ACTIVE')::integer
      as active_player_count,
    coalesce(
      sum(game_players.total_buy_in) filter (where game_players.status = 'ACTIVE'),
      0
    )::numeric as total_active_player_chips
  from current_player_seats
  join public.session_players game_players
    on game_players.session_id = current_player_seats.session_id
  group by current_player_seats.id, current_player_seats.session_id, current_player_seats.table_id
  order by current_player_seats.session_id, current_player_seats.id;
$$;

revoke all on function public.player_public_table_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_summaries(uuid[]) to authenticated;

comment on function public.player_public_table_summaries(uuid[])
is 'Returns active player count and active chip total for games where the current player participates. The table name is retained for client compatibility.';

create or replace function public.player_public_table_roster(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  player_name text,
  status public.session_player_status
)
language sql
security definer
set search_path = ''
as $$
  with current_player_sessions as (
    select distinct sp.session_id
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where p.user_id = auth.uid()
      and (p_session_ids is null or sp.session_id = any(p_session_ids))
  )
  select
    game_players.id as session_player_id,
    game_players.session_id,
    game_players.table_id,
    players.name as player_name,
    game_players.status
  from current_player_sessions
  join public.session_players game_players
    on game_players.session_id = current_player_sessions.session_id
  join public.players players on players.id = game_players.player_id
  order by
    game_players.session_id,
    case when game_players.status = 'ACTIVE' then 0 else 1 end,
    lower(players.name),
    game_players.id;
$$;

revoke all on function public.player_public_table_roster(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_roster(uuid[]) to authenticated;

comment on function public.player_public_table_roster(uuid[])
is 'Returns public-safe player names and active/cashed status for games where the current player participates. The table name is retained for client compatibility.';

notify pgrst, 'reload schema';
