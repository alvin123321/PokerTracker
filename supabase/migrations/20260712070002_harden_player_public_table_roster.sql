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
      and sp.table_id is not null
      and (p_session_ids is null or sp.session_id = any(p_session_ids))
  )
  select
    current_player_seats.id as session_player_id,
    current_player_seats.session_id,
    current_player_seats.table_id,
    count(table_players.id) filter (where table_players.status = 'ACTIVE')::integer
      as active_player_count,
    coalesce(
      sum(table_players.total_buy_in) filter (where table_players.status = 'ACTIVE'),
      0
    )::numeric as total_active_player_chips
  from current_player_seats
  join public.session_players table_players
    on table_players.session_id = current_player_seats.session_id
    and table_players.table_id = current_player_seats.table_id
  group by current_player_seats.id, current_player_seats.session_id, current_player_seats.table_id
  order by current_player_seats.session_id, current_player_seats.id;
$$;

revoke all on function public.player_public_table_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_summaries(uuid[]) to authenticated;

drop function if exists public.player_public_table_roster(uuid[]);

create function public.player_public_table_roster(p_session_ids uuid[] default null)
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
  with current_player_tables as (
    select sp.session_id, sp.table_id
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where p.user_id = auth.uid()
      and sp.table_id is not null
      and (p_session_ids is null or sp.session_id = any(p_session_ids))
  )
  select
    table_players.id as session_player_id,
    table_players.session_id,
    table_players.table_id,
    players.name as player_name,
    table_players.status
  from current_player_tables
  join public.session_players table_players
    on table_players.session_id = current_player_tables.session_id
    and table_players.table_id = current_player_tables.table_id
  join public.players players on players.id = table_players.player_id
  order by
    table_players.session_id,
    table_players.table_id,
    case when table_players.status = 'ACTIVE' then 0 else 1 end,
    lower(players.name),
    table_players.id;
$$;

revoke all on function public.player_public_table_roster(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_roster(uuid[]) to authenticated;

comment on function public.player_public_table_roster(uuid[])
is 'Returns public-safe table roster names and active/cashed status for assigned tables where the current player is seated.';

notify pgrst, 'reload schema';
