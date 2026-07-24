begin;

create extension if not exists pgtap with schema extensions;

select plan(65);

select has_table('public', 'transaction_revisions', 'transaction revision history exists');
select has_table('public', 'session_financial_entries', 'session accounting entries exist');
select has_table(
  'public',
  'session_financial_entry_revisions',
  'session accounting revision history exists'
);
select has_column('public', 'session_players', 'removed_at', 'seated players support soft removal');
select has_column(
  'public',
  'session_players',
  'removed_by_name',
  'seated-player removal preserves the actor name'
);
select has_function(
  'public',
  'record_session_financial_entry',
  array['uuid', 'text', 'numeric', 'uuid'],
  'session accounting entry RPC exists'
);
select has_function(
  'public',
  'update_session_financial_entry',
  array['uuid', 'numeric'],
  'session accounting update RPC exists'
);
select has_function(
  'public',
  'delete_session_financial_entry',
  array['uuid'],
  'session accounting delete RPC exists'
);
select has_function('public', 'delete_cashout', array['uuid'], 'cash-out delete RPC exists');
select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction_revisions'
  ),
  'transaction revisions are published through Supabase Realtime'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_financial_entries'
  ),
  'session accounting entries are published through Supabase Realtime'
);
select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'session_financial_entries'
  ),
  'session accounting entries enforce row-level security'
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
      and relation.relname = 'session_financial_entries'
      and privilege.grantee = 0
      and privilege.privilege_type = 'SELECT'
  ),
  'PUBLIC has no session accounting read grant'
);

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
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-feature-host@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"manager-feature-host","display_name":"Manager Feature Host","role":"HOST"}',
    now(),
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"manager-one","display_name":"Manager One","role":"MANAGER"}',
    now(),
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"manager-two","display_name":"Manager Two","role":"MANAGER"}',
    now(),
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-feature-player@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"manager-feature-player","display_name":"Feature Player","role":"PLAYER"}',
    now(),
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-feature-other-host@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"manager-feature-other-host","display_name":"Other Host","role":"HOST"}',
    now(),
    now()
  );

insert into public.users (id, username, display_name, role, manager_host_id)
values
  (
    '60000000-0000-0000-0000-000000000001',
    'manager-feature-host',
    'Manager Feature Host',
    'HOST',
    null
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    'manager-one',
    'Manager One',
    'MANAGER',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    'manager-two',
    'Manager Two',
    'MANAGER',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    'manager-feature-player',
    'Feature Player',
    'PLAYER',
    null
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    'manager-feature-other-host',
    'Other Host',
    'HOST',
    null
  );

insert into public.sessions (id, host_id, name, session_date, status, closed_at)
values
  (
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    'Manager Active Session',
    current_date,
    'ACTIVE',
    null
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    'Manager Completed Session',
    current_date - 1,
    'COMPLETED',
    now()
  );

insert into public.session_tables (id, session_id, name, status, table_number, closed_at)
values
  (
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    'Active Table',
    'ACTIVE',
    1,
    null
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    'Completed Table',
    'CLOSED',
    1,
    now()
  );

