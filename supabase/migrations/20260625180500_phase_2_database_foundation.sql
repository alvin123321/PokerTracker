-- PokerTrack Phase 2 database foundation.
-- Run with the Supabase migration runner so auth.uid() and auth.role() are available.

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('HOST', 'PLAYER');
create type public.session_status as enum ('ACTIVE', 'COMPLETED');
create type public.session_player_status as enum ('ACTIVE', 'COMPLETED');
create type public.transaction_type as enum ('BUYIN', 'REBUY', 'CASHOUT');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.user_role not null default 'PLAYER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  session_date date not null default current_date,
  status public.session_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint completed_sessions_have_closed_at
    check (status = 'ACTIVE' or closed_at is not null)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  host_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  status public.session_player_status not null default 'ACTIVE',
  total_buy_in numeric(12, 2) not null default 0 check (total_buy_in >= 0),
  cash_out numeric(12, 2) not null default 0 check (cash_out >= 0),
  net numeric(12, 2) not null default 0,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint session_players_unique_player unique (session_id, player_id),
  constraint completed_players_have_completed_at
    check (status = 'ACTIVE' or completed_at is not null)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict
);

create index users_role_idx on public.users(role);

create index sessions_host_id_idx on public.sessions(host_id);
create index sessions_status_idx on public.sessions(status);
create index sessions_session_date_idx on public.sessions(session_date desc);

create index players_user_id_idx on public.players(user_id);
create index players_host_id_idx on public.players(host_id);
create unique index players_host_name_unique_idx on public.players(host_id, lower(name));

create index session_players_session_id_idx on public.session_players(session_id);
create index session_players_player_id_idx on public.session_players(player_id);
create index session_players_status_idx on public.session_players(status);

create index transactions_session_id_idx on public.transactions(session_id);
create index transactions_player_id_idx on public.transactions(player_id);
create index transactions_session_player_id_idx on public.transactions(session_player_id);
create index transactions_type_idx on public.transactions(type);
create index transactions_created_at_idx on public.transactions(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

create or replace function public.prevent_user_role_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.role is distinct from new.role and auth.role() <> 'service_role' then
    raise exception 'User role changes require service role privileges.';
  end if;

  return new;
end;
$$;

create trigger users_prevent_role_change
before update on public.users
for each row execute function public.prevent_user_role_change();

create or replace function public.prevent_transaction_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Transactions are immutable.';
end;
$$;

create trigger transactions_prevent_update
before update on public.transactions
for each row execute function public.prevent_transaction_mutation();

create trigger transactions_prevent_delete
before delete on public.transactions
for each row execute function public.prevent_transaction_mutation();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
begin
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'PLAYER'));

  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when requested_role = 'HOST' then 'HOST'::public.user_role
      else 'PLAYER'::public.user_role
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.users.display_name, excluded.display_name);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_host()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'HOST'::public.user_role;
$$;

create or replace function public.session_belongs_to_current_host(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_session_id
      and s.host_id = auth.uid()
  );
$$;

create or replace function public.player_belongs_to_current_user(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and p.user_id = auth.uid()
  );
$$;

create or replace function public.assert_authenticated()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.assert_host()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
begin
  current_user_id := public.assert_authenticated();

  if not public.is_host() then
    raise exception 'Host privileges required.';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.create_session(
  p_name text,
  p_session_date date default current_date
)
returns public.sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  created_session public.sessions;
begin
  current_host_id := public.assert_host();

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Session name is required.';
  end if;

  insert into public.sessions (host_id, name, session_date)
  values (current_host_id, btrim(p_name), coalesce(p_session_date, current_date))
  returning * into created_session;

  return created_session;
end;
$$;

