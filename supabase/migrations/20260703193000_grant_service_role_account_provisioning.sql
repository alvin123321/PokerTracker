-- Allow one-off production account provisioning scripts to maintain Auth-linked
-- PokerTrack profiles and connect existing player rows to those profiles.

grant usage on schema public to service_role;
grant usage on type public.user_role to service_role;
grant select, insert, update on public.users to service_role;
grant select, update on public.players to service_role;

notify pgrst, 'reload schema';
