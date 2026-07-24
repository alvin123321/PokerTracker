-- Complete manager table operations while preserving immutable financial history.

alter table public.session_players
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid,
  add column if not exists removed_by_name text;

create or replace function public.prevent_user_role_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'postgres'
    and auth.role() <> 'service_role'
  then
    if old.role is distinct from new.role then
      raise exception 'User role changes require service role privileges.';
    end if;

    if old.manager_host_id is distinct from new.manager_host_id then
      raise exception 'Manager host assignment changes require service role privileges.';
    end if;
  end if;

  return new;
end;
$$;

alter table public.transactions
  add column if not exists created_by_name text,
  add column if not exists updated_by_name text,
  add column if not exists deleted_by_name text;

update public.transactions as transaction
set created_by_name = coalesce(
  nullif(btrim(actor.display_name), ''),
  nullif(btrim(actor.username), ''),
  'Unknown user'
)
from public.users as actor
where actor.id = transaction.created_by
  and transaction.created_by_name is null;

update public.transactions as transaction
set updated_by_name = coalesce(
  nullif(btrim(actor.display_name), ''),
  nullif(btrim(actor.username), ''),
  'Unknown user'
)
from public.users as actor
where actor.id = transaction.updated_by
  and transaction.updated_by_name is null;

update public.transactions as transaction
set deleted_by_name = coalesce(
  nullif(btrim(actor.display_name), ''),
  nullif(btrim(actor.username), ''),
  'Unknown user'
)
from public.users as actor
where actor.id = transaction.deleted_by
  and transaction.deleted_by_name is null;

alter table public.transactions
  drop constraint if exists transactions_created_by_fkey,
  drop constraint if exists transactions_updated_by_fkey,
  drop constraint if exists transactions_deleted_by_fkey;

alter table public.transactions
  alter column created_by drop not null;

alter table public.transactions
  add constraint transactions_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null,
  add constraint transactions_updated_by_fkey
    foreign key (updated_by) references public.users(id) on delete set null,
  add constraint transactions_deleted_by_fkey
    foreign key (deleted_by) references public.users(id) on delete set null;

alter table public.session_players
drop constraint if exists session_players_unique_player;

create unique index if not exists session_players_active_player_unique_idx
on public.session_players(session_id, player_id)
where removed_at is null;

create index if not exists session_players_removed_at_idx
on public.session_players(removed_at);

create table public.transaction_revisions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  table_id uuid references public.session_tables(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  comment text,
  original_created_at timestamptz not null,
  action text not null default 'EDIT' check (action = 'EDIT'),
  action_at timestamptz not null default now(),
  action_by uuid not null,
  action_by_name text not null
);

create index transaction_revisions_transaction_id_idx
on public.transaction_revisions(transaction_id, action_at desc);

create index transaction_revisions_session_id_idx
on public.transaction_revisions(session_id);

create table public.session_financial_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  entry_type text not null check (entry_type in ('TIP', 'RAKE')),
  amount numeric(12, 2) not null check (amount > 0),
  manager_user_id uuid,
  manager_name text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  created_by_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_by_name text not null,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  constraint session_financial_entries_target_check check (
    (entry_type = 'TIP' and manager_user_id is not null and manager_name is not null)
    or
    (entry_type = 'RAKE' and manager_user_id is null and manager_name is null)
  )
);

create index session_financial_entries_session_id_idx
on public.session_financial_entries(session_id, created_at);

create index session_financial_entries_manager_user_id_idx
on public.session_financial_entries(manager_user_id)
where entry_type = 'TIP';

create index session_financial_entries_active_idx
on public.session_financial_entries(session_id, entry_type)
where deleted_at is null;

create table public.session_financial_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.session_financial_entries(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  entry_type text not null check (entry_type in ('TIP', 'RAKE')),
  amount numeric(12, 2) not null check (amount > 0),
  manager_user_id uuid,
  manager_name text,
  original_created_at timestamptz not null,
  action text not null default 'EDIT' check (action = 'EDIT'),
  action_at timestamptz not null default now(),
  action_by uuid not null,
  action_by_name text not null
);

create index session_financial_entry_revisions_entry_id_idx
on public.session_financial_entry_revisions(entry_id, action_at desc);

create index session_financial_entry_revisions_session_id_idx
on public.session_financial_entry_revisions(session_id);

