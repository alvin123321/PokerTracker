-- Repair database functions after public.users.email was removed.
-- Supabase Auth still owns login email; PokerTrack profiles use username/display_name.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

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

  insert into public.users (id, username, display_name, role)
  values (
    new.id,
    requested_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when requested_role = 'HOST' then 'HOST'::public.user_role
      else 'PLAYER'::public.user_role
    end
  )
  on conflict (id) do update
  set
    username = coalesce(public.users.username, excluded.username),
    display_name = coalesce(public.users.display_name, excluded.display_name);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

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

grant execute on function public.add_player_to_session(uuid, text, numeric, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
