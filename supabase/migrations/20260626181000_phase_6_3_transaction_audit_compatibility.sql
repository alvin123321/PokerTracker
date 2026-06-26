-- PokerTrack Phase 6.3 backend compatibility.
-- Adds transaction comments, soft deletion, and host-only edit RPCs for the current UI.

alter table public.transactions
  add column if not exists comment text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.users(id) on delete restrict,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete restrict;

comment on column public.transactions.comment is 'Optional host note shown beside buy-ins and rebuys.';
comment on column public.transactions.deleted_at is 'Soft-delete marker. Deleted transactions remain visible for audit history.';

create index if not exists transactions_deleted_at_idx
on public.transactions(deleted_at);

create index if not exists transactions_active_buyin_idx
on public.transactions(session_player_id, created_at)
where type in ('BUYIN', 'REBUY') and deleted_at is null;

drop trigger if exists transactions_prevent_update on public.transactions;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create or replace function public.recalculate_session_player_buy_in(p_session_player_id uuid)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recalculated_total numeric(12, 2);
  target_session_player public.session_players;
begin
  select coalesce(sum(t.amount), 0)::numeric(12, 2)
  into recalculated_total
  from public.transactions t
  where t.session_player_id = p_session_player_id
    and t.type in ('BUYIN'::public.transaction_type, 'REBUY'::public.transaction_type)
    and t.deleted_at is null;

  update public.session_players
  set
    total_buy_in = recalculated_total,
    net = cash_out - recalculated_total
  where id = p_session_player_id
  returning * into target_session_player;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  return target_session_player;
end;
$$;

revoke all on function public.recalculate_session_player_buy_in(uuid) from public, anon, authenticated;

drop function if exists public.add_player_to_session(uuid, text, numeric, uuid, uuid);

create or replace function public.add_player_to_session(
  p_session_id uuid,
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
    comment,
    created_by,
    updated_by
  )
  values (
    target_session.id,
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

drop function if exists public.record_rebuy(uuid, numeric);

create or replace function public.record_rebuy(
  p_session_player_id uuid,
  p_amount numeric,
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
    comment,
    created_by,
    updated_by
  )
  values (
    target_session_player.session_id,
    target_session_player.player_id,
    target_session_player.id,
    'REBUY'::public.transaction_type,
    p_amount,
    nullif(btrim(coalesce(p_comment, '')), ''),
    current_host_id,
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
  target_transaction public.transactions;
  updated_transaction public.transactions;
begin
  current_host_id := public.assert_host();

  if p_amount is null or p_amount <= 0 then
    raise exception 'Buy-in amount must be greater than zero.';
  end if;

  select t.*
  into target_transaction
  from public.transactions t
  join public.sessions s on s.id = t.session_id
  where t.id = p_transaction_id
    and s.host_id = current_host_id
    and t.type in ('BUYIN'::public.transaction_type, 'REBUY'::public.transaction_type)
  for update of t;

  if target_transaction.id is null then
    raise exception 'Buy-in transaction not found.';
  end if;

  if target_transaction.deleted_at is not null then
    update public.transactions
    set
      comment = nullif(btrim(coalesce(p_comment, '')), ''),
      updated_by = current_host_id
    where id = target_transaction.id
    returning * into updated_transaction;

    return updated_transaction;
  end if;

  update public.transactions
  set
    amount = p_amount,
    comment = nullif(btrim(coalesce(p_comment, '')), ''),
    updated_by = current_host_id
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
  target_transaction public.transactions;
  updated_transaction public.transactions;
begin
  current_host_id := public.assert_host();

  select t.*
  into target_transaction
  from public.transactions t
  join public.sessions s on s.id = t.session_id
  where t.id = p_transaction_id
    and s.host_id = current_host_id
    and t.type in ('BUYIN'::public.transaction_type, 'REBUY'::public.transaction_type)
  for update of t;

  if target_transaction.id is null then
    raise exception 'Buy-in transaction not found.';
  end if;

  update public.transactions
  set
    deleted_at = coalesce(deleted_at, now()),
    deleted_by = coalesce(deleted_by, current_host_id),
    updated_by = current_host_id
  where id = target_transaction.id
  returning * into updated_transaction;

  perform public.recalculate_session_player_buy_in(target_transaction.session_player_id);

  return updated_transaction;
end;
$$;

grant execute on function public.add_player_to_session(uuid, text, numeric, uuid, uuid, text) to authenticated;
grant execute on function public.record_rebuy(uuid, numeric, text) to authenticated;
grant execute on function public.update_buy_in_transaction(uuid, numeric, text) to authenticated;
grant execute on function public.delete_buy_in_transaction(uuid) to authenticated;
