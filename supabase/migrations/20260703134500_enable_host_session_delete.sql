drop trigger if exists transactions_prevent_delete on public.transactions;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'Hosts can delete their own sessions'
  ) then
    create policy "Hosts can delete their own sessions"
    on public.sessions
    for delete
    to authenticated
    using (host_id = auth.uid() and public.is_host());
  end if;
end $$;

grant delete on public.sessions to authenticated;

comment on policy "Hosts can delete their own sessions" on public.sessions
is 'Allows hosts to delete their own session rows; session players and transactions are removed by cascade so deleted sessions no longer affect player totals.';
