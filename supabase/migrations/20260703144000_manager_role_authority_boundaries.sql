-- Managers can operate active tables, while session/admin destructive actions stay host-only.

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
  current_host_id := public.assert_host_admin();

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

  update public.sessions
  set
    status = 'COMPLETED'::public.session_status,
    closed_at = now()
  where id = target_session.id
  returning * into target_session;

  return target_session;
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
  current_host_id := public.assert_host_admin();

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

grant execute on function public.create_session(text, date) to authenticated;
grant execute on function public.add_player_to_session(uuid, text, numeric, uuid, uuid, text) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
grant execute on function public.delete_buy_in_transaction(uuid) to authenticated;

notify pgrst, 'reload schema';
