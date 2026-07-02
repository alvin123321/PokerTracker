-- The app profile table no longer stores email. Supabase Auth still keeps the
-- internal login email used by password auth.

drop index if exists public.users_email_unique_idx;

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

alter table public.users
  drop column if exists email;

notify pgrst, 'reload schema';
