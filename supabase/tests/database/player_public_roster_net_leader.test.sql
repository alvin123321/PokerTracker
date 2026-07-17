begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '46000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'roster-host@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"roster-host","display_name":"Roster Host","role":"HOST"}',
    now(), now()
  ),
  (
    '46000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'roster-player-one@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"roster-player-one","display_name":"Player One","role":"PLAYER"}',
    now(), now()
  ),
  (
    '46000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'roster-player-two@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"roster-player-two","display_name":"Player Two","role":"PLAYER"}',
    now(), now()
  ),
  (
    '46000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'roster-player-three@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"roster-player-three","display_name":"Player Three","role":"PLAYER"}',
    now(), now()
  );

insert into public.users (id, username, display_name, role, manager_host_id)
values
  ('46000000-0000-0000-0000-000000000001', 'roster-host', 'Roster Host', 'HOST', null),
  ('46000000-0000-0000-0000-000000000002', 'roster-player-one', 'Player One', 'PLAYER', null),
  ('46000000-0000-0000-0000-000000000003', 'roster-player-two', 'Player Two', 'PLAYER', null),
  ('46000000-0000-0000-0000-000000000004', 'roster-player-three', 'Player Three', 'PLAYER', null);

insert into public.players (id, user_id, host_id, name)
values
  (
    '47000000-0000-0000-0000-000000000001',
    '46000000-0000-0000-0000-000000000002',
    '46000000-0000-0000-0000-000000000001',
    'Player One'
  ),
  (
    '47000000-0000-0000-0000-000000000002',
    '46000000-0000-0000-0000-000000000003',
    '46000000-0000-0000-0000-000000000001',
    'Player Two'
  ),
  (
    '47000000-0000-0000-0000-000000000003',
    '46000000-0000-0000-0000-000000000004',
    '46000000-0000-0000-0000-000000000001',
    'Player Three'
  );

insert into public.sessions (id, host_id, name, session_date, status, closed_at)
values (
  '48000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001',
  'Roster Session', current_date, 'COMPLETED', now()
);

insert into public.session_tables (id, session_id, name, status, table_number, closed_at)
values
  (
    '49000000-0000-0000-0000-000000000001',
    '48000000-0000-0000-0000-000000000001',
    'Table One', 'CLOSED', 1, now()
  ),
  (
    '49000000-0000-0000-0000-000000000002',
    '48000000-0000-0000-0000-000000000001',
    'Table Two', 'CLOSED', 2, now()
  );

insert into public.session_players (
  id, session_id, table_id, player_id, status, total_buy_in, cash_out, net, completed_at
)
values
  (
    '4a000000-0000-0000-0000-000000000001',
    '48000000-0000-0000-0000-000000000001',
    '49000000-0000-0000-0000-000000000001',
    '47000000-0000-0000-0000-000000000001',
    'COMPLETED', 300, 350, 50, now()
  ),
  (
    '4a000000-0000-0000-0000-000000000002',
    '48000000-0000-0000-0000-000000000001',
    '49000000-0000-0000-0000-000000000001',
    '47000000-0000-0000-0000-000000000002',
    'COMPLETED', 300, 420, 120, now()
  ),
  (
    '4a000000-0000-0000-0000-000000000003',
    '48000000-0000-0000-0000-000000000001',
    '49000000-0000-0000-0000-000000000002',
    '47000000-0000-0000-0000-000000000003',
    'COMPLETED', 300, 280, -20, now()
  );

select ok(
  not has_function_privilege('anon', 'public.player_public_table_roster(uuid[])', 'EXECUTE'),
  'anonymous clients cannot call the player roster RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"46000000-0000-0000-0000-000000000002","role":"authenticated"}', true
);

select results_eq(
  $$
    select parameters.parameter_name::text collate "default"
    from information_schema.parameters
    where parameters.specific_schema = 'public'
      and parameters.specific_name = (
        select routines.specific_name
        from information_schema.routines
        where routines.specific_schema = 'public'
          and routines.routine_name = 'player_public_table_roster'
        limit 1
      )
      and parameters.parameter_mode = 'OUT'
    order by parameters.ordinal_position
  $$,
  $$
    values
      ('session_player_id'::text), ('session_id'::text), ('table_id'::text),
      ('player_name'::text), ('status'::text), ('is_net_leader'::text)
  $$,
  'public roster exposes the leader flag without exposing raw net'
);

select results_eq(
  $$
    select player_name, is_net_leader
    from public.player_public_table_roster(
      array['48000000-0000-0000-0000-000000000001']::uuid[]
    )
    order by player_name
  $$,
  $$
    values
      ('Player One'::text, false),
      ('Player Three'::text, true),
      ('Player Two'::text, true)
  $$,
  'a completed table exposes its one unique highest-net player'
);

set local role postgres;

update public.session_players
set net = 120
where id = '4a000000-0000-0000-0000-000000000001';

set local role authenticated;

select results_eq(
  $$
    select player_name, is_net_leader
    from public.player_public_table_roster(
      array['48000000-0000-0000-0000-000000000001']::uuid[]
    )
    order by player_name
  $$,
  $$
    values
      ('Player One'::text, false),
      ('Player Three'::text, true),
      ('Player Two'::text, false)
  $$,
  'a tied completed-table maximum does not expose a leader'
);

set local role postgres;

update public.sessions
set status = 'ACTIVE', closed_at = null
where id = '48000000-0000-0000-0000-000000000001';

set local role authenticated;

select results_eq(
  $$
    select player_name, is_net_leader
    from public.player_public_table_roster(
      array['48000000-0000-0000-0000-000000000001']::uuid[]
    )
    order by player_name
  $$,
  $$
    values
      ('Player One'::text, false),
      ('Player Three'::text, false),
      ('Player Two'::text, false)
  $$,
  'an active session does not expose a net leader'
);

select * from finish();

rollback;