create or replace function public.current_actor_display_name()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_name text;
begin
  perform public.assert_authenticated();

  select coalesce(
    nullif(btrim(actor.display_name), ''),
    nullif(btrim(actor.username), ''),
    'Unknown user'
  )
  into actor_name
  from public.users as actor
  where actor.id = auth.uid();

  return coalesce(actor_name, 'Unknown user');
end;
$$;

revoke all on function public.current_actor_display_name() from public, anon, authenticated;

create or replace function public.maintain_transaction_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid;
  actor_name text;
  target_session_status public.session_status;
  target_removed_at timestamptz;
  target_table_id uuid;
  financial_change boolean;
begin
  actor_id := auth.uid();

  select
    session.status,
    session_player.removed_at,
    session_player.table_id
  into
    target_session_status,
    target_removed_at,
    target_table_id
  from public.session_players as session_player
  join public.sessions as session on session.id = session_player.session_id
  where session_player.id = new.session_player_id;

  if target_removed_at is not null then
    raise exception 'Cannot modify transactions for a removed player.';
  end if;

  new.table_id := coalesce(new.table_id, target_table_id);

  if actor_id is null then
    return new;
  end if;

  actor_name := public.current_actor_display_name();

  if tg_op = 'INSERT' then
    new.created_by := actor_id;
    new.created_by_name := actor_name;
    new.updated_by := actor_id;
    new.updated_by_name := actor_name;
    return new;
  end if;

  financial_change :=
    old.amount is distinct from new.amount
    or old.comment is distinct from new.comment
    or old.deleted_at is distinct from new.deleted_at;

  if financial_change and target_session_status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot modify a transaction in a completed session.';
  end if;

  if old.deleted_at is not null
    and (
      old.amount is distinct from new.amount
      or old.comment is distinct from new.comment
    )
  then
    raise exception 'Deleted transactions cannot be edited.';
  end if;

  if old.amount is distinct from new.amount or old.comment is distinct from new.comment then
    insert into public.transaction_revisions (
      transaction_id,
      session_id,
      table_id,
      player_id,
      session_player_id,
      type,
      amount,
      comment,
      original_created_at,
      action_by,
      action_by_name
    )
    values (
      old.id,
      old.session_id,
      old.table_id,
      old.player_id,
      old.session_player_id,
      old.type,
      old.amount,
      old.comment,
      old.created_at,
      actor_id,
      actor_name
    );
  end if;

  new.updated_by := actor_id;
  new.updated_by_name := actor_name;

  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := actor_id;
    new.deleted_by_name := actor_name;
  end if;

  return new;
end;
$$;

revoke all on function public.maintain_transaction_audit() from public, anon, authenticated;

drop trigger if exists transactions_audit_actor on public.transactions;
create trigger transactions_audit_actor
before insert or update on public.transactions
for each row execute function public.maintain_transaction_audit();

create or replace function public.maintain_session_financial_entry_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid;
  actor_name text;
begin
  actor_id := auth.uid();

  if actor_id is null then
    return new;
  end if;

  actor_name := public.current_actor_display_name();

  if old.deleted_at is not null and old.amount is distinct from new.amount then
    raise exception 'Deleted accounting entries cannot be edited.';
  end if;

  if old.amount is distinct from new.amount then
    insert into public.session_financial_entry_revisions (
      entry_id,
      session_id,
      entry_type,
      amount,
      manager_user_id,
      manager_name,
      original_created_at,
      action_by,
      action_by_name
    )
    values (
      old.id,
      old.session_id,
      old.entry_type,
      old.amount,
      old.manager_user_id,
      old.manager_name,
      old.created_at,
      actor_id,
      actor_name
    );
  end if;

  new.updated_at := now();
  new.updated_by := actor_id;
  new.updated_by_name := actor_name;

  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := actor_id;
    new.deleted_by_name := actor_name;
  end if;

  return new;
end;
$$;

revoke all on function public.maintain_session_financial_entry_audit()
from public, anon, authenticated;

create trigger session_financial_entries_audit
before update on public.session_financial_entries
for each row execute function public.maintain_session_financial_entry_audit();

alter table public.transaction_revisions enable row level security;
alter table public.session_financial_entries enable row level security;
alter table public.session_financial_entry_revisions enable row level security;

revoke all on public.transaction_revisions from public, anon;
revoke all on public.session_financial_entries from public, anon;
revoke all on public.session_financial_entry_revisions from public, anon;

