begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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
select ok(
  not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) as privilege
    where namespace.nspname = 'public'
      and relation.relname = 'active_table_revisions'
      and privilege.grantee = 0
      and privilege.privilege_type = 'SELECT'
  ),
  'PUBLIC has no revision-table read grant'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-host-a@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-host-a","display_name":"Active Table Host A","role":"HOST"}',
    now(), now()
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-host-b@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-host-b","display_name":"Active Table Host B","role":"HOST"}',
    now(), now()
  ),
  (
    '41000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-manager@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-manager","display_name":"Active Table Manager","role":"MANAGER"}',
    now(), now()
  ),
  (
    '42000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-player@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-player","display_name":"Active Table Player","role":"PLAYER"}',
    now(), now()
  ),
  (
    '45000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'active-table-roleless@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"active-table-roleless","display_name":"Active Table Roleless"}',
    now(), now()
  );

insert into public.users (id, username, display_name, role, manager_host_id)
values
  ('41000000-0000-0000-0000-000000000001', 'active-table-host-a', 'Active Table Host A', 'HOST', null),
  ('41000000-0000-0000-0000-000000000002', 'active-table-host-b', 'Active Table Host B', 'HOST', null),
  (
    '41000000-0000-0000-0000-000000000003',
    'active-table-manager', 'Active Table Manager', 'MANAGER',
    '41000000-0000-0000-0000-000000000001'
  ),
  ('42000000-0000-0000-0000-000000000001', 'active-table-player', 'Active Table Player', 'PLAYER', null);

insert into public.sessions (id, host_id, name, session_date, status, created_at, closed_at)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'Host A Active Session', '2026-07-15', 'ACTIVE', '2026-07-15T20:00:00Z', null
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    'Host B Active Session', '2026-07-14', 'ACTIVE', '2026-07-14T20:00:00Z', null
  ),
  (
    '43000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000001',
    'Completed Session', '2026-07-13', 'COMPLETED',
    '2026-07-13T20:00:00Z', '2026-07-13T23:00:00Z'
  ),
  (
    '43000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000001',
    'Closed Table Session', '2026-07-12', 'ACTIVE', '2026-07-12T20:00:00Z', null
  );

insert into public.session_tables (id, session_id, name, status, table_number, created_at, closed_at)
values
  (
    '44000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    'Host A Table', 'ACTIVE', 1, '2026-07-15T20:01:00Z', null
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000002',
    'Host B Table', 'ACTIVE', 1, '2026-07-14T20:01:00Z', null
  ),
  (
    '44000000-0000-0000-0000-000000000003',
    '43000000-0000-0000-0000-000000000003',
    'Completed Session Table', 'CLOSED', 1,
    '2026-07-13T20:01:00Z', '2026-07-13T23:00:00Z'
  ),
  (
    '44000000-0000-0000-0000-000000000004',
    '43000000-0000-0000-0000-000000000004',
    'Closed Table', 'CLOSED', 1, '2026-07-12T20:01:00Z', '2026-07-12T23:00:00Z'
  );

create temporary table revision_observations (
  sequence integer primary key,
  label text not null unique,
  revision bigint not null
);

insert into revision_observations
select 1, 'before_session_create', revision from public.active_table_revisions where id = true;

insert into public.sessions (id, host_id, name, session_date, status, created_at, closed_at)
values (
  '43000000-0000-0000-0000-000000000010',
  '41000000-0000-0000-0000-000000000001',
  'Session Lifecycle', '2026-07-11', 'COMPLETED',
  '2026-07-11T20:00:00Z', '2026-07-11T21:00:00Z'
);
insert into revision_observations
select 2, 'after_session_create', revision from public.active_table_revisions where id = true;

update public.sessions set status = 'ACTIVE', closed_at = null
where id = '43000000-0000-0000-0000-000000000010';
insert into revision_observations
select 3, 'after_session_activate', revision from public.active_table_revisions where id = true;

