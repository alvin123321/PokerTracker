begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'active_table_revisions', 'active-table revision table exists');
select has_function('public', 'player_active_tables', array[]::text[], 'player directory RPC exists');
select has_function('public', 'bump_active_table_revision', array[]::text[], 'revision trigger function exists');
select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_table_revisions'
  ),
  'revision table is published through Supabase Realtime'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-host@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-host","display_name":"Active Table Host","role":"HOST"}',
    now(), now()
  ),
  (
    '42000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-player@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-player","display_name":"Active Table Player","role":"PLAYER"}',
    now(), now()
  );

insert into public.users (id, username, display_name, role)
values
  ('41000000-0000-0000-0000-000000000001', 'active-table-host', 'Active Table Host', 'HOST'),
  ('42000000-0000-0000-0000-000000000001', 'active-table-player', 'Active Table Player', 'PLAYER');

insert into public.sessions (id, host_id, name, session_date, status, created_at, closed_at)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'Active Session', current_date, 'ACTIVE', now() - interval '1 hour', null
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000001',
    'Completed Session', current_date - 1, 'COMPLETED', now() - interval '1 day', now()
  );

insert into public.session_tables (
  id, session_id, name, status, table_number, created_at, closed_at
)
values
  (
    '44000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    'Main Table', 'ACTIVE', 1, now() - interval '50 minutes', null
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000001',
    'Second Table', 'ACTIVE', 2, now() - interval '40 minutes', null
  ),
  (
    '44000000-0000-0000-0000-000000000003',
    '43000000-0000-0000-0000-000000000001',
    'Closed Table', 'CLOSED', 3, now() - interval '30 minutes', now()
  ),
  (
    '44000000-0000-0000-0000-000000000004',
    '43000000-0000-0000-0000-000000000002',
    'Completed Session Table', 'CLOSED', 1, now() - interval '1 day', now()
  );

create temporary table revision_observations (
  label text primary key,
  revision bigint not null
);

insert into revision_observations
select 'before_insert', revision from public.active_table_revisions where id = true;

insert into public.session_tables (id, session_id, name, status, table_number)
values (
  '44000000-0000-0000-0000-000000000005',
  '43000000-0000-0000-0000-000000000001',
  'Trigger Table', 'ACTIVE', 4
);

insert into revision_observations
select 'after_insert', revision from public.active_table_revisions where id = true;

update public.session_tables
set status = 'CLOSED', closed_at = now()
where id = '44000000-0000-0000-0000-000000000005';

insert into revision_observations
select 'after_close', revision from public.active_table_revisions where id = true;

grant select on revision_observations to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"42000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.player_active_tables()),
  2::bigint,
  'unseated player sees every active table'
);

select is(
  (select count(*) from public.player_active_tables() where table_name = 'Closed Table'),
  0::bigint,
  'closed tables are excluded'
);

select is(
  (select count(*) from public.player_active_tables() where session_name = 'Completed Session'),
  0::bigint,
  'completed sessions are excluded'
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
          and routines.routine_name = 'player_active_tables'
        limit 1
      )
      and parameters.parameter_mode = 'OUT'
    order by parameters.ordinal_position
  $$,
  $$
    values
      ('session_id'::text), ('session_name'::text), ('session_date'::text),
      ('session_created_at'::text), ('table_id'::text), ('table_name'::text),
      ('table_number'::text), ('table_created_at'::text)
  $$,
  'directory exposes public identity fields only'
);

select cmp_ok(
  (select revision from revision_observations where label = 'after_insert'),
  '>',
  (select revision from revision_observations where label = 'before_insert'),
  'creating a table increments the active-table revision'
);

select cmp_ok(
  (select revision from revision_observations where label = 'after_close'),
  '>',
  (select revision from revision_observations where label = 'after_insert'),
  'closing a table increments the active-table revision'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.player_active_tables()$$,
  'P0001',
  'Player access required.',
  'host account cannot call the player directory'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select * from public.player_active_tables()$$,
  '42501',
  'permission denied for function player_active_tables',
  'anonymous account cannot call the player directory'
);

select * from finish();
rollback;
