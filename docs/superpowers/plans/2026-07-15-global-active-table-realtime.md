# Global Active Table Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every active session table to every registered player account immediately, while preserving the current player-specific completed-game fallback when no active table exists.

**Architecture:** A security-definer RPC returns only public active session/table identity. A singleton revision table, updated by session and table triggers and published through Supabase Realtime, invalidates every authenticated player client without exposing source rows. `PokerStoreService` owns the directory state, while pure dashboard logic removes seated duplicates and a focused component renders unseated active tables.

**Tech Stack:** PostgreSQL 15, Supabase RLS/Postgres Changes/pgTAP, Angular signals and standalone components, Jasmine/Karma, TypeScript.

## Global Constraints

- Every registered `PLAYER` account sees every active table, even when not seated.
- Only session/table identity is public; rosters, buy-ins, cash-outs, transactions, chip totals, time calls, and completed history remain restricted.
- Seated players retain the existing detailed active-game card.
- Completed-game fallback behavior remains unchanged when no active table exists.
- Database changes must be applied and verified before the frontend is released or the branch is merged into `main`.
- Merge the completed feature with `git merge --no-ff codex/global-active-table-realtime`.

---

## File Structure

- Create `supabase/migrations/20260716002332_global_active_table_realtime.sql`: public-safe directory RPC, revision table, triggers, RLS, grants, and publication membership.
- Create `supabase/tests/database/global_active_table_realtime.test.sql`: authorization, filtering, invalidation, and publication regression coverage.
- Modify `src/app/features/host/data/poker-store.service.ts`: typed active-table state, RPC loading, role clearing, and revision subscription.
- Modify `src/app/features/host/data/poker-store.service.spec.ts`: service RPC mapping and role/error behavior.
- Modify `src/app/features/host/data/realtime.logic.ts`: centralize the subscribed session table names.
- Modify `src/app/features/host/data/realtime.logic.spec.ts`: verify the revision feed is subscribed.
- Modify `src/app/features/player/dashboard/player-dashboard.logic.ts`: filter and order unseated active tables.
- Modify `src/app/features/player/dashboard/player-dashboard.logic.spec.ts`: seated deduplication and stable ordering tests.
- Create `src/app/features/player/dashboard/player-active-table-card.component.ts`: compact live table/waiting-state presentation.
- Modify `src/app/features/player/dashboard/player-dashboard.page.ts`: live-state precedence and active-table rendering.
- Modify `src/app/features/player/dashboard/player-dashboard.page.spec.ts`: active-table visibility and completed-history fallback tests.

---

### Task 1: Public Active-Table Directory and Realtime Invalidation

**Files:**
- Modify: `supabase/migrations/20260716002332_global_active_table_realtime.sql`
- Create: `supabase/tests/database/global_active_table_realtime.test.sql`

**Interfaces:**
- Produces RPC: `public.player_active_tables()` returning `session_id`, `session_name`, `session_date`, `session_created_at`, `table_id`, `table_name`, `table_number`, and `table_created_at`.
- Produces Realtime source: `public.active_table_revisions` with singleton key `id = true`, `revision bigint`, and `updated_at timestamptz`.
- Produces trigger function: `public.bump_active_table_revision()`.

- [ ] **Step 1: Write the failing schema-contract pgTAP test**

Create the test with a transaction and these initial assertions:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

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

