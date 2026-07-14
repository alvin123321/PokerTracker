begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_type('public', 'mini_game_status', 'mini-game status enum exists');
select enum_has_labels(
  'public',
  'mini_game_status',
  array['OPEN', 'FLOP', 'TURN', 'COMPLETE'],
  'mini-game status enum has the required lifecycle'
);
select has_table('public', 'mini_games', 'mini_games exists');
select has_table('public', 'mini_game_participants', 'mini_game_participants exists');
select has_table('public', 'mini_game_cards', 'mini_game_cards exists');
select has_table('public', 'mini_game_equities', 'mini_game_equities exists');
select has_column('public', 'mini_games', 'state_version', 'games have a state version');
select has_column('public', 'mini_games', 'equity_version', 'games have an equity version');
select has_column('public', 'mini_games', 'deleted_at', 'games use soft deletion');
select has_column(
  'public',
  'mini_game_participants',
  'celebration_seen_at',
  'participants track winner celebration claims'
);
select has_function('public', 'create_mini_game', array['text', 'smallint', 'smallint']);
select has_function('public', 'update_mini_game', array['uuid', 'text', 'smallint', 'smallint']);
select has_function('public', 'join_mini_game', array['uuid']);
select has_function('public', 'remove_mini_game_participant', array['uuid', 'uuid']);
select has_function('public', 'reshuffle_mini_game', array['uuid']);
select has_function('public', 'start_mini_game', array['uuid']);
select has_function('public', 'reveal_mini_game_turn', array['uuid']);
select has_function('public', 'reveal_mini_game_river', array['uuid']);
select has_function('public', 'delete_mini_game', array['uuid']);
select has_function('public', 'claim_mini_game_celebration', array['uuid']);
select has_function('public', 'get_current_mini_game', array[]::text[]);
select has_function('public', 'list_mini_game_history', array[]::text[]);
select has_function('public', 'get_mini_game_detail', array['uuid']);
select has_function('public', 'store_mini_game_equities', array['uuid', 'bigint', 'jsonb']);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-host-1@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Host One","role":"HOST"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-host-2@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Host Two","role":"HOST"}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-player-1@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ada","role":"PLAYER"}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-player-2@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ben","role":"PLAYER"}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-player-3@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Cleo","role":"PLAYER"}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mini-player-4@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Drew","role":"PLAYER"}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_mini_game('No Host Game', 2::smallint, 3::smallint)$$,
  'P0001',
  'Host privileges required.',
  'players cannot create a mini-game'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_mini_game('X', 2::smallint, 3::smallint)$$,
  'P0001',
  'Mini-game name must be between 2 and 40 characters.',
  'short names are rejected'
);
select throws_ok(
  $$select public.create_mini_game('Bad Limits', 5::smallint, 4::smallint)$$,
  'P0001',
  'Mini-game player limits must be between 2 and 10 with minimum not above maximum.',
  'invalid player limits are rejected'
);
select lives_ok(
  $$select public.create_mini_game('Friday Draw', 2::smallint, 3::smallint)$$,
  'creator host can open a game'
);
select is(
  (select count(*)::integer from public.mini_games where is_current and deleted_at is null),
  1,
  'only one visible current game exists'
);
reset role;
select throws_ok(
  $$
    insert into public.mini_game_cards (game_id, card_code)
    values (
      (select id from public.mini_games where is_current and deleted_at is null),
      'As'
    )
  $$,
  '23514',
  null,
  'a card must be assigned to an explicit hand or board slot'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_mini_game('Second Game', 2::smallint, 3::smallint)$$,
  'P0001',
  'Finish or delete the current mini-game before creating another.',
  'a second running current game is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    select public.update_mini_game(
      (select id from public.mini_games where is_current and deleted_at is null),
      'Hijacked',
      2::smallint,
      3::smallint
    )
  $$,
  'P0001',
  'Only the creator host can manage this mini-game.',
  'another host cannot control the game'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'an authenticated player can join'
);
select throws_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'P0001',
  'You already joined this mini-game.',
  'duplicate join is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'a second player can join'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'a third player can fill the game'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'P0001',
  'This mini-game is full.',
  'capacity races are enforced in the database'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select is(
  (select count(distinct card_code)::integer from public.mini_game_cards),
  6,
  'joined hands are globally unique'
);
select throws_ok(
  $$
    select public.update_mini_game(
      (select id from public.mini_games where is_current and deleted_at is null),
      'Friday Draw',
      2::smallint,
      2::smallint
    )
  $$,
  'P0001',
  'Maximum players cannot be lower than the joined player count.',
  'maximum cannot be lowered below the active count'
);
select lives_ok(
  $$
    select public.remove_mini_game_participant(
      (select game_id from public.mini_game_participants where user_id = '20000000-0000-0000-0000-000000000001'),
      (select id from public.mini_game_participants where user_id = '20000000-0000-0000-0000-000000000001')
    )
  $$,
  'creator can remove an open-game participant'
);
select is(
  (
    select count(*)::integer
    from public.mini_game_cards c
    join public.mini_game_participants p on p.id = c.participant_id
    where p.user_id = '20000000-0000-0000-0000-000000000001'
  ),
  0,
  'removed participant cards return to the deck'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'a removed player can rejoin'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.reshuffle_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'creator can atomically reshuffle an open game'
);
select is(
  (select count(*)::integer from public.mini_game_cards),
  6,
  'reshuffle keeps two cards for every active participant'
);
select is(
  (select count(distinct card_code)::integer from public.mini_game_cards),
  6,
  'reshuffled cards remain unique'
);
select lives_ok(
  $$select public.start_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'creator starts the game and reveals the flop'
);
select is(
  (select status::text from public.mini_games where is_current and deleted_at is null),
  'FLOP',
  'start advances to FLOP'
);
select is(
  (select count(*)::integer from public.mini_game_cards where board_position is not null),
  3,
  'only the flop is stored after start'
);
select throws_ok(
  $$select public.delete_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'P0001',
  'A running mini-game cannot be deleted.',
  'running games cannot be deleted'
);
select lives_ok(
  $$select public.reveal_mini_game_turn((select id from public.mini_games where is_current and deleted_at is null))$$,
  'creator reveals the turn'
);
select is(
  (select count(*)::integer from public.mini_game_cards where board_position is not null),
  4,
  'turn adds exactly one board card'
);
select lives_ok(
  $$select public.reveal_mini_game_river((select id from public.mini_games where is_current and deleted_at is null))$$,
  'creator reveals the river'
);
select is(
  (select status::text from public.mini_games where is_current and deleted_at is null),
  'COMPLETE',
  'river completes the game'
);
select is(
  (select count(distinct card_code)::integer from public.mini_game_cards),
  11,
  'all public hand and board cards remain unique'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select ok(
  public.claim_mini_game_celebration(
    (select id from public.mini_games where is_current and deleted_at is null)
  ),
  'an active participant claims celebration once'
);
select ok(
  not public.claim_mini_game_celebration(
    (select id from public.mini_games where is_current and deleted_at is null)
  ),
  'a second celebration claim is denied'
);
select is(
  jsonb_array_length(public.list_mini_game_history()),
  1,
  'the current completed game appears in history immediately'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(
  not public.store_mini_game_equities(
    (select id from public.mini_games where is_current and deleted_at is null),
    (select state_version - 1 from public.mini_games where is_current and deleted_at is null),
    '[]'::jsonb
  ),
  'stale equity writes are rejected without mutation'
);
select ok(
  public.store_mini_game_equities(
    (select id from public.mini_games where is_current and deleted_at is null),
    (select state_version from public.mini_games where is_current and deleted_at is null),
    (
      select jsonb_agg(
        jsonb_build_object(
          'participantId', ranked.id,
          'equityShare', 1.0 / 3.0,
          'displayPercentage', case when ranked.position = 1 then 33.4 else 33.3 end,
          'wins', 1,
          'ties', 0,
          'totalOutcomes', 3,
          'finalHandLabel', 'High Card'
        )
        order by ranked.position
      )
      from (
        select p.id, row_number() over (order by p.join_position) as position
        from public.mini_game_participants p
        where p.game_id = (select id from public.mini_games where is_current and deleted_at is null)
          and p.is_active
      ) ranked
    )
  ),
  'the service role stores a version-matched exact-equity result'
);
select is(
  (select sum(display_percentage) from public.mini_game_equities),
  100.0::numeric,
  'displayed equity totals exactly 100.0 percent'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$update public.mini_games set name = 'Direct write' where is_current$$,
  '42501',
  null,
  'authenticated clients cannot write mini-game tables directly'
);
select lives_ok(
  $$select public.create_mini_game('Next Deal', 2::smallint, 10::smallint)$$,
  'creating after completion archives the previous result'
);
select is(
  (select count(*)::integer from public.mini_games where is_current and deleted_at is null),
  1,
  'the new game is the sole current game'
);
select is(
  jsonb_array_length(public.list_mini_game_history()),
  1,
  'the archived completed game remains in history'
);
select lives_ok(
  $$select public.delete_mini_game((select id from public.mini_games where is_current and deleted_at is null))$$,
  'creator can soft-delete an open game'
);
select is(
  public.get_current_mini_game(),
  null::jsonb,
  'soft-deleted games disappear from the current dashboard'
);

reset role;
select * from finish();
rollback;
