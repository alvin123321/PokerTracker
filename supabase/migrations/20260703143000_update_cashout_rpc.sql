create or replace function public.update_cashout(
  p_session_player_id uuid,
  p_amount numeric
)
returns public.session_players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_host_id uuid;
  target_session public.sessions;
  target_session_player public.session_players;
begin
  current_host_id := public.assert_host();

  if p_amount is null or p_amount < 0 then
    raise exception 'Cash-out amount cannot be negative.';
  end if;

  select sp.*
  into target_session_player
  from public.session_players sp
  join public.sessions s on s.id = sp.session_id
  where sp.id = p_session_player_id
    and s.host_id = current_host_id
  for update of sp;

  if target_session_player.id is null then
    raise exception 'Session player not found.';
  end if;

  select *
  into target_session
  from public.sessions
  where id = target_session_player.session_id
  for update;

  if target_session.status <> 'ACTIVE'::public.session_status then
    raise exception 'Cannot edit a cash-out in a completed session.';
  end if;

  if target_session_player.status <> 'COMPLETED'::public.session_player_status then
    raise exception 'Cash-out has not been recorded yet.';
  end if;

  update public.session_players
  set
    cash_out = p_amount,
    net = p_amount - total_buy_in
  where id = target_session_player.id
  returning * into target_session_player;

  update public.transactions
  set
    amount = p_amount,
    updated_by = auth.uid()
  where id = (
    select t.id
    from public.transactions t
    where t.session_player_id = target_session_player.id
      and t.type = 'CASHOUT'::public.transaction_type
      and t.deleted_at is null
    order by t.created_at desc
    limit 1
  );

  return target_session_player;
end;
$$;

grant execute on function public.update_cashout(uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
