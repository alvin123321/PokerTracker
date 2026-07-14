create type public.mini_game_status as enum ('OPEN', 'FLOP', 'TURN', 'COMPLETE');

create table public.mini_games (
  id uuid primary key default gen_random_uuid(),
  creator_host_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  min_players smallint not null default 2,
  max_players smallint not null default 10,
  status public.mini_game_status not null default 'OPEN',
  is_current boolean not null default true,
  state_version bigint not null default 1 check (state_version > 0),
  equity_version bigint not null default 0 check (equity_version >= 0),
  equity_status text not null default 'PENDING'
    check (equity_status in ('PENDING', 'READY', 'ERROR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint mini_games_name_trimmed check (name = btrim(name)),
  constraint mini_games_name_length check (char_length(name) between 2 and 40),
  constraint mini_games_player_limits check (
    min_players between 2 and 10
    and max_players between 2 and 10
    and min_players <= max_players
  ),
  constraint mini_games_completion_timestamp check (
    (status = 'COMPLETE' and completed_at is not null)
    or (status <> 'COMPLETE' and completed_at is null)
  )
);

create unique index mini_games_one_current_idx
on public.mini_games ((is_current))
where is_current and deleted_at is null;

create index mini_games_history_idx
on public.mini_games (completed_at desc)
where status = 'COMPLETE' and deleted_at is null;

create index mini_games_creator_idx on public.mini_games (creator_host_id);

create table public.mini_game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mini_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  join_position integer not null check (join_position > 0),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  celebration_seen_at timestamptz,
  constraint mini_game_participants_game_user_unique unique (game_id, user_id),
  constraint mini_game_participants_game_position_unique unique (game_id, join_position),
  constraint mini_game_participants_id_game_unique unique (id, game_id),
  constraint mini_game_participants_removed_state check (
    (is_active and removed_at is null)
    or (not is_active and removed_at is not null)
  )
);

create index mini_game_participants_active_idx
on public.mini_game_participants (game_id, join_position)
where is_active;

create table public.mini_game_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mini_games(id) on delete cascade,
  card_code text not null check (card_code ~ '^[2-9TJQKA][cdhs]$'),
  participant_id uuid,
  hand_position smallint,
  board_position smallint,
  dealt_at timestamptz not null default now(),
  constraint mini_game_cards_participant_game_fk
    foreign key (participant_id, game_id)
    references public.mini_game_participants(id, game_id)
    on delete cascade,
  constraint mini_game_cards_unique_card unique (game_id, card_code),
  constraint mini_game_cards_assignment check (
    (
      participant_id is not null
      and hand_position is not null
      and hand_position between 1 and 2
      and board_position is null
    )
    or (
      participant_id is null
      and hand_position is null
      and board_position is not null
      and board_position between 1 and 5
    )
  )
);

create unique index mini_game_cards_hand_slot_unique_idx
on public.mini_game_cards (participant_id, hand_position)
where participant_id is not null;

create unique index mini_game_cards_board_slot_unique_idx
on public.mini_game_cards (game_id, board_position)
where board_position is not null;

create index mini_game_cards_game_idx on public.mini_game_cards (game_id);

create table public.mini_game_equities (
  game_id uuid not null references public.mini_games(id) on delete cascade,
  participant_id uuid not null,
  calculation_state_version bigint not null check (calculation_state_version > 0),
  equity_share numeric(18, 12) not null check (equity_share between 0 and 1),
  display_percentage numeric(5, 1) not null check (display_percentage between 0 and 100),
  wins bigint not null check (wins >= 0),
  ties bigint not null check (ties >= 0),
  total_outcomes bigint not null check (total_outcomes > 0),
  final_hand_label text,
  calculated_at timestamptz not null default now(),
  primary key (game_id, participant_id),
  constraint mini_game_equities_participant_game_fk
    foreign key (participant_id, game_id)
    references public.mini_game_participants(id, game_id)
    on delete cascade
);

create index mini_game_equities_version_idx
on public.mini_game_equities (game_id, calculation_state_version);

