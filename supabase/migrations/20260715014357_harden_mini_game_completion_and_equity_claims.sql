alter table public.mini_games
add column if not exists equity_claimed_at timestamptz;

comment on column public.mini_games.equity_claimed_at is
  'Short service-role lease preventing duplicate exact-equity calculations for one state.';

create or replace function public.mini_game_advance_state(p_game_id uuid)
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
begin
  delete from public.mini_game_equities e where e.game_id = p_game_id;

  return query
  update public.mini_games g
  set
    state_version = g.state_version + 1,
    equity_status = 'PENDING',
    equity_claimed_at = null
  where g.id = p_game_id
  returning g.id, g.state_version, g.equity_status;
end;
$$;

create or replace function public.create_mini_game(
  p_name text,
  p_min_players smallint default 2,
  p_max_players smallint default 10
)
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
  current_user_id uuid;
  current_app_role text;
  current_game public.mini_games;
  created_game public.mini_games;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  current_user_id := public.mini_game_assert_authenticated();

  select u.role::text into current_app_role
  from public.users u
  where u.id = current_user_id;

  if current_app_role <> 'HOST' then
    raise exception 'Host privileges required.';
  end if;

  perform public.mini_game_validate_settings(p_name, p_min_players, p_max_players);

  select g.* into current_game
  from public.mini_games g
  where g.is_current
    and g.deleted_at is null
  for update;

  if current_game.id is not null and current_game.status <> 'COMPLETE' then
    raise exception 'Finish or delete the current mini-game before creating another.';
  end if;

  if current_game.id is not null
    and (
      current_game.equity_status <> 'READY'
      or current_game.equity_version <> current_game.state_version
    )
  then
    raise exception 'Wait for final odds before creating another mini-game.';
  end if;

  if current_game.id is not null then
    update public.mini_games g
    set
      is_current = false,
      archived_at = coalesce(g.archived_at, now())
    where g.id = current_game.id;
  end if;

  insert into public.mini_games (
    creator_host_id,
    name,
    min_players,
    max_players
  )
  values (
    current_user_id,
    btrim(p_name),
    p_min_players,
    p_max_players
  )
  returning * into created_game;

  return query
  select created_game.id, created_game.state_version, created_game.equity_status;
end;
$$;

create or replace function public.claim_mini_game_celebration(p_game_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  claimed boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  current_user_id := public.mini_game_assert_authenticated();

  update public.mini_game_participants p
  set celebration_seen_at = now()
  from public.mini_games g
  where p.game_id = p_game_id
    and p.user_id = current_user_id
    and p.game_id = g.id
    and p.is_active
    and p.celebration_seen_at is null
    and g.status = 'COMPLETE'
    and g.equity_status = 'READY'
    and g.equity_version = g.state_version
    and g.deleted_at is null
    and exists (
      select 1
      from public.mini_game_equities e
      where e.game_id = g.id
        and e.calculation_state_version = g.state_version
        and e.equity_share > 0
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.claim_mini_game_equity_calculation(
  p_game_id uuid,
  p_expected_state_version bigint
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role privileges required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);

  update public.mini_games g
  set equity_claimed_at = clock_timestamp()
  where g.id = p_game_id
    and g.deleted_at is null
    and g.is_current
    and g.state_version = p_expected_state_version
    and g.equity_status = 'PENDING'
    and (
      g.equity_claimed_at is null
      or g.equity_claimed_at < clock_timestamp() - interval '15 seconds'
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_mini_game_equity_calculation(
  p_game_id uuid,
  p_expected_state_version bigint
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  released boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role privileges required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);

  update public.mini_games g
  set equity_claimed_at = null
  where g.id = p_game_id
    and g.deleted_at is null
    and g.is_current
    and g.state_version = p_expected_state_version
    and g.equity_status = 'PENDING'
    and g.equity_claimed_at is not null
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.claim_mini_game_equity_calculation(uuid, bigint)
from public, anon, authenticated;
revoke all on function public.release_mini_game_equity_calculation(uuid, bigint)
from public, anon, authenticated;

grant execute on function public.claim_mini_game_equity_calculation(uuid, bigint) to service_role;
grant execute on function public.release_mini_game_equity_calculation(uuid, bigint) to service_role;
