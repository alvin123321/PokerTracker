do $$
begin
  create type public.time_call_status as enum ('RUNNING', 'FINISHED', 'EXPIRED', 'CANCELLED');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.time_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  status public.time_call_status not null default 'RUNNING',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  constraint time_calls_expiry_after_start check (expires_at > started_at),
  constraint time_calls_resolved_when_not_running
    check (status = 'RUNNING' or resolved_at is not null)
);

create unique index if not exists time_calls_one_running_per_session_idx
on public.time_calls(session_id)
where status = 'RUNNING';

create index if not exists time_calls_session_id_idx on public.time_calls(session_id);
create index if not exists time_calls_session_player_id_idx on public.time_calls(session_player_id);
create index if not exists time_calls_status_idx on public.time_calls(status);
create index if not exists time_calls_expires_at_idx on public.time_calls(expires_at);

alter table public.time_calls enable row level security;

drop policy if exists "Operators can read managed time calls" on public.time_calls;

create policy "Operators can read managed time calls"
on public.time_calls
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id) and public.is_table_operator());

drop policy if exists "Players can read their own time calls" on public.time_calls;

create policy "Players can read their own time calls"
on public.time_calls
for select
to authenticated
using (
  exists (
    select 1
    from public.session_players sp
    where sp.id = time_calls.session_player_id
      and public.player_belongs_to_current_user(sp.player_id)
  )
);

create or replace function public.expire_running_time_calls(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.time_calls
  set
    status = 'EXPIRED'::public.time_call_status,
    resolved_at = now()
  where session_id = p_session_id
    and status = 'RUNNING'::public.time_call_status
    and expires_at <= now();
end;
$$;

create or replace function public.request_time_call(
  p_session_id uuid,
  p_session_player_id uuid
)
returns public.time_calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  target_session public.sessions;
  target_session_player public.session_players;
  created_time_call public.time_calls;
  used_call_count integer;
begin
  current_user_id := public.assert_authenticated();

  perform public.expire_running_time_calls(p_session_id);

  select *
  into target_session
  from public.sessions
  where id = p_session_id
  for update;

  if target_session.id is null then
    raise exception 'Session not found.';
  end if;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot call time in a completed session.';
  end if;

  select sp.*
  into target_session_player
  from public.session_players sp
  where sp.id = p_session_player_id
    and sp.session_id = p_session_id
  for update;

  if target_session_player.id is null then
    raise exception 'Player is not in this session.';
  end if;

  if target_session_player.status <> 'ACTIVE'::public.session_player_status then
    raise exception 'Cashed-out players cannot call time.';
  end if;

  if not public.player_belongs_to_current_user(target_session_player.player_id) then
    raise exception 'You can only call time for your own seat.';
  end if;

  if exists (
    select 1
    from public.time_calls tc
    where tc.session_id = p_session_id
      and tc.status = 'RUNNING'::public.time_call_status
  ) then
    raise exception 'A call-time clock is already running.';
  end if;

  select count(*)::integer
  into used_call_count
  from public.time_calls tc
  where tc.session_player_id = p_session_player_id
    and tc.status in (
      'RUNNING'::public.time_call_status,
      'FINISHED'::public.time_call_status,
      'EXPIRED'::public.time_call_status
    );

  if used_call_count >= 3 then
    raise exception 'No call times remaining.';
  end if;

  insert into public.time_calls (
    session_id,
    session_player_id,
    status,
    started_at,
    expires_at
  )
  values (
    p_session_id,
    p_session_player_id,
    'RUNNING'::public.time_call_status,
    now(),
    now() + interval '30 seconds'
  )
  returning * into created_time_call;

  return created_time_call;
end;
$$;

create or replace function public.resolve_time_call(
  p_time_call_id uuid,
  p_status text
)
returns public.time_calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  clean_status text;
  target_time_call public.time_calls;
  updated_time_call public.time_calls;
  caller_is_operator boolean;
  caller_is_player boolean;
begin
  current_user_id := public.assert_authenticated();
  clean_status := upper(btrim(coalesce(p_status, '')));

  if clean_status not in ('FINISHED', 'EXPIRED', 'CANCELLED') then
    raise exception 'Unsupported call-time resolution.';
  end if;

  select *
  into target_time_call
  from public.time_calls
  where id = p_time_call_id
  for update;

  if target_time_call.id is null then
    raise exception 'Call-time clock not found.';
  end if;

  if target_time_call.status <> 'RUNNING'::public.time_call_status then
    return target_time_call;
  end if;

  caller_is_operator := public.session_belongs_to_current_operator(target_time_call.session_id)
    and public.is_table_operator();

  caller_is_player := exists (
    select 1
    from public.session_players sp
    where sp.id = target_time_call.session_player_id
      and public.player_belongs_to_current_user(sp.player_id)
  );

  if clean_status in ('FINISHED', 'CANCELLED') and not caller_is_operator then
    raise exception 'Host or manager privileges required.';
  end if;

  if clean_status = 'EXPIRED' and not (caller_is_operator or caller_is_player) then
    raise exception 'You cannot expire this call-time clock.';
  end if;

  if clean_status = 'EXPIRED' and target_time_call.expires_at > now() then
    raise exception 'Call-time clock has not expired yet.';
  end if;

  update public.time_calls
  set
    status = clean_status::public.time_call_status,
    resolved_at = now(),
    resolved_by = current_user_id
  where id = target_time_call.id
  returning * into updated_time_call;

  return updated_time_call;
end;
$$;

revoke all on function public.expire_running_time_calls(uuid) from public, anon, authenticated;
revoke all on function public.request_time_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_time_call(uuid, text) from public, anon, authenticated;

grant usage on type public.time_call_status to authenticated;
grant select on public.time_calls to authenticated;
grant execute on function public.request_time_call(uuid, uuid) to authenticated;
grant execute on function public.resolve_time_call(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'time_calls'
    ) then
      alter publication supabase_realtime add table public.time_calls;
    end if;
  end if;
end
$$;

notify pgrst, 'reload schema';