create trigger mini_games_set_updated_at
before update on public.mini_games
for each row execute function public.set_updated_at();

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
    or p_min_players not between 2 and 10
    or p_max_players not between 2 and 10
    or p_min_players > p_max_players
  then
    raise exception 'Mini-game player limits must be between 2 and 10 with minimum not above maximum.';
  end if;
end;
$$;

create or replace function public.mini_game_assert_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not exists (
    select 1 from public.users u where u.id = current_user_id
  ) then
    raise exception 'Authentication required.';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.mini_game_assert_creator(p_game_id uuid)
returns public.mini_games
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.mini_game_assert_authenticated();
  current_app_role text;
  target_game public.mini_games;
begin
  select u.role::text into current_app_role
  from public.users u
  where u.id = current_user_id;

  select g.* into target_game
  from public.mini_games g
  where g.id = p_game_id
    and g.deleted_at is null;

  if target_game.id is null then
    raise exception 'Mini-game not found.';
  end if;

  if current_app_role <> 'HOST' or target_game.creator_host_id <> current_user_id then
    raise exception 'Only the creator host can manage this mini-game.';
  end if;

  return target_game;
end;
$$;

create or replace function public.mini_game_deck()
returns table (card_code text)
language sql
immutable
set search_path = ''
as $$
  select ranks.rank || suits.suit
  from unnest(array['2','3','4','5','6','7','8','9','T','J','Q','K','A']::text[]) as ranks(rank)
  cross join unnest(array['c','d','h','s']::text[]) as suits(suit);
$$;

