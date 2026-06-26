-- PokerTrack Phase 6.5 registered player accounts.
-- Adds login usernames and host-safe player lookup for registered-player add flow.

alter table public.users
  add column if not exists username text;

update public.users
set username = lower(split_part(email, '@', 1))
where username is null
  and email is not null
  and length(btrim(email)) > 0;

create unique index if not exists users_username_unique_idx
on public.users(lower(username))
where username is not null;

create unique index if not exists users_email_unique_idx
on public.users(lower(email))
where email is not null
  and length(btrim(email)) > 0;

create unique index if not exists players_host_user_unique_idx
on public.players(host_id, user_id)
where user_id is not null;

create or replace function public.normalize_username(p_username text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(btrim(coalesce(p_username, '')));
$$;

create or replace function public.validate_username(p_username text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized_username text;
begin
  normalized_username := public.normalize_username(p_username);

  if normalized_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' then
    raise exception 'Player login must be 3-32 characters and use only letters, numbers, underscore, or hyphen.';
  end if;

  return normalized_username;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
  requested_username text;
begin
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'PLAYER'));
  requested_username := public.normalize_username(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))
  );

  if requested_username = '' then
    requested_username := null;
  end if;

  insert into public.users (id, email, username, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    requested_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when requested_role = 'HOST' then 'HOST'::public.user_role
      else 'PLAYER'::public.user_role
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(public.users.username, excluded.username),
    display_name = coalesce(public.users.display_name, excluded.display_name);

  return new;
end;
$$;

create or replace function public.list_registered_players()
returns table (
  id uuid,
  username text,
  display_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_host();

  return query
  select
    u.id,
    u.username,
    u.display_name,
    u.email
  from public.users u
  where u.role = 'PLAYER'::public.user_role
  order by coalesce(u.display_name, u.username, u.email);
end;
$$;

drop function if exists public.add_player_to_session(uuid, text, numeric, uuid, uuid, text);

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
      and role = 'PLAYER'::public.user_role;

    if target_user.id is null then
      raise exception 'Registered player not found.';
    end if;

    clean_player_name := coalesce(
      nullif(clean_player_name, ''),
      nullif(target_user.display_name, ''),
      nullif(target_user.username, ''),
      target_user.email
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

grant execute on function public.list_registered_players() to authenticated;
grant execute on function public.add_player_to_session(uuid, text, numeric, uuid, uuid, text) to authenticated;
