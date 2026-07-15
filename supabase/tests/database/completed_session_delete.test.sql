begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'completed-session-host@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Completed Session Host","role":"HOST"}',
    now(),
    now()
  ),
  (
    '33000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'completed-session-player@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Registered Player","role":"PLAYER"}',
    now(),
    now()
  );

insert into public.users (id, username, display_name, role)
values
  (
    '30000000-0000-0000-0000-000000000001',
    'completed-session-host',
    'Completed Session Host',
    'HOST'
  ),
  (
    '33000000-0000-0000-0000-000000000001',
    'completed-session-player',
    'Registered Player',
    'PLAYER'
  );

insert into public.players (id, user_id, host_id, name)
values (
  '32000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Registered Player'
);

insert into public.sessions (id, host_id, name, session_date, status, closed_at)
values (
  '31000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Completed Session',
  current_date,
  'COMPLETED',
  now()
);

insert into public.session_tables (id, session_id, name, status, table_number, closed_at)
values (
  '34000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'Table 1',
  'CLOSED',
  1,
  now()
);

insert into public.session_players (
  id,
  session_id,
  table_id,
  player_id,
  status,
  total_buy_in,
  cash_out,
  net,
  completed_at
)
values (
  '35000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'COMPLETED',
  100.00,
  150.00,
  50.00,
  now()
);

insert into public.transactions (
  id,
  session_id,
  table_id,
  player_id,
  session_player_id,
  type,
  amount,
  created_by,
  updated_by
)
values
  (
    '36000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    '35000000-0000-0000-0000-000000000001',
    'BUYIN',
    100.00,
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '36000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    '35000000-0000-0000-0000-000000000001',
    'CASHOUT',
    150.00,
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  );

insert into public.time_calls (
  id,
  session_id,
  session_player_id,
  status,
  started_at,
  expires_at,
  resolved_at,
  resolved_by
)
values (
  '37000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  'FINISHED',
  now() - interval '2 minutes',
  now() - interval '1 minute',
  now(),
  '30000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.delete_session('31000000-0000-0000-0000-000000000001'::uuid)$$,
  'owning host can delete a completed session'
);

select is((select count(*) from public.sessions where id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'session removed');
select is((select count(*) from public.session_tables where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'tables removed');
select is((select count(*) from public.session_players where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'participation removed');
select is((select count(*) from public.transactions where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'transactions removed');
select is((select count(*) from public.time_calls where session_id = '31000000-0000-0000-0000-000000000001'), 0::bigint, 'time calls removed');
select is((select count(*) from public.players where id = '32000000-0000-0000-0000-000000000001'), 1::bigint, 'registered player retained');

reset role;
select * from finish();
rollback;