grant select on public.transaction_revisions to authenticated;
grant select on public.session_financial_entries to authenticated;
grant select on public.session_financial_entry_revisions to authenticated;

create or replace function public.current_manager_has_session_tip(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_role()::text = 'MANAGER'
    and exists (
      select 1
      from public.session_financial_entries as entry
      where entry.session_id = target_session_id
        and entry.entry_type = 'TIP'
        and entry.manager_user_id = auth.uid()
        and entry.deleted_at is null
    );
$$;

revoke all on function public.current_manager_has_session_tip(uuid) from public, anon;
grant execute on function public.current_manager_has_session_tip(uuid) to authenticated;

create or replace function public.session_belongs_to_current_operator(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sessions as session
    where session.id = target_session_id
      and session.host_id = public.current_operator_host_id()
      and (
        public.current_user_role()::text = 'HOST'
        or (
          public.current_user_role()::text = 'MANAGER'
          and session.status = 'ACTIVE'::public.session_status
        )
      )
  );
$$;

drop policy if exists "Operators can read managed sessions" on public.sessions;
create policy "Operators can read managed sessions"
on public.sessions
for select
to authenticated
using (
  host_id = public.current_operator_host_id()
  and (
    public.current_user_role()::text = 'HOST'
    or (
      public.current_user_role()::text = 'MANAGER'
      and status = 'ACTIVE'::public.session_status
    )
    or (
      public.current_user_role()::text = 'MANAGER'
      and status = 'COMPLETED'::public.session_status
      and public.current_manager_has_session_tip(id)
    )
  )
);

drop policy if exists "Players can read limited participated sessions" on public.sessions;
create policy "Players can read limited participated sessions"
on public.sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.session_players as session_player
    join public.players as player on player.id = session_player.player_id
    where session_player.session_id = sessions.id
      and session_player.removed_at is null
      and player.user_id = auth.uid()
  )
);

drop policy if exists "Operators can read session players for managed sessions"
on public.session_players;
create policy "Operators can read session players for managed sessions"
on public.session_players
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id));

drop policy if exists "Players can read their own session player rows"
on public.session_players;
create policy "Players can read their own session player rows"
on public.session_players
for select
to authenticated
using (
  removed_at is null
  and public.player_belongs_to_current_user(player_id)
);

drop policy if exists "Operators can read transactions for managed sessions"
on public.transactions;
create policy "Operators can read transactions for managed sessions"
on public.transactions
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id));

drop policy if exists "Players can read their own transactions" on public.transactions;
create policy "Players can read their own transactions"
on public.transactions
for select
to authenticated
using (
  public.player_belongs_to_current_user(player_id)
  and exists (
    select 1
    from public.session_players as session_player
    where session_player.id = transactions.session_player_id
      and session_player.removed_at is null
  )
);

drop policy if exists "Operators can read managed session tables" on public.session_tables;
create policy "Operators can read managed session tables"
on public.session_tables
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id));

create policy "Operators and owners can read transaction revisions"
on public.transaction_revisions
for select
to authenticated
using (
  public.session_belongs_to_current_operator(session_id)
  or (
    public.player_belongs_to_current_user(player_id)
    and exists (
      select 1
      from public.session_players as session_player
      where session_player.id = transaction_revisions.session_player_id
        and session_player.removed_at is null
    )
  )
);

create policy "Hosts and assigned managers can read session accounting"
on public.session_financial_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions as session
    where session.id = session_financial_entries.session_id
      and session.host_id = public.current_operator_host_id()
      and (
        public.current_user_role()::text = 'HOST'
        or (
          public.current_user_role()::text = 'MANAGER'
          and (
            (
              session_financial_entries.entry_type = 'TIP'
              and session_financial_entries.manager_user_id = auth.uid()
            )
            or (
              session_financial_entries.entry_type = 'RAKE'
              and session_financial_entries.created_by = auth.uid()
            )
          )
        )
      )
  )
);

create policy "Hosts and assigned managers can read session accounting revisions"
on public.session_financial_entry_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.session_financial_entries as entry
    where entry.id = session_financial_entry_revisions.entry_id
      and (
        exists (
          select 1
          from public.sessions as session
          where session.id = entry.session_id
            and session.host_id = public.current_operator_host_id()
            and (
              public.current_user_role()::text = 'HOST'
              or (
                public.current_user_role()::text = 'MANAGER'
                and (
                  (entry.entry_type = 'TIP' and entry.manager_user_id = auth.uid())
                  or (entry.entry_type = 'RAKE' and entry.created_by = auth.uid())
                )
              )
            )
        )
      )
  )
);

