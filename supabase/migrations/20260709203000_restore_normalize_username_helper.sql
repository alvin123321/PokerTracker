-- Ensure username validation helpers exist on production projects that missed
-- the original registered-player helper migration.

create or replace function public.normalize_username(p_username text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(btrim(coalesce(p_username, '')));
$$;

notify pgrst, 'reload schema';