create or replace function public.mini_game_draw_card(
  p_game_id uuid,
  p_participant_id uuid default null,
  p_hand_position smallint default null,
  p_board_position smallint default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_card text;
begin
  select deck.card_code into selected_card
  from public.mini_game_deck() deck
  where not exists (
    select 1
    from public.mini_game_cards existing
    where existing.game_id = p_game_id
      and existing.card_code = deck.card_code
  )
  order by pg_catalog.random()
  limit 1;

  if selected_card is null then
    raise exception 'No cards remain in the deck.';
  end if;

  insert into public.mini_game_cards (
    game_id,
    card_code,
    participant_id,
    hand_position,
    board_position
  )
  values (
    p_game_id,
    selected_card,
    p_participant_id,
    p_hand_position,
    p_board_position
  );

  return selected_card;
end;
$$;

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
    equity_status = 'PENDING'
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

create or replace function public.update_mini_game(
  p_game_id uuid,
  p_name text,
  p_min_players smallint,
  p_max_players smallint
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
  target_game public.mini_games;
  active_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  target_game := public.mini_game_assert_creator(p_game_id);
  perform public.mini_game_validate_settings(p_name, p_min_players, p_max_players);

  if target_game.status <> 'OPEN' then
    raise exception 'Only an open mini-game can be edited.';
  end if;

  select count(*)::integer into active_count
  from public.mini_game_participants p
  where p.game_id = p_game_id
    and p.is_active;

  if p_max_players < active_count then
    raise exception 'Maximum players cannot be lower than the joined player count.';
  end if;

  update public.mini_games g
  set
    name = btrim(p_name),
    min_players = p_min_players,
    max_players = p_max_players
  where g.id = p_game_id;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.join_mini_game(p_game_id uuid)
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
  current_display_name text;
  target_game public.mini_games;
  target_participant public.mini_game_participants;
  active_count integer;
  next_join_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  current_user_id := public.mini_game_assert_authenticated();

  select g.* into target_game
  from public.mini_games g
  where g.id = p_game_id
    and g.is_current
    and g.deleted_at is null
  for update;

  if target_game.id is null then
    raise exception 'Mini-game not found.';
  end if;

  if target_game.status <> 'OPEN' then
    raise exception 'Joining is closed because this mini-game has started.';
  end if;

  select count(*)::integer into active_count
  from public.mini_game_participants p
  where p.game_id = p_game_id
    and p.is_active;

  select p.* into target_participant
  from public.mini_game_participants p
  where p.game_id = p_game_id
    and p.user_id = current_user_id;

  if target_participant.id is not null and target_participant.is_active then
    raise exception 'You already joined this mini-game.';
  end if;

  if active_count >= target_game.max_players then
    raise exception 'This mini-game is full.';
  end if;

  select coalesce(
    nullif(btrim(u.display_name), ''),
    nullif(btrim(u.username), ''),
    'Member'
  )
  into current_display_name
  from public.users u
  where u.id = current_user_id;

  if target_participant.id is null then
    select coalesce(max(p.join_position), 0) + 1 into next_join_position
    from public.mini_game_participants p
    where p.game_id = p_game_id;

    insert into public.mini_game_participants (
      game_id,
      user_id,
      display_name,
      join_position
    )
    values (
      p_game_id,
      current_user_id,
      current_display_name,
      next_join_position
    )
    returning * into target_participant;
  else
    update public.mini_game_participants p
    set
      display_name = current_display_name,
      is_active = true,
      removed_at = null,
      celebration_seen_at = null
    where p.id = target_participant.id
    returning * into target_participant;
  end if;

  perform public.mini_game_draw_card(
    p_game_id,
    target_participant.id,
    1::smallint,
    null
  );
  perform public.mini_game_draw_card(
    p_game_id,
    target_participant.id,
    2::smallint,
    null
  );

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.remove_mini_game_participant(
  p_game_id uuid,
  p_participant_id uuid
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
  target_game public.mini_games;
  target_participant public.mini_game_participants;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  target_game := public.mini_game_assert_creator(p_game_id);

  if target_game.status <> 'OPEN' then
    raise exception 'Players can only be removed before the mini-game starts.';
  end if;

  select p.* into target_participant
  from public.mini_game_participants p
  where p.id = p_participant_id
    and p.game_id = p_game_id
    and p.is_active;

  if target_participant.id is null then
    raise exception 'Active mini-game player not found.';
  end if;

  delete from public.mini_game_cards c
  where c.game_id = p_game_id
    and c.participant_id = p_participant_id;

  update public.mini_game_participants p
  set
    is_active = false,
    removed_at = now(),
    celebration_seen_at = null
  where p.id = p_participant_id;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.reshuffle_mini_game(p_game_id uuid)
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
  participant record;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  target_game := public.mini_game_assert_creator(p_game_id);

  if target_game.status <> 'OPEN' then
    raise exception 'Cards can only be reshuffled before the mini-game starts.';
  end if;

  delete from public.mini_game_cards c where c.game_id = p_game_id;

  for participant in
    select p.id
    from public.mini_game_participants p
    where p.game_id = p_game_id
      and p.is_active
    order by p.join_position
  loop
    perform public.mini_game_draw_card(p_game_id, participant.id, 1::smallint, null);
    perform public.mini_game_draw_card(p_game_id, participant.id, 2::smallint, null);
  end loop;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.start_mini_game(p_game_id uuid)
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
  active_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);
  target_game := public.mini_game_assert_creator(p_game_id);

  if target_game.status <> 'OPEN' then
    raise exception 'This mini-game has already started.';
  end if;

  select count(*)::integer into active_count
  from public.mini_game_participants p
  where p.game_id = p_game_id
    and p.is_active;

  if active_count < target_game.min_players then
    raise exception 'Not enough players have joined to start this mini-game.';
  end if;

  perform public.mini_game_draw_card(p_game_id, null, null, 1::smallint);
  perform public.mini_game_draw_card(p_game_id, null, null, 2::smallint);
  perform public.mini_game_draw_card(p_game_id, null, null, 3::smallint);

  update public.mini_games g
  set status = 'FLOP'
  where g.id = p_game_id;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.reveal_mini_game_turn(p_game_id uuid)
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

  if target_game.status <> 'FLOP' then
    raise exception 'The turn can only be revealed after the flop.';
  end if;

  perform public.mini_game_draw_card(p_game_id, null, null, 4::smallint);

  update public.mini_games g
  set status = 'TURN'
  where g.id = p_game_id;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.reveal_mini_game_river(p_game_id uuid)
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

  if target_game.status <> 'TURN' then
    raise exception 'The river can only be revealed after the turn.';
  end if;

  perform public.mini_game_draw_card(p_game_id, null, null, 5::smallint);

  update public.mini_games g
  set
    status = 'COMPLETE',
    completed_at = now()
  where g.id = p_game_id;

  return query select * from public.mini_game_advance_state(p_game_id);
end;
$$;

create or replace function public.delete_mini_game(p_game_id uuid)
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

  if target_game.status not in ('OPEN', 'COMPLETE') then
    raise exception 'A running mini-game cannot be deleted.';
  end if;

  update public.mini_games g
  set
    deleted_at = now(),
    is_current = false
  where g.id = p_game_id;

  return query select * from public.mini_game_advance_state(p_game_id);
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
    and p.game_id = g.id
    and p.user_id = current_user_id
    and p.is_active
    and p.celebration_seen_at is null
    and g.status = 'COMPLETE'
    and g.deleted_at is null
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.mini_game_snapshot(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'creatorHostId', g.creator_host_id,
    'name', g.name,
    'minPlayers', g.min_players,
    'maxPlayers', g.max_players,
    'status', g.status::text,
    'isCurrent', g.is_current,
    'stateVersion', g.state_version,
    'equityVersion', g.equity_version,
    'equityStatus', g.equity_status,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at,
    'completedAt', g.completed_at,
    'archivedAt', g.archived_at,
    'activePlayerCount', (
      select count(*)::integer
      from public.mini_game_participants participant_count
      where participant_count.game_id = g.id
        and participant_count.is_active
    ),
    'viewerParticipantId', (
      select viewer.id
      from public.mini_game_participants viewer
      where viewer.game_id = g.id
        and viewer.user_id = auth.uid()
        and viewer.is_active
    ),
    'viewerCelebrationSeen', coalesce((
      select viewer.celebration_seen_at is not null
      from public.mini_game_participants viewer
      where viewer.game_id = g.id
        and viewer.user_id = auth.uid()
        and viewer.is_active
    ), false),
    'board', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', board_card.board_position,
          'code', board_card.card_code
        )
        order by board_card.board_position
      )
      from public.mini_game_cards board_card
      where board_card.game_id = g.id
        and board_card.board_position is not null
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', participant.id,
          'userId', participant.user_id,
          'displayName', participant.display_name,
          'joinPosition', participant.join_position,
          'joinedAt', participant.joined_at,
          'cards', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'position', hand_card.hand_position,
                'code', hand_card.card_code
              )
              order by hand_card.hand_position
            )
            from public.mini_game_cards hand_card
            where hand_card.game_id = g.id
              and hand_card.participant_id = participant.id
          ), '[]'::jsonb),
          'equity', (
            select jsonb_build_object(
              'stateVersion', equity.calculation_state_version,
              'share', equity.equity_share,
              'percentage', equity.display_percentage,
              'wins', equity.wins,
              'ties', equity.ties,
              'totalOutcomes', equity.total_outcomes,
              'finalHandLabel', equity.final_hand_label,
              'calculatedAt', equity.calculated_at
            )
            from public.mini_game_equities equity
            where equity.game_id = g.id
              and equity.participant_id = participant.id
              and equity.calculation_state_version = g.state_version
          )
        )
        order by participant.join_position
      )
      from public.mini_game_participants participant
      where participant.game_id = g.id
        and participant.is_active
    ), '[]'::jsonb),
    'winnerParticipantIds', case
      when g.status = 'COMPLETE' and g.equity_version = g.state_version then coalesce((
        select jsonb_agg(equity.participant_id order by participant.join_position)
        from public.mini_game_equities equity
        join public.mini_game_participants participant
          on participant.id = equity.participant_id
         and participant.game_id = equity.game_id
        where equity.game_id = g.id
          and equity.calculation_state_version = g.state_version
          and equity.equity_share > 0
          and participant.is_active
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  from public.mini_games g
  where g.id = p_game_id
    and g.deleted_at is null;
$$;

create or replace function public.get_current_mini_game()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_game_id uuid;
begin
  perform public.mini_game_assert_authenticated();

  select g.id into target_game_id
  from public.mini_games g
  where g.is_current
    and g.deleted_at is null;

  if target_game_id is null then
    return null;
  end if;

  return public.mini_game_snapshot(target_game_id);
end;
$$;

create or replace function public.list_mini_game_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  history jsonb;
begin
  perform public.mini_game_assert_authenticated();

  select coalesce(
    jsonb_agg(public.mini_game_snapshot(g.id) order by g.completed_at desc, g.id),
    '[]'::jsonb
  )
  into history
  from public.mini_games g
  where g.status = 'COMPLETE'
    and g.deleted_at is null;

  return history;
end;
$$;

create or replace function public.get_mini_game_detail(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  perform public.mini_game_assert_authenticated();
  snapshot := public.mini_game_snapshot(p_game_id);

  if snapshot is null then
    raise exception 'Mini-game not found.';
  end if;

  return snapshot;
end;
$$;

create or replace function public.store_mini_game_equities(
  p_game_id uuid,
  p_expected_state_version bigint,
  p_equities jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_game public.mini_games;
  active_count integer;
  equity_count integer;
  distinct_participant_count integer;
  equity_total numeric;
  display_total numeric;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role privileges required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(741420260714::bigint);

  select g.* into target_game
  from public.mini_games g
  where g.id = p_game_id
    and g.deleted_at is null
  for update;

  if target_game.id is null then
    raise exception 'Mini-game not found.';
  end if;

  if target_game.state_version <> p_expected_state_version then
    return false;
  end if;

  if p_equities is null or jsonb_typeof(p_equities) <> 'array' then
    raise exception 'Equity payload must be a JSON array.';
  end if;

  select count(*)::integer into active_count
  from public.mini_game_participants p
  where p.game_id = p_game_id
    and p.is_active;

  select
    count(*)::integer,
    count(distinct (item.value ->> 'participantId')::uuid)::integer,
    coalesce(sum((item.value ->> 'equityShare')::numeric), 0),
    coalesce(sum((item.value ->> 'displayPercentage')::numeric), 0)
  into equity_count, distinct_participant_count, equity_total, display_total
  from jsonb_array_elements(p_equities) item(value);

  if equity_count <> active_count or distinct_participant_count <> active_count then
    raise exception 'Equity payload must contain every active participant exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_equities) item(value)
    left join public.mini_game_participants participant
      on participant.id = (item.value ->> 'participantId')::uuid
     and participant.game_id = p_game_id
     and participant.is_active
    where participant.id is null
  ) then
    raise exception 'Equity payload contains an invalid participant.';
  end if;

  if active_count > 0 and pg_catalog.abs(equity_total - 1) > 0.000000001 then
    raise exception 'Raw equity shares must total 1.';
  end if;

  if active_count > 0 and display_total <> 100.0 then
    raise exception 'Displayed equity percentages must total 100.0.';
  end if;

  delete from public.mini_game_equities e where e.game_id = p_game_id;

  insert into public.mini_game_equities (
    game_id,
    participant_id,
    calculation_state_version,
    equity_share,
    display_percentage,
    wins,
    ties,
    total_outcomes,
    final_hand_label
  )
  select
    p_game_id,
    (item.value ->> 'participantId')::uuid,
    p_expected_state_version,
    (item.value ->> 'equityShare')::numeric,
    (item.value ->> 'displayPercentage')::numeric,
    (item.value ->> 'wins')::bigint,
    (item.value ->> 'ties')::bigint,
    (item.value ->> 'totalOutcomes')::bigint,
    nullif(item.value ->> 'finalHandLabel', '')
  from jsonb_array_elements(p_equities) item(value);

  update public.mini_games g
  set
    equity_version = p_expected_state_version,
    equity_status = 'READY'
  where g.id = p_game_id;

  return true;
end;
$$;

alter table public.mini_games enable row level security;
alter table public.mini_game_participants enable row level security;
alter table public.mini_game_cards enable row level security;
alter table public.mini_game_equities enable row level security;

create policy "Authenticated users can read visible mini-games"
on public.mini_games
for select
to authenticated
using (deleted_at is null);

create policy "Authenticated users can read visible mini-game participants"
on public.mini_game_participants
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.mini_games g
    where g.id = mini_game_participants.game_id
      and g.deleted_at is null
  )
);

create policy "Authenticated users can read visible mini-game cards"
on public.mini_game_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.mini_games g
    where g.id = mini_game_cards.game_id
      and g.deleted_at is null
  )
);

