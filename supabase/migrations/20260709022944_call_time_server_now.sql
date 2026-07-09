create or replace function public.get_server_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

revoke all on function public.get_server_now() from public, anon, authenticated;
grant execute on function public.get_server_now() to authenticated;