create or replace view public.session_summaries
with (security_invoker = true)
as
select
  session.id as session_id,
  session.host_id,
  session.name,
  session.session_date,
  session.status,
  session.created_at,
  session.closed_at,
  count(session_player.id)::integer as total_players,
  coalesce(sum(session_player.total_buy_in), 0)::numeric(12, 2) as total_buy_in,
  coalesce(sum(session_player.cash_out), 0)::numeric(12, 2) as total_cash_out,
  coalesce(sum(session_player.net), 0)::numeric(12, 2) as total_net
from public.sessions as session
left join public.session_players as session_player
  on session_player.session_id = session.id
  and session_player.removed_at is null
where session.host_id = auth.uid()
  and public.is_host()
group by session.id;

create or replace view public.player_session_results
with (security_invoker = true)
as
select
  session_player.id as session_player_id,
  session_player.session_id,
  player.id as player_id,
  player.user_id,
  session.name as session_name,
  session.session_date,
  session.status as session_status,
  session_player.status as player_status,
  session_player.total_buy_in,
  session_player.cash_out,
  session_player.net,
  session_player.joined_at,
  session_player.completed_at
from public.session_players as session_player
join public.players as player on player.id = session_player.player_id
join public.sessions as session on session.id = session_player.session_id
where player.user_id = auth.uid()
  and session_player.removed_at is null;

create or replace function public.player_public_table_summaries(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  active_player_count integer,
  total_active_player_chips numeric
)
language sql
security definer
set search_path = ''
as $$
  with current_player_seats as (
    select session_player.id, session_player.session_id, session_player.table_id
    from public.session_players as session_player
    join public.players as player on player.id = session_player.player_id
    where player.user_id = auth.uid()
      and session_player.removed_at is null
      and (p_session_ids is null or session_player.session_id = any(p_session_ids))
  )
  select
    current_player_seats.id as session_player_id,
    current_player_seats.session_id,
    current_player_seats.table_id,
    count(game_player.id) filter (
      where game_player.status = 'ACTIVE'
        and game_player.removed_at is null
    )::integer as active_player_count,
    coalesce(
      sum(game_player.total_buy_in) filter (
        where game_player.status = 'ACTIVE'
          and game_player.removed_at is null
      ),
      0
    )::numeric as total_active_player_chips
  from current_player_seats
  join public.session_players as game_player
    on game_player.session_id = current_player_seats.session_id
    and game_player.removed_at is null
  group by current_player_seats.id, current_player_seats.session_id, current_player_seats.table_id
  order by current_player_seats.session_id, current_player_seats.id;
$$;

create or replace function public.player_public_table_roster(p_session_ids uuid[] default null)
returns table (
  session_player_id uuid,
  session_id uuid,
  table_id uuid,
  player_name text,
  status public.session_player_status,
  is_net_leader boolean
)
language sql
security definer
set search_path = ''
as $$
  with current_player_sessions as (
    select distinct session_player.session_id
    from public.session_players as session_player
    join public.players as player on player.id = session_player.player_id
    where player.user_id = auth.uid()
      and session_player.removed_at is null
      and (p_session_ids is null or session_player.session_id = any(p_session_ids))
  ),
  ranked_game_players as (
    select
      game_player.id as session_player_id,
      game_player.session_id,
      game_player.table_id,
      player.name as player_name,
      game_player.status as player_status,
      session.status as session_status,
      game_player.net,
      max(game_player.net) over (
        partition by game_player.session_id, game_player.table_id
      ) as highest_net,
      count(*) over (
        partition by game_player.session_id, game_player.table_id, game_player.net
      ) as matching_net_count
    from current_player_sessions
    join public.sessions as session
      on session.id = current_player_sessions.session_id
    join public.session_players as game_player
      on game_player.session_id = current_player_sessions.session_id
      and game_player.removed_at is null
    join public.players as player on player.id = game_player.player_id
  )
  select
    ranked_game_players.session_player_id,
    ranked_game_players.session_id,
    ranked_game_players.table_id,
    ranked_game_players.player_name,
    ranked_game_players.player_status,
    ranked_game_players.session_status = 'COMPLETED'
      and ranked_game_players.net = ranked_game_players.highest_net
      and ranked_game_players.matching_net_count = 1 as is_net_leader
  from ranked_game_players
  order by
    ranked_game_players.session_id,
    case when ranked_game_players.player_status = 'ACTIVE' then 0 else 1 end,
    lower(ranked_game_players.player_name),
    ranked_game_players.session_player_id;
