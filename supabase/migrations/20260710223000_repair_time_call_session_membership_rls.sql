-- Production repair for shared call-time visibility.
-- This helper keeps the time_calls RLS policy from depending on nested
-- session_players RLS evaluation when checking whether the current player is
-- seated in the same active session as the running clock.

create or replace function public.current_player_is_seated_in_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.session_players sp
    join public.players p on p.id = sp.player_id
    where sp.session_id = target_session_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.current_player_is_seated_in_session(uuid) from public, anon, authenticated;
grant execute on function public.current_player_is_seated_in_session(uuid) to authenticated;

alter table public.time_calls enable row level security;

drop policy if exists "Players can read their own time calls" on public.time_calls;
drop policy if exists "Players can read session time calls" on public.time_calls;

create policy "Players can read session time calls"
on public.time_calls
for select
to authenticated
using (public.current_player_is_seated_in_session(time_calls.session_id));

grant usage on type public.time_call_status to authenticated;
grant select on public.time_calls to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'time_calls'
    )
  then
    alter publication supabase_realtime add table public.time_calls;
  end if;
end
$$;

notify pgrst, 'reload schema';
