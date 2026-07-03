alter type public.user_role add value if not exists 'MANAGER';

alter table public.users
add column if not exists manager_host_id uuid references public.users(id) on delete set null;

create index if not exists users_manager_host_id_idx on public.users(manager_host_id);

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role()::text = 'MANAGER';
$$;

create or replace function public.current_operator_host_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when u.role::text = 'HOST' then u.id
      when u.role::text = 'MANAGER' then u.manager_host_id
      else null
    end
  from public.users u
  where u.id = auth.uid();
$$;

create or replace function public.is_table_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_operator_host_id() is not null;
$$;

create or replace function public.session_belongs_to_current_operator(target_session_id uuid)
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
      and s.host_id = public.current_operator_host_id()
  );
$$;

create or replace function public.assert_host()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
begin
  perform public.assert_authenticated();
  current_host_id := public.current_operator_host_id();

  if current_host_id is null then
    raise exception 'Host or manager privileges required.';
  end if;

  return current_host_id;
end;
$$;

create or replace function public.assert_host_admin()
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

  if public.current_user_role()::text <> 'HOST' then
    raise exception 'Host privileges required.';
  end if;

  return current_user_id;
end;
$$;

drop policy if exists "Operators can read managed sessions" on public.sessions;
create policy "Operators can read managed sessions"
on public.sessions
for select
to authenticated
using (host_id = public.current_operator_host_id() and public.is_table_operator());

drop policy if exists "Managers can read host players" on public.players;
create policy "Managers can read host players"
on public.players
for select
to authenticated
using (host_id = public.current_operator_host_id() and public.is_table_operator());

drop policy if exists "Operators can read session players for managed sessions" on public.session_players;
create policy "Operators can read session players for managed sessions"
on public.session_players
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id) and public.is_table_operator());

drop policy if exists "Operators can read transactions for managed sessions" on public.transactions;
create policy "Operators can read transactions for managed sessions"
on public.transactions
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id) and public.is_table_operator());

drop policy if exists "Hosts can read registered member profiles" on public.users;
drop policy if exists "Operators can read registered member profiles" on public.users;
create policy "Operators can read registered member profiles"
on public.users
for select
to authenticated
using (
  public.is_table_operator()
  and role::text in ('PLAYER', 'MANAGER')
);

create or replace function public.list_registered_players()
returns table (
  id uuid,
  username text,
  display_name text,
  role public.user_role
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.username, u.display_name, u.role
  from public.users u
  where public.is_table_operator()
    and u.role::text in ('PLAYER', 'MANAGER')
  order by lower(coalesce(u.display_name, u.username, u.id::text));
$$;

create or replace function public.set_registered_user_role(
  p_user_id uuid,
  p_role text
)
returns table (
  id uuid,
  username text,
  display_name text,
  role public.user_role
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  clean_role text;
begin
  current_host_id := public.assert_host_admin();
  clean_role := upper(btrim(coalesce(p_role, '')));

  if clean_role not in ('PLAYER', 'MANAGER') then
    raise exception 'Role must be PLAYER or MANAGER.';
  end if;

  return query
  update public.users u
  set
    role = clean_role::public.user_role,
    manager_host_id = case when clean_role = 'MANAGER' then current_host_id else null end
  where u.id = p_user_id
    and u.role::text in ('PLAYER', 'MANAGER')
  returning u.id, u.username, u.display_name, u.role;
end;
$$;

grant execute on function public.list_registered_players() to authenticated;
grant execute on function public.set_registered_user_role(uuid, text) to authenticated;

notify pgrst, 'reload schema';
