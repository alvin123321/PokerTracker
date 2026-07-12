grant delete on public.users to service_role;
grant select, update on public.session_players to service_role;

notify pgrst, 'reload schema';