create or replace function public.add_player_to_session(
  p_session_id uuid,
  p_player_name text,
  p_buy_in numeric default 200,
  p_existing_player_id uuid default null,
  p_player_user_id uuid default null
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  target_player public.players;
  created_session_player public.session_players;
begin
  current_host_id := public.assert_host();

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

  if p_existing_player_id is not null then
    select *
    into target_player
    from public.players
    where id = p_existing_player_id
      and host_id = current_host_id;

    if target_player.id is null then
      raise exception 'Player not found for this host.';
    end if;
  else
    if length(btrim(coalesce(p_player_name, ''))) = 0 then
      raise exception 'Player name is required.';
    end if;

    insert into public.players (host_id, user_id, name)
    values (current_host_id, p_player_user_id, btrim(p_player_name))
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
    player_id,
    status,
    total_buy_in,
    cash_out,
    net
  )
  values (
    target_session.id,
    target_player.id,
    'ACTIVE'::public.session_player_status,
    p_buy_in,
    0,
    0 - p_buy_in
  )
  returning * into created_session_player;

  insert into public.transactions (
    session_id,
    player_id,
    session_player_id,
    type,
    amount,
    created_by
  )
  values (
    target_session.id,
    target_player.id,
    created_session_player.id,
    'BUYIN'::public.transaction_type,
    p_buy_in,
    current_host_id
  );

  return created_session_player;
end;
$$;

create or replace function public.record_rebuy(
  p_session_player_id uuid,
  p_amount numeric
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  target_session_player public.session_players;
begin
  current_host_id := public.assert_host();

  if p_amount is null or p_amount <= 0 then
    raise exception 'Rebuy amount must be greater than zero.';
  end if;

  select sp.*
  into target_session_player
  from public.session_players sp
  join public.sessions s on s.id = sp.session_id
  where sp.id = p_session_player_id
    and s.host_id = current_host_id
  for update of sp;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_session_player.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot record a rebuy in a completed session.';
  end if;

  if target_session_player.status <> 'ACTIVE'::public.session_player_status then
    raise exception 'Cannot record a rebuy for a completed player.';
  end if;

  insert into public.transactions (
    session_id,
    player_id,
    session_player_id,
    type,
    amount,
    created_by
  )
  values (
    target_session_player.session_id,
    target_session_player.player_id,
    target_session_player.id,
    'REBUY'::public.transaction_type,
    p_amount,
    current_host_id
  );

  update public.session_players
  set
    total_buy_in = total_buy_in + p_amount,
    net = cash_out - (total_buy_in + p_amount)
  where id = target_session_player.id
  returning * into target_session_player;

  return target_session_player;
end;
$$;

create or replace function public.record_cashout(
  p_session_player_id uuid,
  p_amount numeric
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  target_session_player public.session_players;
begin
  current_host_id := public.assert_host();

  if p_amount is null or p_amount < 0 then
    raise exception 'Cash-out amount cannot be negative.';
  end if;

  select sp.*
  into target_session_player
  from public.session_players sp
  join public.sessions s on s.id = sp.session_id
  where sp.id = p_session_player_id
    and s.host_id = current_host_id
  for update of sp;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_session_player.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot record a cash-out in a completed session.';
  end if;

  if target_session_player.status <> 'ACTIVE'::public.session_player_status then
    raise exception 'Player has already cashed out.';
  end if;

  insert into public.transactions (
    session_id,
    player_id,
    session_player_id,
    type,
    amount,
    created_by
  )
  values (
    target_session_player.session_id,
    target_session_player.player_id,
    target_session_player.id,
    'CASHOUT'::public.transaction_type,
    p_amount,
    current_host_id
  );

  update public.session_players
  set
    status = 'COMPLETED'::public.session_player_status,
    cash_out = p_amount,
    net = p_amount - total_buy_in,
    completed_at = now()
  where id = target_session_player.id
  returning * into target_session_player;

  return target_session_player;
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

  if target_session.status = 'COMPLETED'::public.session_status then
    return target_session;
  end if;

  update public.sessions
  set
    status = 'COMPLETED'::public.session_status,
    closed_at = now()
  where id = target_session.id
  returning * into target_session;

  return target_session;
end;
$$;

create or replace view public.session_summaries
with (security_invoker = true)
as
select
  s.id as session_id,
  s.host_id,
  s.name,
  s.session_date,
  s.status,
  s.created_at,
  s.closed_at,
  count(sp.id)::integer as total_players,
  coalesce(sum(sp.total_buy_in), 0)::numeric(12, 2) as total_buy_in,
  coalesce(sum(sp.cash_out), 0)::numeric(12, 2) as total_cash_out,
  coalesce(sum(sp.net), 0)::numeric(12, 2) as total_net
from public.sessions s
left join public.session_players sp on sp.session_id = s.id
where s.host_id = auth.uid()
  and public.is_host()
group by s.id;

create or replace view public.player_session_results
with (security_invoker = true)
as
select
  sp.id as session_player_id,
  sp.session_id,
  p.id as player_id,
  p.user_id,
  s.name as session_name,
  s.session_date,
  s.status as session_status,
  sp.status as player_status,
  sp.total_buy_in,
  sp.cash_out,
  sp.net,
  sp.joined_at,
  sp.completed_at
from public.session_players sp
join public.players p on p.id = sp.player_id
join public.sessions s on s.id = sp.session_id
where p.user_id = auth.uid();

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.players enable row level security;
alter table public.session_players enable row level security;
alter table public.transactions enable row level security;

create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "Users can insert their own profile"
on public.users
for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Hosts can read their own sessions"
on public.sessions
for select
to authenticated
using (host_id = auth.uid() and public.is_host());

create policy "Players can read limited participated sessions"
on public.sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where sp.session_id = sessions.id
      and p.user_id = auth.uid()
  )
);

