-- Allow two-character PokerTrack player login names such as "kw".

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

  if normalized_username !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then
    raise exception 'Player login must be 2-32 characters and use only letters, numbers, underscore, or hyphen.';
  end if;

  return normalized_username;
end;
$$;

create or replace function public.create_registered_player_profile(
  p_user_id uuid,
  p_username text,
  p_display_name text
)
returns table (
  id uuid,
  username text,
  display_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  clean_username text;
  clean_display_name text;
  created_id uuid;
  created_username text;
  created_display_name text;
begin
  current_host_id := public.assert_host();
  clean_username := lower(btrim(coalesce(p_username, '')));
  clean_display_name := nullif(btrim(coalesce(p_display_name, '')), '');

  if clean_username !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then
    raise exception 'Player login must be 2-32 characters and use only letters, numbers, underscore, or hyphen.';
  end if;

  if p_user_id is null then
    raise exception 'Player auth user id is required.';
  end if;

  if clean_display_name is null then
    clean_display_name := clean_username;
  end if;

  insert into public.users (id, username, display_name, role)
  values (
    p_user_id,
    clean_username,
    clean_display_name,
    'PLAYER'::public.user_role
  )
  on conflict on constraint users_pkey do update
  set
    username = coalesce(public.users.username, excluded.username),
    display_name = coalesce(public.users.display_name, excluded.display_name)
  returning
    public.users.id,
    public.users.username,
    public.users.display_name
  into
    created_id,
    created_username,
    created_display_name;

  return query
  select
    created_id,
    created_username,
    created_display_name;
end;
$$;

grant execute on function public.create_registered_player_profile(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