update public.sessions set status = 'COMPLETED', closed_at = '2026-07-11T22:00:00Z'
where id = '43000000-0000-0000-0000-000000000010';
insert into revision_observations
select 4, 'after_session_complete', revision from public.active_table_revisions where id = true;

delete from public.sessions where id = '43000000-0000-0000-0000-000000000010';
insert into revision_observations
select 5, 'after_session_delete', revision from public.active_table_revisions where id = true;

insert into public.session_tables (id, session_id, name, status, table_number, created_at, closed_at)
values (
  '44000000-0000-0000-0000-000000000010',
  '43000000-0000-0000-0000-000000000001',
  'Table Lifecycle', 'CLOSED', 99, '2026-07-15T20:02:00Z', '2026-07-15T20:03:00Z'
);
insert into revision_observations
select 6, 'after_table_create', revision from public.active_table_revisions where id = true;

update public.session_tables set status = 'ACTIVE', closed_at = null
where id = '44000000-0000-0000-0000-000000000010';
insert into revision_observations
select 7, 'after_table_activate', revision from public.active_table_revisions where id = true;

update public.session_tables set status = 'CLOSED', closed_at = '2026-07-15T20:04:00Z'
where id = '44000000-0000-0000-0000-000000000010';
insert into revision_observations
select 8, 'after_table_close', revision from public.active_table_revisions where id = true;

delete from public.session_tables where id = '44000000-0000-0000-0000-000000000010';
insert into revision_observations
select 9, 'after_table_delete', revision from public.active_table_revisions where id = true;

select cmp_ok(
  (select revision from revision_observations where label = 'after_session_create'), '>',
  (select revision from revision_observations where label = 'before_session_create'),
  'creating a session increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_session_activate'), '>',
  (select revision from revision_observations where label = 'after_session_create'),
  'activating a session increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_session_complete'), '>',
  (select revision from revision_observations where label = 'after_session_activate'),
  'completing a session increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_session_delete'), '>',
  (select revision from revision_observations where label = 'after_session_complete'),
  'deleting a session increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_table_create'), '>',
  (select revision from revision_observations where label = 'after_session_delete'),
  'creating a table increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_table_activate'), '>',
  (select revision from revision_observations where label = 'after_table_create'),
  'activating a table increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_table_close'), '>',
  (select revision from revision_observations where label = 'after_table_activate'),
  'closing a table increments the active-table revision'
);
select cmp_ok(
  (select revision from revision_observations where label = 'after_table_delete'), '>',
  (select revision from revision_observations where label = 'after_table_close'),
  'deleting a table increments the active-table revision'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"42000000-0000-0000-0000-000000000001","role":"authenticated"}', true
);
select results_eq(
  $$select session_name || ':' || table_name from public.player_active_tables()$$,
  $$values ('Host A Active Session:Host A Table'), ('Host B Active Session:Host B Table')$$,
  'registered player sees active tables owned by both hosts'
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
select is(
  (select count(*) from public.active_table_revisions),
  1::bigint,
  'registered player can read the singleton revision row'
);
select throws_ok(
  $$update public.active_table_revisions set revision = revision + 1 where id = true$$,
  '42501', null,
  'authenticated clients cannot write the revision table'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}', true
);
select throws_ok(
  $$select * from public.player_active_tables()$$,
  'P0001', 'Player access required.',
  'host account cannot call the application-global player directory'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated"}', true
);
select throws_ok(
  $$select * from public.player_active_tables()$$,
  'P0001', 'Player access required.',
  'manager account cannot call the application-global player directory'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"45000000-0000-0000-0000-000000000001","role":"authenticated"}', true
);
select throws_ok(
  $$select * from public.player_active_tables()$$,
  'P0001', 'Player access required.',
  'authenticated account without a profile cannot call the player directory'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.player_active_tables()$$,
  '42501', 'permission denied for function player_active_tables',
  'anonymous account cannot call the player directory'
);
select throws_ok(
  $$select * from public.active_table_revisions$$,
  '42501', null,
  'anonymous account cannot read the revision table'
);

select * from finish();
rollback;