select * from finish();
rollback;
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
npx supabase db reset --no-seed
npx supabase test db supabase/tests/database/global_active_table_realtime.test.sql
```

Expected: pgTAP reports the missing revision table and functions.

- [ ] **Step 3: Add the minimum schema contract**

Add the table, stub RPC, trigger function, grants, RLS, and idempotent publication block:

```sql
create table public.active_table_revisions (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.active_table_revisions (id, revision)
values (true, 0)
on conflict (id) do nothing;

alter table public.active_table_revisions enable row level security;

create policy "Registered players can read active table revisions"
on public.active_table_revisions
for select
to authenticated
using (public.current_user_role()::text = 'PLAYER');

grant select on public.active_table_revisions to authenticated;

create or replace function public.player_active_tables()
returns table (
  session_id uuid,
  session_name text,
  session_date date,
  session_created_at timestamptz,
  table_id uuid,
  table_name text,
  table_number integer,
  table_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_role()::text <> 'PLAYER' then
    raise exception 'Player access required.';
  end if;

  return;
end;
$$;

revoke all on function public.player_active_tables() from public, anon, authenticated;
grant execute on function public.player_active_tables() to authenticated;

create or replace function public.bump_active_table_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.active_table_revisions
  set revision = revision + 1,
      updated_at = now()
  where id = true;

  return null;
end;
$$;

revoke all on function public.bump_active_table_revision() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach target_table in array array['session_tables', 'active_table_revisions']
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
end
$$;
```

- [ ] **Step 4: Re-run the contract test and verify GREEN**

Run the same reset and pgTAP commands. Expected: `4` assertions pass.

- [ ] **Step 5: Extend the pgTAP test with behavioral coverage and verify RED**

Replace the four-assertion test with a twelve-assertion test. Before switching roles, add explicit host/player fixtures and capture revision changes:

```sql
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
    select parameters.parameter_name::text
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
```

Expected RED: the stub RPC returns no rows and no triggers update the revision.

- [ ] **Step 6: Implement the directory query and statement triggers**

Replace the RPC body with:

```sql
begin
  if public.current_user_role()::text <> 'PLAYER' then
    raise exception 'Player access required.';
  end if;

  return query
  select
    sessions.id,
    sessions.name,
    sessions.session_date,
    sessions.created_at,
    session_tables.id,
    session_tables.name,
    session_tables.table_number,
    session_tables.created_at
  from public.sessions
  join public.session_tables on session_tables.session_id = sessions.id
  where sessions.status = 'ACTIVE'::public.session_status
    and session_tables.status = 'ACTIVE'::public.session_table_status
  order by
    sessions.session_date desc,
    sessions.created_at,
    session_tables.table_number,
    session_tables.id;
end;
```

Create separate statement triggers so status updates and insert/delete operations are explicit:

```sql
create trigger sessions_active_table_revision_insert_delete
after insert or delete on public.sessions
for each statement execute function public.bump_active_table_revision();

create trigger sessions_active_table_revision_status
after update of status on public.sessions
for each statement execute function public.bump_active_table_revision();

create trigger session_tables_active_table_revision_insert_delete
after insert or delete on public.session_tables
for each statement execute function public.bump_active_table_revision();

create trigger session_tables_active_table_revision_status
after update of status on public.session_tables
for each statement execute function public.bump_active_table_revision();

notify pgrst, 'reload schema';
```

- [ ] **Step 7: Run database verification and commit**

Run:

```powershell
npx supabase db reset --no-seed
npx supabase test db supabase/tests/database/global_active_table_realtime.test.sql
npx supabase db lint --level warning
```

Expected: the new pgTAP file passes and lint returns no new warnings.

Commit:

```powershell
git add supabase/migrations/20260716002332_global_active_table_realtime.sql supabase/tests/database/global_active_table_realtime.test.sql
git commit -m "feat: add global active table directory"
```

---

### Task 2: Store Loading and Realtime Refresh

**Files:**
- Modify: `src/app/features/host/data/poker-store.service.ts`
- Modify: `src/app/features/host/data/poker-store.service.spec.ts`
- Modify: `src/app/features/host/data/realtime.logic.ts`
- Modify: `src/app/features/host/data/realtime.logic.spec.ts`

**Interfaces:**
- Produces type: `PlayerActiveTable` with the eight RPC fields mapped to camelCase.
- Produces signal: `PokerStoreService.playerActiveTables`.
- Produces helper: `sessionRealtimeTables(): readonly string[]` including `active_table_revisions`.

- [ ] **Step 1: Write failing store and subscription tests**

Add a player-role service test that returns two rows from `rpc('player_active_tables')`, invokes `refreshSessions`, and expects:

```typescript
expect(store.playerActiveTables()).toEqual([
  {
    sessionId: 'session-a',
    sessionName: 'Friday Game',
    sessionDate: '2026-07-15',
    sessionCreatedAt: '2026-07-15T20:00:00.000Z',
    tableId: 'table-a',
    tableName: 'Main Table',
    tableNumber: 1,
    tableCreatedAt: '2026-07-15T20:01:00.000Z'
  }
]);
```

Add a realtime logic assertion:

```typescript
expect(sessionRealtimeTables()).toContain('active_table_revisions');
expect(sessionRealtimeTables()).toContain('session_tables');
```

- [ ] **Step 2: Run focused Angular tests and verify RED**

Run:

```powershell
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/host/data/poker-store.service.spec.ts --include=src/app/features/host/data/realtime.logic.spec.ts"
```

Expected: compilation fails because the signal/type/helper do not exist.

- [ ] **Step 3: Implement typed directory state and RPC loading**

Add the public model and private row model, then map the RPC response:

```typescript
export interface PlayerActiveTable {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionCreatedAt: string;
  tableId: string;
  tableName: string;
  tableNumber: number;
  tableCreatedAt: string;
}

interface PlayerActiveTableRow {
  session_id: string;
  session_name: string;
  session_date: string;
  session_created_at: string;
  table_id: string;
  table_name: string;
  table_number: number;
  table_created_at: string;
}
```

Add `playerActiveTablesSignal`, expose it read-only, and implement:

```typescript
private async refreshPlayerActiveTables(): Promise<void> {
  if (this.authState.role() !== 'PLAYER' || !this.shouldUseSupabase()) {
    this.playerActiveTablesSignal.set([]);
    return;
  }

  const { data, error } = await this.supabaseService.requireClient().rpc('player_active_tables');
  if (error) {
    throw error;
  }

  this.playerActiveTablesSignal.set(
    ((data ?? []) as PlayerActiveTableRow[]).map((row) => ({
      sessionId: row.session_id,
      sessionName: row.session_name,
      sessionDate: row.session_date,
      sessionCreatedAt: row.session_created_at,
      tableId: row.table_id,
      tableName: row.table_name,
      tableNumber: this.toNumber(row.table_number),
      tableCreatedAt: row.table_created_at
    }))
  );
}
```

Call it during every authoritative `refreshHostSessions` path, including the zero-session early return, and clear it on role change/sign-out.

- [ ] **Step 4: Centralize Realtime table names and subscribe to the revision**

Add:

```typescript
export function sessionRealtimeTables(): readonly string[] {
  return [
    'sessions',
    'session_tables',
    'players',
    'session_players',
    'transactions',
    'time_calls',
    'active_table_revisions'
  ];
}
```

Replace the service's inline array with this helper. The existing `handleChange` and audited `queueRealtimeRefresh()` path remain unchanged.

- [ ] **Step 5: Run focused tests and commit**

Run the focused command from Step 2. Expected: all focused specs pass.

Commit:

```powershell
git add src/app/features/host/data/poker-store.service.ts src/app/features/host/data/poker-store.service.spec.ts src/app/features/host/data/realtime.logic.ts src/app/features/host/data/realtime.logic.spec.ts
git commit -m "feat: sync player active table directory"
```

---

### Task 3: Player Dashboard Live-State Selection

**Files:**
- Modify: `src/app/features/player/dashboard/player-dashboard.logic.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.logic.spec.ts`

**Interfaces:**
- Consumes: `PlayerActiveTable` and active seated table IDs.
- Produces: `unseatedPlayerActiveTables(activeTables, seatedTableIds)`.

- [ ] **Step 1: Write failing ordering and deduplication tests**

Add tests that pass one seated table plus two public tables and expect only unseated tables, ordered by newest session date and table number:

```typescript
expect(
  unseatedPlayerActiveTables(
    [tableB2, tableA1, tableB1],
    new Set(['table-a-1'])
  ).map((table) => table.tableId)
).toEqual(['table-b-1', 'table-b-2']);
```

Also verify the input array is not mutated and an empty directory returns `[]`.

- [ ] **Step 2: Run the focused logic spec and verify RED**

Run:

```powershell
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/player/dashboard/player-dashboard.logic.spec.ts"
```

Expected: compilation fails because `unseatedPlayerActiveTables` does not exist.

- [ ] **Step 3: Implement the pure selector**

```typescript
export function unseatedPlayerActiveTables(
  activeTables: PlayerActiveTable[],
  seatedTableIds: ReadonlySet<string>
): PlayerActiveTable[] {
  return activeTables
    .filter((table) => !seatedTableIds.has(table.tableId))
    .sort(
      (left, right) =>
        right.sessionDate.localeCompare(left.sessionDate) ||
        left.sessionCreatedAt.localeCompare(right.sessionCreatedAt) ||
        left.tableNumber - right.tableNumber ||
        left.tableId.localeCompare(right.tableId)
    );
}
```

- [ ] **Step 4: Run the logic spec and commit**

Expected: the focused logic spec passes.

```powershell
git add src/app/features/player/dashboard/player-dashboard.logic.ts src/app/features/player/dashboard/player-dashboard.logic.spec.ts
git commit -m "feat: select unseated active tables"
```

---

### Task 4: Unseated Active-Table UI and Completed Fallback

**Files:**
- Create: `src/app/features/player/dashboard/player-active-table-card.component.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.page.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.page.spec.ts`

**Interfaces:**
- Consumes required input: `table: PlayerActiveTable`.
- Renders `.player-active-table-card`, `.player-active-table-name`, and `.player-active-table-waiting` test hooks.

- [ ] **Step 1: Write failing page tests**

Add a `WritableSignal<PlayerActiveTable[]>` to the mocked store. Test these states:

```typescript
playerActiveTables.set([makeActiveTable()]);
sessions.set([makeSession({ status: 'COMPLETED', players: [makePlayer({ status: 'COMPLETED' })] })]);
queryParamMap.next(convertToParamMap({ tab: 'overview' }));
fixture.detectChanges();

expect(compiled.querySelector('.player-active-table-card')).not.toBeNull();
expect(compiled.querySelector('.player-active-table-name')?.textContent).toContain('Main Table');
expect(compiled.querySelector('.player-feature-card-completed')).toBeNull();
```

Then clear the directory and assert the completed feature card returns. Add a seated active session using the same table ID and assert the unseated card is not duplicated.

- [ ] **Step 2: Run the page spec and verify RED**

Run:

```powershell
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/player/dashboard/player-dashboard.page.spec.ts"
```

Expected: tests fail because the component and directory rendering do not exist.

- [ ] **Step 3: Implement the focused active-table card**

Create a standalone component with a required `PlayerActiveTable` input and this semantic structure:

```html
<article class="player-active-table-card">
  <div class="player-active-table-status">
    <span class="status-live-dot" aria-hidden="true"></span>
    <span>Active table</span>
  </div>
  <div>
    <h2 class="player-active-table-name">{{ table().tableName }}</h2>
    <p>{{ table().sessionName }} · Table {{ table().tableNumber }}</p>
  </div>
  <span class="player-active-table-waiting">Waiting to be seated</span>
</article>
```

Use the existing green live-state palette, an `8px` or smaller radius, stable dimensions, and responsive text wrapping. Do not show player counts, chips, buy-ins, or a detail link.

- [ ] **Step 4: Integrate live-state precedence in the page**

Import the component and selector. Add:

```typescript
protected readonly seatedActiveTableIds = computed(
  () => new Set(this.activeEntries().map((entry) => entry.player.tableId).filter(Boolean) as string[])
);

protected readonly unseatedActiveTables = computed(() =>
  unseatedPlayerActiveTables(this.store.playerActiveTables(), this.seatedActiveTableIds())
);

protected readonly hasLiveTables = computed(
  () => this.activeEntries().length > 0 || this.unseatedActiveTables().length > 0
);

protected readonly featuredEntry = computed(
  () => this.activeEntries()[0] ?? (this.hasLiveTables() ? null : this.entries()[0] ?? null)
);
```

Render all unseated active tables before the completed fallback. Preserve the existing detailed card for seated active entries and the current empty state when neither live nor historical content exists.

- [ ] **Step 5: Run focused tests and commit**

Run the page spec from Step 2. Expected: all page tests pass.

Commit:

```powershell
git add src/app/features/player/dashboard/player-active-table-card.component.ts src/app/features/player/dashboard/player-dashboard.page.ts src/app/features/player/dashboard/player-dashboard.page.spec.ts
git commit -m "feat: show active tables to all players"
```

---

### Task 5: Full Verification, Migration Application, and Merge Readiness

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run complete local verification**

```powershell
npm run test:ci
npm run build
npx supabase db reset --no-seed
npx supabase test db
npx supabase db lint --level warning
git diff --check main...HEAD
```

Expected: all Angular and database tests pass, the build succeeds with no new warnings, database lint reports no new findings, and diff check is clean.

- [ ] **Step 2: Render both mobile states**

Start the feature server on an unused port and verify at `390x844`:

- an unseated player sees every active table without horizontal overflow;
- the waiting state is readable and contains no private poker data;
- a seated table is not duplicated;
- closing the final table restores the existing completed-game card; and
- browser console output contains no new errors.

- [ ] **Step 3: Apply and verify the production migration before frontend release**

Apply `20260716002332_global_active_table_realtime.sql` through the linked Supabase project. Then verify `player_active_tables()` and publication membership with read-only SQL and run security/performance advisors.

Do not merge or push `main` if the migration cannot be applied and verified.

- [ ] **Step 4: Run the two-account production smoke test**

Keep a registered, unseated player dashboard open while a host creates an active table. Confirm the table appears without refresh. Close the final table and confirm the player's previous completed game returns without refresh.

- [ ] **Step 5: Review, commit any verification fixes, and merge with a merge commit**

After the final code review has no findings:

```powershell
git checkout main
git pull --ff-only origin main
git merge --no-ff codex/global-active-table-realtime
git push origin main
```

The merge commit must have `main` and `codex/global-active-table-realtime` as separate parents.
