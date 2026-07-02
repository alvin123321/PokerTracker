-- Registered-player pickers do not need email; username is the login handle and
-- display_name is the user-facing player name.

drop function if exists public.list_registered_players();

create or replace function public.list_registered_players()
returns table (
  id uuid,
  username text,
  display_name text
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
    u.display_name
  from public.users u
  where u.role = 'PLAYER'::public.user_role
  order by coalesce(u.display_name, u.username);
end;
$$;

grant execute on function public.list_registered_players() to authenticated;

notify pgrst, 'reload schema';
