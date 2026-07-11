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
    and table_players.table_id is not distinct from current_player_seats.table_id
  group by current_player_seats.id, current_player_seats.session_id, current_player_seats.table_id
  order by current_player_seats.session_id, current_player_seats.id;
$$;

revoke all on function public.player_public_table_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.player_public_table_summaries(uuid[]) to authenticated;

comment on function public.player_public_table_summaries(uuid[])
is 'Returns table-level active player count and active chip total for sessions where the current player is seated.';