insert into public.players (id, user_id, host_id, name)
values
  (
    '63000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    'Manager One'
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000003',
    '60000000-0000-0000-0000-000000000001',
    'Manager Two'
  ),
  (
    '63000000-0000-0000-0000-000000000003',
    '60000000-0000-0000-0000-000000000004',
    '60000000-0000-0000-0000-000000000001',
    'Feature Player'
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
values
  (
    '64000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    'ACTIVE',
    100,
    0,
    -100,
    null
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000003',
    'ACTIVE',
    100,
    0,
    -100,
    null
  ),
  (
    '64000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    'COMPLETED',
    100,
    140,
    40,
    now()
  ),
  (
    '64000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000003',
    'COMPLETED',
    100,
    60,
    -40,
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
    '65000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000001',
    'BUYIN',
    100,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000003',
    '64000000-0000-0000-0000-000000000002',
    'BUYIN',
    100,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000003',
    'BUYIN',
    100,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000003',
    'CASHOUT',
    140,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000005',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000003',
    '64000000-0000-0000-0000-000000000004',
    'BUYIN',
    100,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000006',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000003',
    '64000000-0000-0000-0000-000000000004',
    'CASHOUT',
    60,
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $test$
    do $block$
    begin
      update public.users
      set manager_host_id = '60000000-0000-0000-0000-000000000005'::uuid
      where id = auth.uid();

      raise exception 'Manager host assignment update unexpectedly succeeded.';
    end;
    $block$
  $test$,
  'P0001',
  'Manager host assignment changes require service role privileges.',
  'manager cannot change their assigned host'
);
select is(
  (
    select manager_host_id
    from public.users
    where id = '60000000-0000-0000-0000-000000000002'
  ),
  '60000000-0000-0000-0000-000000000001'::uuid,
  'failed reassignment preserves the manager host'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $test$
    do $block$
    begin
      perform public.set_registered_user_role(
        '60000000-0000-0000-0000-000000000003'::uuid,
        'PLAYER'
      );
      perform public.set_registered_user_role(
        '60000000-0000-0000-0000-000000000003'::uuid,
        'MANAGER'
      );
    end;
    $block$
  $test$,
  'host can still assign manager roles through the controlled RPC'
);
select is(
  (
    select manager_host_id
    from public.users
    where id = '60000000-0000-0000-0000-000000000003'
  ),
  '60000000-0000-0000-0000-000000000001'::uuid,
  'controlled role assignment preserves the host relationship'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_session_table(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'Manager Table'
  )$$,
  'P0001',
  'Host privileges required.',
  'manager cannot create a table'
);
select lives_ok(
  $$select public.record_rebuy(
    '64000000-0000-0000-0000-000000000002'::uuid,
    50,
    'Manager rebuy'
  )$$,
  'manager can record a rebuy'
);
select is(
  (
    select created_by
    from public.transactions
    where session_player_id = '64000000-0000-0000-0000-000000000002'
      and type = 'REBUY'
  ),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'rebuy records the manager actor'
);
select is(
  (
    select created_by_name
    from public.transactions
    where session_player_id = '64000000-0000-0000-0000-000000000002'
      and type = 'REBUY'
  ),
  'Manager One',
  'rebuy preserves the manager display name'
);
select is(
  (
    select table_id
    from public.transactions
    where session_player_id = '64000000-0000-0000-0000-000000000002'
      and type = 'REBUY'
  ),
  '62000000-0000-0000-0000-000000000001'::uuid,
  'rebuy remains associated with the active table'
);
select lives_ok(
  $$select public.update_buy_in_transaction(
    '65000000-0000-0000-0000-000000000002'::uuid,
    120,
    'Corrected buy-in'
  )$$,
  'manager can edit a buy-in'
);
select is(
  (
    select amount
    from public.transactions
    where id = '65000000-0000-0000-0000-000000000002'
  ),
  120::numeric,
  'edited buy-in becomes the active amount'
);
select is(
  (
    select amount
    from public.transaction_revisions
    where transaction_id = '65000000-0000-0000-0000-000000000002'
  ),
  100::numeric,
  'buy-in revision preserves the old amount'
);
select is(
  (
    select action_by
    from public.transaction_revisions
    where transaction_id = '65000000-0000-0000-0000-000000000002'
  ),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'buy-in revision records the manager actor'
);
select is(
  (
    select action_by_name
    from public.transaction_revisions
    where transaction_id = '65000000-0000-0000-0000-000000000002'
  ),
  'Manager One',
  'buy-in revision preserves the manager display name'
);
select lives_ok(
  $$select public.delete_buy_in_transaction(
    '65000000-0000-0000-0000-000000000002'::uuid
  )$$,
  'manager can delete a buy-in'
);
select is(
  (
    select deleted_by
    from public.transactions
    where id = '65000000-0000-0000-0000-000000000002'
  ),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'deleted buy-in records the manager actor'
);
select is(
  (
    select total_buy_in
    from public.session_players
    where id = '64000000-0000-0000-0000-000000000002'
  ),
  50::numeric,
  'deleted buy-in is excluded from the player total'
);
select lives_ok(
  $$select public.record_cashout(
    '64000000-0000-0000-0000-000000000002'::uuid,
    80
  )$$,
  'manager can record a cash-out'
);
select lives_ok(
  $$select public.update_cashout(
    '64000000-0000-0000-0000-000000000002'::uuid,
    90
  )$$,
  'manager can edit a cash-out'
);
select is(
  (
    select amount
    from public.transaction_revisions
    where transaction_id = (
      select id
      from public.transactions
      where session_player_id = '64000000-0000-0000-0000-000000000002'
        and type = 'CASHOUT'
    )
  ),
  80::numeric,
  'cash-out revision preserves the old amount'
);
select lives_ok(
  $$select public.delete_cashout(
    '64000000-0000-0000-0000-000000000002'::uuid
  )$$,
  'manager can delete a cash-out'
);
select results_eq(
  $$
    select status::text, cash_out, net
    from public.session_players
    where id = '64000000-0000-0000-0000-000000000002'
  $$,
  $$values ('ACTIVE'::text, 0::numeric, -50::numeric)$$,
  'deleting a cash-out returns the player to active status'
);
select lives_ok(
  $$select public.remove_session_player(
    '64000000-0000-0000-0000-000000000002'::uuid
  )$$,
  'manager can remove a player from an active table'
);
select is(
  (
    select count(*)
    from public.session_players
    where id = '64000000-0000-0000-0000-000000000002'
      and removed_at is not null
      and removed_by = '60000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'removed player remains as attributed audit history'
);
select is(
  (
    select count(*)
    from public.transactions
    where session_player_id = '64000000-0000-0000-0000-000000000002'
  ),
  3::bigint,
  'removed player transactions remain in audit history'
);
select lives_ok(
  $$select public.add_player_to_session(
    '61000000-0000-0000-0000-000000000001'::uuid,
    '62000000-0000-0000-0000-000000000001'::uuid,
    'Feature Player',
    200,
    '63000000-0000-0000-0000-000000000003'::uuid,
    '60000000-0000-0000-0000-000000000004'::uuid,
    null
  )$$,
  'removed player can be seated again'
);
select is(
  (
    select count(*)
    from public.session_players
    where session_id = '61000000-0000-0000-0000-000000000001'
      and player_id = '63000000-0000-0000-0000-000000000003'
      and removed_at is null
  ),
  1::bigint,
  'reseated player has one active table entry'
);
select is(
  (
    select count(*)
    from public.session_players
    where session_id = '61000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'manager sees only their own completed participation row'
);
select is(
  (
    select count(*)
    from public.transactions
    where session_id = '61000000-0000-0000-0000-000000000002'
  ),
  2::bigint,
  'manager sees only their own completed transactions'
);
select lives_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'TIP',
    25,
    null
  )$$,
  'manager can record their own tip'
);
select lives_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'RAKE',
    100,
    null
  )$$,
  'manager can record session rake'
);
select throws_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'TIP',
    25,
    '60000000-0000-0000-0000-000000000003'::uuid
  )$$,
  'P0001',
  'Managers can only record their own tips.',
  'manager cannot record a tip for another manager'
);
select lives_ok(
  $$
    select public.update_session_financial_entry(
      (
        select id
        from public.session_financial_entries
        where session_id = '61000000-0000-0000-0000-000000000001'
          and entry_type = 'TIP'
      ),
      30
    )
  $$,
  'manager can edit their own tip'
);
select is(
  (
    select amount
    from public.session_financial_entry_revisions
    where entry_id = (
      select id
      from public.session_financial_entries
      where session_id = '61000000-0000-0000-0000-000000000001'
        and entry_type = 'TIP'
    )
  ),
  25::numeric,
  'tip revision preserves the old amount'
);
select lives_ok(
  $$
    select public.delete_session_financial_entry(
      (
        select id
        from public.session_financial_entries
        where session_id = '61000000-0000-0000-0000-000000000001'
          and entry_type = 'RAKE'
      )
    )
  $$,
  'manager can delete rake they recorded'
);
select is(
  (
    select count(*)
    from public.session_financial_entries
    where session_id = '61000000-0000-0000-0000-000000000001'
      and entry_type = 'RAKE'
      and deleted_at is not null
      and deleted_by = '60000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'deleted rake remains as attributed audit history'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000002'::uuid,
    'TIP',
    40,
    '60000000-0000-0000-0000-000000000002'::uuid
  )$$,
  'host can record a completed-session tip for a manager'
);
select lives_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000002'::uuid,
    'TIP',
    60,
    '60000000-0000-0000-0000-000000000003'::uuid
  )$$,
  'host can record a completed-session tip for a non-playing manager'
);
select lives_ok(
  $$
    select public.update_session_financial_entry(
      (
        select id
        from public.session_financial_entries
        where session_id = '61000000-0000-0000-0000-000000000002'
          and entry_type = 'TIP'
          and manager_user_id = '60000000-0000-0000-0000-000000000002'
      ),
      45
    )
  $$,
  'host can correct completed-session accounting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select amount
    from public.session_financial_entries
    where session_id = '61000000-0000-0000-0000-000000000002'
      and entry_type = 'TIP'
      and manager_user_id = '60000000-0000-0000-0000-000000000002'
  ),
  45::numeric,
  'manager can read their own completed-session tip'
);
select throws_ok(
  $$
    select public.update_session_financial_entry(
      (
        select id
        from public.session_financial_entries
        where session_id = '61000000-0000-0000-0000-000000000002'
          and entry_type = 'TIP'
      ),
      50
    )
  $$,
  'P0001',
  'Managers cannot modify completed-session accounting.',
  'manager cannot modify completed-session accounting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.sessions
    where id = '61000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'tip-only manager can read the completed session shell'
);
select is(
  (
    select count(*)
    from public.session_players
    where session_id = '61000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'tip-only manager cannot read completed-session player rows'
);
select is(
  (
    select count(*)
    from public.transactions
    where session_id = '61000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'tip-only manager cannot read completed-session transactions'
);
select is(
  (
    select count(*)
    from public.session_financial_entries
    where session_id = '61000000-0000-0000-0000-000000000002'
      and entry_type = 'TIP'
      and manager_user_id = '60000000-0000-0000-0000-000000000003'
  ),
  1::bigint,
  'tip-only manager can read only their assigned tip'
);
select is(
  (
    select count(*)
    from public.session_financial_entries
    where entry_type = 'TIP'
      and manager_user_id = '60000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'manager cannot read another manager tip'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.record_session_financial_entry(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'TIP',
    25,
    null
  )$$,
  'P0001',
  'Host or manager privileges required.',
  'regular player cannot record session accounting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.remove_session_player(
    '64000000-0000-0000-0000-000000000003'::uuid
  )$$,
  'P0001',
  'Cannot remove a player from a completed session.',
  'manager cannot remove a player from a completed session'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.create_session_table(
    '61000000-0000-0000-0000-000000000001'::uuid,
    'Host Table'
  )$$,
  'host can create a table'
);
select is(
  (
    select count(*)
    from public.session_financial_entries
    where entry_type = 'TIP'
      and deleted_at is null
  ),
  3::bigint,
  'host can read all active tip entries'
);

do $$
begin
  perform public.remove_session_player(
    '64000000-0000-0000-0000-000000000001'::uuid
  );
  perform public.remove_session_player(
    (
      select id
      from public.session_players
      where session_id = '61000000-0000-0000-0000-000000000001'::uuid
        and player_id = '63000000-0000-0000-0000-000000000003'::uuid
        and removed_at is null
    )
  );
end;
$$;

select lives_ok(
  $$select public.close_session(
    '61000000-0000-0000-0000-000000000001'::uuid
  )$$,
  'removed active players do not block session close'
);
select is(
  (
    select status::text
    from public.sessions
    where id = '61000000-0000-0000-0000-000000000001'
  ),
  'COMPLETED',
  'session closes after all remaining active seats are removed'
);

select * from finish();
rollback;
