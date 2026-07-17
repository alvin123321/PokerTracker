alter table public.mini_games
  alter column min_players set default 1;

alter table public.mini_games
  drop constraint mini_games_player_limits;

alter table public.mini_games
  add constraint mini_games_player_limits check (
    min_players between 1 and 10
    and max_players between 2 and 10
    and min_players <= max_players
  );

create or replace function public.mini_game_validate_settings(
  p_name text,
  p_min_players smallint,
  p_max_players smallint
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'Mini-game name must be between 2 and 40 characters.';
  end if;

  if p_min_players is null
    or p_max_players is null
    or p_min_players not between 1 and 10
    or p_max_players not between 2 and 10
    or p_min_players > p_max_players
  then
    raise exception 'Mini-game minimum players must be between 1 and 10, maximum players between 2 and 10, and minimum cannot exceed maximum.';
  end if;
end;
$$;

create or replace function public.create_mini_game(
  p_name text,
  p_min_players smallint default 1,
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
