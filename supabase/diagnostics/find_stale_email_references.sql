-- Diagnostic only: find remote database objects that still reference public.users.email.
-- Run this in Supabase SQL Editor if create-registered-player returns:
-- "column users.email does not exist".

select
  'function' as object_type,
  n.nspname as schema_name,
  p.proname as object_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and p.prokind in ('f', 'p')
  and (
    pg_get_functiondef(p.oid) ilike '%users.email%'
    or pg_get_functiondef(p.oid) ilike '%target_user.email%'
    or pg_get_functiondef(p.oid) ilike '%u.email%'
    or pg_get_functiondef(p.oid) ilike '%email = excluded.email%'
    or pg_get_functiondef(p.oid) ilike '%insert into public.users (id, email%'
  )

union all

select
  'function' as object_type,
  n.nspname as schema_name,
  p.proname as object_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and p.prokind in ('f', 'p')
  and pg_get_functiondef(p.oid) ilike '%public.users%'
  and pg_get_functiondef(p.oid) ilike '%email%'

union all

select
  'trigger' as object_type,
  trigger_schema as schema_name,
  trigger_name as object_name,
  event_object_schema || '.' || event_object_table as arguments,
  action_statement as definition
from information_schema.triggers
where event_object_schema in ('public', 'auth')
  and action_statement ilike '%handle_new_auth_user%'

order by object_type, schema_name, object_name;

select
  'auth.users trigger' as object_type,
  t.tgname as trigger_name,
  p.pronamespace::regnamespace::text as function_schema,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition,
  pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;
