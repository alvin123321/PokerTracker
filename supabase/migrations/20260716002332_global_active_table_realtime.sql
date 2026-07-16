create table public.active_table_revisions (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.active_table_revisions (id, revision)
values (true, 0)
on conflict (id) do nothing;

alter table public.active_table_revisions enable row level security;

create policy "Registered players can read active table revisions"
on public.active_table_revisions
for select
to authenticated
using (public.current_user_role()::text = 'PLAYER');

grant select on public.active_table_revisions to authenticated;

create or replace function public.player_active_tables()
returns table (
  session_id uuid,
  session_name text,
  session_date date,
  session_created_at timestamptz,
  table_id uuid,
  table_name text,
  table_number integer,
  table_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_role() is distinct from 'PLAYER'::public.user_role then
    raise exception 'Player access required.';
  end if;

  return query
  select
    sessions.id,
    sessions.name,
    sessions.session_date,
    sessions.created_at,
    session_tables.id,
    session_tables.name,
    session_tables.table_number,
    session_tables.created_at
  from public.sessions
  join public.session_tables on session_tables.session_id = sessions.id
  where sessions.status = 'ACTIVE'::public.session_status
    and session_tables.status = 'ACTIVE'::public.session_table_status
  order by
    sessions.session_date desc,
    sessions.created_at,
    session_tables.table_number,
    session_tables.id;
end;
$$;

revoke all on function public.player_active_tables() from public, anon, authenticated;
grant execute on function public.player_active_tables() to authenticated;

create or replace function public.bump_active_table_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.active_table_revisions
  set revision = revision + 1,
      updated_at = now()
  where id = true;

  return null;
end;
$$;

revoke all on function public.bump_active_table_revision() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach target_table in array array['session_tables', 'active_table_revisions']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end
$$;

create trigger sessions_active_table_revision_insert_delete
after insert or delete on public.sessions
for each statement execute function public.bump_active_table_revision();

create trigger sessions_active_table_revision_status
after update of status on public.sessions
for each statement execute function public.bump_active_table_revision();

create trigger session_tables_active_table_revision_insert_delete
after insert or delete on public.session_tables
for each statement execute function public.bump_active_table_revision();

create trigger session_tables_active_table_revision_status
after update of status on public.session_tables
for each statement execute function public.bump_active_table_revision();

notify pgrst, 'reload schema';
