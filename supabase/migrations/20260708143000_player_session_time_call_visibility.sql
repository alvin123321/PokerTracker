drop policy if exists "Players can read their own time calls" on public.time_calls;
drop policy if exists "Players can read session time calls" on public.time_calls;

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