create policy "Authenticated users can read visible mini-game equities"
on public.mini_game_equities
for select
to authenticated
using (
  exists (
    select 1
    from public.mini_games g
    where g.id = mini_game_equities.game_id
      and g.deleted_at is null
  )
);

grant usage on type public.mini_game_status to authenticated, service_role;
grant select on public.mini_games to authenticated;
grant select on public.mini_game_participants to authenticated;
grant select on public.mini_game_cards to authenticated;
grant select on public.mini_game_equities to authenticated;
grant select, insert, update, delete on public.mini_games to service_role;
grant select, insert, update, delete on public.mini_game_participants to service_role;
grant select, insert, update, delete on public.mini_game_cards to service_role;
grant select, insert, update, delete on public.mini_game_equities to service_role;

revoke all on public.mini_games from anon;
revoke all on public.mini_game_participants from anon;
revoke all on public.mini_game_cards from anon;
revoke all on public.mini_game_equities from anon;

revoke all on function public.mini_game_validate_settings(text, smallint, smallint)
from public, anon, authenticated;
revoke all on function public.mini_game_assert_authenticated()
from public, anon, authenticated;
revoke all on function public.mini_game_assert_creator(uuid)
from public, anon, authenticated;
revoke all on function public.mini_game_deck()
from public, anon, authenticated;
revoke all on function public.mini_game_draw_card(uuid, uuid, smallint, smallint)
from public, anon, authenticated;
revoke all on function public.mini_game_advance_state(uuid)
from public, anon, authenticated;
revoke all on function public.mini_game_snapshot(uuid)
from public, anon, authenticated;

