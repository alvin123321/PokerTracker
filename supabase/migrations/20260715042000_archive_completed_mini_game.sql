create or replace function public.archive_mini_game(p_game_id uuid)
returns table (
  game_id uuid,
  state_version bigint,
  equity_status text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_game public.mini_games;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  target_game := public.mini_game_assert_creator(p_game_id);

  if not target_game.is_current then
    raise exception 'This mini-game is already archived.';
  end if;

  if target_game.status <> 'COMPLETE' then
    raise exception 'Only a completed mini-game can be archived.';
  end if;

  if target_game.equity_status <> 'READY'
    or target_game.equity_version <> target_game.state_version
  then
    raise exception 'Wait for final odds before completing this mini-game.';
  end if;

  return query
  update public.mini_games g
  set
    is_current = false,
    archived_at = coalesce(g.archived_at, now())
  where g.id = p_game_id
  returning g.id, g.state_version, g.equity_status;
end;
$$;

comment on function public.archive_mini_game(uuid) is
  'Creator-host action that removes a completed current mini-game from dashboards while preserving its history and final result.';

revoke all on function public.archive_mini_game(uuid)
from public, anon, authenticated;

grant execute on function public.archive_mini_game(uuid) to authenticated;