create policy "Hosts can create their own sessions"
on public.sessions
for insert
to authenticated
with check (host_id = auth.uid() and public.is_host());

create policy "Hosts can update their own sessions"
on public.sessions
for update
to authenticated
using (host_id = auth.uid() and public.is_host())
with check (host_id = auth.uid() and public.is_host());

create policy "Hosts can read their players"
on public.players
for select
to authenticated
using (host_id = auth.uid() and public.is_host());

create policy "Players can read their own player row"
on public.players
for select
to authenticated
using (user_id = auth.uid());

create policy "Hosts can create players"
on public.players
for insert
to authenticated
with check (host_id = auth.uid() and public.is_host());

create policy "Hosts can update their players"
on public.players
for update
to authenticated
using (host_id = auth.uid() and public.is_host())
with check (host_id = auth.uid() and public.is_host());

create policy "Hosts can read session players for their sessions"
on public.session_players
for select
to authenticated
using (public.session_belongs_to_current_host(session_id) and public.is_host());

create policy "Players can read their own session player rows"
on public.session_players
for select
to authenticated
using (public.player_belongs_to_current_user(player_id));

create policy "Hosts can create session players for their sessions"
on public.session_players
for insert
to authenticated
with check (public.session_belongs_to_current_host(session_id) and public.is_host());

create policy "Hosts can update session players for their sessions"
on public.session_players
for update
to authenticated
using (public.session_belongs_to_current_host(session_id) and public.is_host())
with check (public.session_belongs_to_current_host(session_id) and public.is_host());

create policy "Hosts can read transactions for their sessions"
on public.transactions
for select
to authenticated
using (public.session_belongs_to_current_host(session_id) and public.is_host());

create policy "Players can read their own transactions"
on public.transactions
for select
to authenticated
using (public.player_belongs_to_current_user(player_id));

grant usage on schema public to anon, authenticated;
grant usage on type public.user_role to authenticated;
grant usage on type public.session_status to authenticated;
grant usage on type public.session_player_status to authenticated;
grant usage on type public.transaction_type to authenticated;
grant select, insert, update on public.users to authenticated;
grant select on public.sessions to authenticated;
grant select on public.players to authenticated;
grant select on public.session_players to authenticated;
grant select on public.transactions to authenticated;
grant select on public.session_summaries to authenticated;
grant select on public.player_session_results to authenticated;

grant execute on function public.create_session(text, date) to authenticated;
grant execute on function public.add_player_to_session(uuid, text, numeric, uuid, uuid) to authenticated;
grant execute on function public.record_rebuy(uuid, numeric) to authenticated;
grant execute on function public.record_cashout(uuid, numeric) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
