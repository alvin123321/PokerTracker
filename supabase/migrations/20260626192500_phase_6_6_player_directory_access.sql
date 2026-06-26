-- PokerTrack Phase 6.6 player directory access.
-- Allows hosts to list registered player profiles for the admin Players page.

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Hosts can read registered player profiles'
  ) then
    create policy "Hosts can read registered player profiles"
    on public.users
    for select
    to authenticated
    using (public.is_host() and role = 'PLAYER'::public.user_role);
  end if;
end
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

grant execute on function public.list_registered_players() to authenticated;

notify pgrst, 'reload schema';