$$;

revoke all on function public.player_public_table_summaries(uuid[])
from public, anon, authenticated;
grant execute on function public.player_public_table_summaries(uuid[]) to authenticated;

revoke all on function public.player_public_table_roster(uuid[])
from public, anon, authenticated;
grant execute on function public.player_public_table_roster(uuid[]) to authenticated;

do $$
declare
  target_table text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach target_table in array array[
    'transaction_revisions',
    'session_financial_entries',
    'session_financial_entry_revisions'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end
$$;

create or replace function public.create_session_table(
  p_session_id uuid,
  p_name text default null
)
returns public.session_tables
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  next_table_number integer;
  clean_name text;
  created_table public.session_tables;
begin
  current_host_id := public.assert_host_admin();

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot add a table to a completed session.';
  end if;

  select coalesce(max(table_number), 0) + 1
  into next_table_number
  from public.session_tables
  where session_id = target_session.id;

  clean_name := nullif(btrim(coalesce(p_name, '')), '');
  clean_name := coalesce(clean_name, 'Table ' || next_table_number::text);

  insert into public.session_tables (session_id, name, table_number)
  values (target_session.id, clean_name, next_table_number)
  returning * into created_table;

  return created_table;
end;
$$;

create or replace function public.add_player_to_session(
  p_session_id uuid,
  p_table_id uuid,
  p_player_name text,
  p_buy_in numeric default 200,
  p_existing_player_id uuid default null,
  p_player_user_id uuid default null,
  p_comment text default null
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  target_session public.sessions;
  target_table public.session_tables;
  target_user public.users;
  target_player public.players;
  created_session_player public.session_players;
  clean_player_name text;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();
  clean_player_name := btrim(coalesce(p_player_name, ''));

  if p_buy_in is null or p_buy_in <= 0 then
    raise exception 'Buy-in amount must be greater than zero.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot add a player to a completed session.';
  end if;

  select *
  into target_table
  from public.session_tables
  where id = p_table_id
    and session_id = target_session.id
    and status = 'ACTIVE'::public.session_table_status;

  if target_table.id is null then
    raise exception 'Active table not found for this session.';
  end if;

  if p_player_user_id is not null then
    select *
    into target_user
    from public.users
    where id = p_player_user_id
      and role::text in ('PLAYER', 'MANAGER');

    if target_user.id is null then
      raise exception 'Registered player not found.';
    end if;

    clean_player_name := coalesce(
      nullif(clean_player_name, ''),
      nullif(target_user.display_name, ''),
      nullif(target_user.username, '')
    );

    select *
    into target_player
    from public.players
    where host_id = current_host_id
      and user_id = target_user.id;
  elsif p_existing_player_id is not null then
    select *
    into target_player
    from public.players
    where id = p_existing_player_id
      and host_id = current_host_id;

    if target_player.id is null then
      raise exception 'Player not found for this host.';
    end if;
  end if;

  if target_player.id is null then
    if length(clean_player_name) = 0 then
      raise exception 'Player name is required.';
    end if;

    insert into public.players (host_id, user_id, name)
    values (current_host_id, p_player_user_id, clean_player_name)
    on conflict (host_id, (lower(name))) do update
    set
      name = excluded.name,
      user_id = coalesce(public.players.user_id, excluded.user_id)
    returning * into target_player;
  end if;

  if exists (
    select 1
    from public.session_players as session_player
    where session_player.session_id = target_session.id
      and session_player.player_id = target_player.id
      and session_player.removed_at is null
  ) then
    raise exception 'Player is already in this session.';
  end if;

  insert into public.session_players (
    session_id,
    table_id,
    player_id,
    status,
    total_buy_in,
    cash_out,
    net
  )
  values (
    target_session.id,
    target_table.id,
    target_player.id,
    'ACTIVE'::public.session_player_status,
    p_buy_in,
    0,
    0 - p_buy_in
  )
  returning * into created_session_player;

  insert into public.transactions (
    session_id,
    table_id,
    player_id,
    session_player_id,
    type,
    amount,
    comment,
    created_by,
    created_by_name,
    updated_by,
    updated_by_name
  )
  values (
    target_session.id,
    target_table.id,
    target_player.id,
    created_session_player.id,
    'BUYIN'::public.transaction_type,
    p_buy_in,
    nullif(btrim(coalesce(p_comment, '')), ''),
    actor_id,
    actor_name,
    actor_id,
    actor_name
  );

  return created_session_player;
end;
$$;

create or replace function public.update_buy_in_transaction(
  p_transaction_id uuid,
  p_amount numeric,
  p_comment text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  target_transaction public.transactions;
  updated_transaction public.transactions;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();

  if p_amount is null or p_amount <= 0 then
    raise exception 'Buy-in amount must be greater than zero.';
  end if;

  select transaction.*
  into target_transaction
  from public.transactions as transaction
  join public.sessions as session on session.id = transaction.session_id
  join public.session_players as session_player
    on session_player.id = transaction.session_player_id
  where transaction.id = p_transaction_id
    and session.host_id = current_host_id
    and session.status = 'ACTIVE'::public.session_status
    and session_player.removed_at is null
    and transaction.deleted_at is null
    and transaction.type in (
      'BUYIN'::public.transaction_type,
      'REBUY'::public.transaction_type
    )
  for update of transaction;

  if target_transaction.id is null then
    raise exception 'Active buy-in transaction not found.';
  end if;

  update public.transactions
  set
    amount = p_amount,
    comment = nullif(btrim(coalesce(p_comment, '')), ''),
    updated_by = actor_id,
    updated_by_name = actor_name
  where id = target_transaction.id
  returning * into updated_transaction;

  perform public.recalculate_session_player_buy_in(target_transaction.session_player_id);

  return updated_transaction;
end;
$$;

create or replace function public.delete_buy_in_transaction(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  target_transaction public.transactions;
  updated_transaction public.transactions;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();

  select transaction.*
  into target_transaction
  from public.transactions as transaction
  join public.sessions as session on session.id = transaction.session_id
  join public.session_players as session_player
    on session_player.id = transaction.session_player_id
  where transaction.id = p_transaction_id
    and session.host_id = current_host_id
    and session.status = 'ACTIVE'::public.session_status
    and session_player.removed_at is null
    and transaction.deleted_at is null
    and transaction.type in (
      'BUYIN'::public.transaction_type,
      'REBUY'::public.transaction_type
    )
  for update of transaction;

  if target_transaction.id is null then
    raise exception 'Active buy-in transaction not found.';
  end if;

  update public.transactions
  set
    deleted_at = now(),
    deleted_by = actor_id,
    deleted_by_name = actor_name,
    updated_by = actor_id,
    updated_by_name = actor_name
  where id = target_transaction.id
  returning * into updated_transaction;

  perform public.recalculate_session_player_buy_in(target_transaction.session_player_id);

  return updated_transaction;
end;
$$;

create or replace function public.delete_cashout(p_session_player_id uuid)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  target_session_player public.session_players;
  target_cashout public.transactions;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();

  select session_player.*
  into target_session_player
  from public.session_players as session_player
  join public.sessions as session on session.id = session_player.session_id
  where session_player.id = p_session_player_id
    and session.host_id = current_host_id
    and session.status = 'ACTIVE'::public.session_status
    and session_player.removed_at is null
    and session_player.status = 'COMPLETED'::public.session_player_status
  for update of session_player;

  if target_session_player.id is null then
    raise exception 'Active cash-out not found.';
  end if;

  select transaction.*
  into target_cashout
  from public.transactions as transaction
  where transaction.session_player_id = target_session_player.id
    and transaction.type = 'CASHOUT'::public.transaction_type
    and transaction.deleted_at is null
  order by transaction.created_at desc
  limit 1
  for update;

  if target_cashout.id is null then
    raise exception 'Active cash-out not found.';
  end if;

  update public.transactions
  set
    deleted_at = now(),
    deleted_by = actor_id,
    deleted_by_name = actor_name,
    updated_by = actor_id,
    updated_by_name = actor_name
  where id = target_cashout.id;

  update public.session_players
  set
    status = 'ACTIVE'::public.session_player_status,
    cash_out = 0,
    net = 0 - total_buy_in,
    completed_at = null
  where id = target_session_player.id
  returning * into target_session_player;

  return target_session_player;
end;
$$;

create or replace function public.remove_session_player(p_session_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  target_session_player public.session_players;
  target_session public.sessions;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();

  select session_player.*
  into target_session_player
  from public.session_players as session_player
  join public.sessions as session on session.id = session_player.session_id
  where session_player.id = p_session_player_id
    and session.host_id = current_host_id
  for update of session_player;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_session_player.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot remove a player from a completed session.';
  end if;

  if target_session_player.removed_at is not null then
    return;
  end if;

  delete from public.time_calls
  where session_player_id = target_session_player.id;

  update public.session_players
  set
    removed_at = now(),
    removed_by = actor_id,
    removed_by_name = actor_name
  where id = target_session_player.id;
end;
$$;

create or replace function public.close_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  pending_player_count integer;
begin
  current_host_id := public.assert_host_admin();

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status = 'COMPLETED'::public.session_status then
    return target_session;
  end if;

  select count(*)
  into pending_player_count
  from public.session_players
  where session_id = target_session.id
    and removed_at is null
    and status <> 'COMPLETED'::public.session_player_status;

  if pending_player_count > 0 then
    raise exception 'Cash out all players before closing this session.';
  end if;

  update public.session_tables
  set
    status = 'CLOSED'::public.session_table_status,
    closed_at = coalesce(closed_at, now())
  where session_id = target_session.id
    and status <> 'CLOSED'::public.session_table_status;

  update public.sessions
  set
    status = 'COMPLETED'::public.session_status,
    closed_at = now()
  where id = target_session.id
  returning * into target_session;

  return target_session;
end;
$$;

revoke all on function public.create_session_table(uuid, text)
from public, anon, authenticated;
grant execute on function public.create_session_table(uuid, text) to authenticated;

revoke all on function public.add_player_to_session(uuid, uuid, text, numeric, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.add_player_to_session(uuid, uuid, text, numeric, uuid, uuid, text)
to authenticated;

revoke all on function public.update_buy_in_transaction(uuid, numeric, text)
from public, anon, authenticated;
grant execute on function public.update_buy_in_transaction(uuid, numeric, text)
to authenticated;

revoke all on function public.delete_buy_in_transaction(uuid)
from public, anon, authenticated;
grant execute on function public.delete_buy_in_transaction(uuid) to authenticated;

revoke all on function public.delete_cashout(uuid)
from public, anon, authenticated;
grant execute on function public.delete_cashout(uuid) to authenticated;

revoke all on function public.remove_session_player(uuid)
from public, anon, authenticated;
grant execute on function public.remove_session_player(uuid) to authenticated;

create or replace function public.record_session_financial_entry(
  p_session_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_manager_user_id uuid default null
)
returns public.session_financial_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  actor_role text;
  clean_entry_type text;
  target_session public.sessions;
  target_manager public.users;
  target_manager_id uuid;
  target_manager_name text;
  created_entry public.session_financial_entries;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();
  actor_role := public.current_user_role()::text;
  clean_entry_type := upper(btrim(coalesce(p_entry_type, '')));

  if clean_entry_type not in ('TIP', 'RAKE') then
    raise exception 'Accounting entry type must be TIP or RAKE.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Accounting amount must be greater than zero.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = p_session_id
    and host_id = current_host_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if actor_role = 'MANAGER' and target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Managers cannot modify completed-session accounting.';
  end if;

  if clean_entry_type = 'TIP' then
    if actor_role = 'MANAGER' then
      if p_manager_user_id is not null and p_manager_user_id <> actor_id then
        raise exception 'Managers can only record their own tips.';
      end if;

      target_manager_id := actor_id;
    else
      target_manager_id := p_manager_user_id;
    end if;

    select *
    into target_manager
    from public.users
    where id = target_manager_id
      and role::text = 'MANAGER'
      and manager_host_id = current_host_id;

    if target_manager.id is null then
      raise exception 'Assigned manager is required for a tip.';
    end if;

    target_manager_name := coalesce(
      nullif(btrim(target_manager.display_name), ''),
      nullif(btrim(target_manager.username), ''),
      'Unknown manager'
    );
  elsif p_manager_user_id is not null then
    raise exception 'Rake entries cannot be assigned to a manager.';
  end if;

  insert into public.session_financial_entries (
    session_id,
    entry_type,
    amount,
    manager_user_id,
    manager_name,
    created_by,
    created_by_name,
    updated_by,
    updated_by_name
  )
  values (
    target_session.id,
    clean_entry_type,
    p_amount,
    target_manager_id,
    target_manager_name,
    actor_id,
    actor_name,
    actor_id,
    actor_name
  )
  returning * into created_entry;

  return created_entry;
end;
$$;

create or replace function public.update_session_financial_entry(
  p_entry_id uuid,
  p_amount numeric
)
returns public.session_financial_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_role text;
  target_session_status public.session_status;
  target_entry public.session_financial_entries;
  updated_entry public.session_financial_entries;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_role := public.current_user_role()::text;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Accounting amount must be greater than zero.';
  end if;

  select entry.*
  into target_entry
  from public.session_financial_entries as entry
  join public.sessions as session on session.id = entry.session_id
  where entry.id = p_entry_id
    and session.host_id = current_host_id
  for update of entry;

  if target_entry.id is null or target_entry.deleted_at is not null then
    raise exception 'Active accounting entry not found.';
  end if;

  select status
  into target_session_status
  from public.sessions
  where id = target_entry.session_id;

  if actor_role = 'MANAGER' then
    if target_session_status <> 'ACTIVE'::public.session_status then
      raise exception 'Managers cannot modify completed-session accounting.';
    end if;

    if not (
      (target_entry.entry_type = 'TIP' and target_entry.manager_user_id = actor_id)
      or (target_entry.entry_type = 'RAKE' and target_entry.created_by = actor_id)
    ) then
      raise exception 'Managers can only modify their own accounting entries.';
    end if;
  end if;

  update public.session_financial_entries
  set amount = p_amount
  where id = target_entry.id
  returning * into updated_entry;

  return updated_entry;
end;
$$;

create or replace function public.delete_session_financial_entry(p_entry_id uuid)
returns public.session_financial_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  actor_id uuid;
  actor_name text;
  actor_role text;
  target_session_status public.session_status;
  target_entry public.session_financial_entries;
  deleted_entry public.session_financial_entries;
begin
  current_host_id := public.assert_host();
  actor_id := public.assert_authenticated();
  actor_name := public.current_actor_display_name();
  actor_role := public.current_user_role()::text;

  select entry.*
  into target_entry
  from public.session_financial_entries as entry
  join public.sessions as session on session.id = entry.session_id
  where entry.id = p_entry_id
    and session.host_id = current_host_id
  for update of entry;

  if target_entry.id is null or target_entry.deleted_at is not null then
    raise exception 'Active accounting entry not found.';
  end if;

  select status
  into target_session_status
  from public.sessions
  where id = target_entry.session_id;

  if actor_role = 'MANAGER' then
    if target_session_status <> 'ACTIVE'::public.session_status then
      raise exception 'Managers cannot modify completed-session accounting.';
    end if;

    if not (
      (target_entry.entry_type = 'TIP' and target_entry.manager_user_id = actor_id)
      or (target_entry.entry_type = 'RAKE' and target_entry.created_by = actor_id)
    ) then
      raise exception 'Managers can only modify their own accounting entries.';
    end if;
  end if;

  update public.session_financial_entries
  set
    deleted_at = now(),
    deleted_by = actor_id,
    deleted_by_name = actor_name
  where id = target_entry.id
  returning * into deleted_entry;

  return deleted_entry;
end;
$$;

revoke all on function public.record_session_financial_entry(uuid, text, numeric, uuid)
from public, anon, authenticated;
grant execute on function public.record_session_financial_entry(uuid, text, numeric, uuid)
to authenticated;

revoke all on function public.update_session_financial_entry(uuid, numeric)
from public, anon, authenticated;
grant execute on function public.update_session_financial_entry(uuid, numeric)
to authenticated;

revoke all on function public.delete_session_financial_entry(uuid)
from public, anon, authenticated;
grant execute on function public.delete_session_financial_entry(uuid)
to authenticated;

comment on table public.transaction_revisions
is 'Append-only snapshots captured before transaction amount or comment edits.';

comment on table public.session_financial_entries
is 'Audited session-level tip and rake entries. Tips target managers; rake belongs to the session.';

comment on column public.session_players.removed_at
is 'Soft-removal marker. Removed seats stay available to host and manager audit views.';

notify pgrst, 'reload schema';
