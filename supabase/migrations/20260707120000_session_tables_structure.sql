-- Rebuild session data around session-owned tables. This intentionally clears existing
-- session history so new table-scoped sessions can be entered cleanly. The player
-- directory is preserved: do not delete from public.players or public.users here.

delete from public.sessions;

create type public.session_table_status as enum ('ACTIVE', 'CLOSED');

create table public.session_tables (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  status public.session_table_status not null default 'ACTIVE',
  table_number integer not null check (table_number > 0),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint session_tables_unique_number unique (session_id, table_number),
  constraint session_tables_unique_name unique (session_id, name),
  constraint closed_tables_have_closed_at check (status = 'ACTIVE' or closed_at is not null)
);

alter table public.session_players
add column table_id uuid references public.session_tables(id) on delete restrict;

alter table public.transactions
add column table_id uuid references public.session_tables(id) on delete restrict;

create index session_tables_session_id_idx on public.session_tables(session_id);
create index session_tables_status_idx on public.session_tables(status);
create index session_players_table_id_idx on public.session_players(table_id);
create index transactions_table_id_idx on public.transactions(table_id);

alter table public.session_tables enable row level security;

create policy "Operators can read managed session tables"
on public.session_tables
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions s
    where s.id = session_tables.session_id
      and s.host_id = public.current_operator_host_id()
  )
);

grant select on public.session_tables to authenticated;

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
  current_host_id := public.assert_host();

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
  target_session public.sessions;
  target_table public.session_tables;
  target_user public.users;
  target_player public.players;
  created_session_player public.session_players;
  clean_player_name text;
begin
  current_host_id := public.assert_host();
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
    from public.session_players sp
    where sp.session_id = target_session.id
      and sp.player_id = target_player.id
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
    updated_by
  )
  values (
    target_session.id,
    target_table.id,
    target_player.id,
    created_session_player.id,
    'BUYIN'::public.transaction_type,
    p_buy_in,
    nullif(btrim(coalesce(p_comment, '')), ''),
    current_host_id,
    current_host_id
  );

  return created_session_player;
end;
$$;

create or replace function public.move_session_player_to_table(
  p_session_player_id uuid,
  p_table_id uuid
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session_player public.session_players;
  target_table public.session_tables;
begin
  current_host_id := public.assert_host();

  select sp.*
  into target_session_player
  from public.session_players sp
  join public.sessions s on s.id = sp.session_id
  where sp.id = p_session_player_id
    and s.host_id = current_host_id
  for update;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select st.*
  into target_table
  from public.session_tables st
  where st.id = p_table_id
    and st.session_id = target_session_player.session_id
    and st.status = 'ACTIVE'::public.session_table_status;

  if target_table.id is null then
    raise exception 'Active table not found for this session.';
  end if;

  update public.session_players
  set table_id = target_table.id
  where id = target_session_player.id
  returning * into target_session_player;

  return target_session_player;
end;
$$;

grant execute on function public.create_session_table(uuid, text) to authenticated;
grant execute on function public.add_player_to_session(uuid, uuid, text, numeric, uuid, uuid, text) to authenticated;
grant execute on function public.move_session_player_to_table(uuid, uuid) to authenticated;
