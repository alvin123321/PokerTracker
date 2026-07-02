-- V1 repair: create registered-player profiles from the Edge Function instead
-- of the auth.users trigger. The trigger can make Supabase Auth user creation
-- fail with a generic "Database error creating new user" after profile schema
-- changes, while create-registered-player already upserts public.users safely.

drop trigger if exists on_auth_user_created on auth.users;

notify pgrst, 'reload schema';
