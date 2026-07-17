drop function if exists public.player_public_table_roster(uuid[]);

create function public.player_public_table_roster(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  player_name text,
  status public.session_player_status,
  is_net_leader boolean
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
  ),
  ranked_game_players as (
    select
      game_players.id as session_player_id,
      game_players.session_id,
      game_players.table_id,
      players.name as player_name,
      game_players.status as player_status,
      sessions.status as session_status,
      game_players.net,
      max(game_players.net) over (
        partition by game_players.session_id, game_players.table_id
      ) as highest_net,
      count(*) over (
        partition by game_players.session_id, game_players.table_id, game_players.net
      ) as matching_net_count
    from current_player_sessions
    join public.sessions sessions
      on sessions.id = current_player_sessions.session_id
    join public.session_players game_players
      on game_players.session_id = current_player_sessions.session_id
    join public.players players on players.id = game_players.player_id
  )
  select
    ranked_game_players.session_player_id,
    ranked_game_players.session_id,
    ranked_game_players.table_id,
    ranked_game_players.player_name,
    ranked_game_players.player_status,
    ranked_game_players.session_status = 'COMPLETED'
      and ranked_game_players.net = ranked_game_players.highest_net
      and ranked_game_players.matching_net_count = 1 as is_net_leader
  from ranked_game_players
  order by
    ranked_game_players.session_id,
    case when ranked_game_players.player_status = 'ACTIVE' then 0 else 1 end,
    lower(ranked_game_players.player_name),
    ranked_game_players.session_player_id;
$$;

revoke all on function public.player_public_table_roster(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_roster(uuid[]) to authenticated;

comment on function public.player_public_table_roster(uuid[])
is 'Returns public-safe player names, status, and a per-table net-leader flag without exposing net amounts.';

notify pgrst, 'reload schema';