revoke all on function public.create_mini_game(text, smallint, smallint)
from public, anon, authenticated;
revoke all on function public.update_mini_game(uuid, text, smallint, smallint)
from public, anon, authenticated;
revoke all on function public.join_mini_game(uuid)
from public, anon, authenticated;
revoke all on function public.remove_mini_game_participant(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.reshuffle_mini_game(uuid)
from public, anon, authenticated;
revoke all on function public.start_mini_game(uuid)
from public, anon, authenticated;
revoke all on function public.reveal_mini_game_turn(uuid)
from public, anon, authenticated;
revoke all on function public.reveal_mini_game_river(uuid)
from public, anon, authenticated;
revoke all on function public.delete_mini_game(uuid)
from public, anon, authenticated;
revoke all on function public.claim_mini_game_celebration(uuid)
from public, anon, authenticated;
revoke all on function public.get_current_mini_game()
from public, anon, authenticated;
revoke all on function public.list_mini_game_history()
from public, anon, authenticated;
revoke all on function public.get_mini_game_detail(uuid)
from public, anon, authenticated;
revoke all on function public.store_mini_game_equities(uuid, bigint, jsonb)
from public, anon, authenticated;

grant execute on function public.create_mini_game(text, smallint, smallint) to authenticated;
grant execute on function public.update_mini_game(uuid, text, smallint, smallint) to authenticated;
grant execute on function public.join_mini_game(uuid) to authenticated;
grant execute on function public.remove_mini_game_participant(uuid, uuid) to authenticated;
grant execute on function public.reshuffle_mini_game(uuid) to authenticated;
grant execute on function public.start_mini_game(uuid) to authenticated;
grant execute on function public.reveal_mini_game_turn(uuid) to authenticated;
grant execute on function public.reveal_mini_game_river(uuid) to authenticated;
grant execute on function public.delete_mini_game(uuid) to authenticated;
grant execute on function public.claim_mini_game_celebration(uuid) to authenticated;
grant execute on function public.get_current_mini_game() to authenticated;
grant execute on function public.list_mini_game_history() to authenticated;
grant execute on function public.get_mini_game_detail(uuid) to authenticated;
grant execute on function public.store_mini_game_equities(uuid, bigint, jsonb) to service_role;

alter table public.mini_games replica identity full;
alter table public.mini_game_participants replica identity full;
alter table public.mini_game_cards replica identity full;
alter table public.mini_game_equities replica identity full;

do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array[
      'mini_games',
      'mini_game_participants',
      'mini_game_cards',
      'mini_game_equities'
    ]
    loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
