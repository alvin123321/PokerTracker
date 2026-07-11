-- Production repair for shared call-time clocks.
-- Previous migrations allowed the calling player to read their own clock, but
-- other seated players in the same session could miss the realtime row because
-- RLS did not allow session-wide player visibility in every environment.

alter table public.time_calls enable row level security;

drop policy if exists "Operators can read managed time calls" on public.time_calls;
drop policy if exists "Players can read their own time calls" on public.time_calls;
drop policy if exists "Players can read session time calls" on public.time_calls;

create policy "Operators can read managed time calls"
on public.time_calls
for select
to authenticated
using (
  public.session_belongs_to_current_operator(time_calls.session_id)
  and public.is_table_operator()
);

create policy "Players can read session time calls"
on public.time_calls
for select
to authenticated
using (
  exists (
    select 1
    from public.session_players seated_player
    where seated_player.session_id = time_calls.session_id
      and public.player_belongs_to_current_user(seated_player.player_id)
  )
);

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
