create table if not exists public.recorded_hands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  creator_player_id uuid references public.session_players(id) on delete set null,
  title text,
  comment text,
  tags text[] not null default '{}',
  player_ids uuid[] not null default '{}',
  board jsonb not null default '[]'::jsonb,
  status text not null default 'SAVED' check (status in ('DRAFT', 'SAVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recorded_hand_actions (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.recorded_hands(id) on delete cascade,
  street text not null check (street in ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
  action_order integer not null check (action_order > 0),
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  action_type text not null check (action_type in ('RAISE', 'CALL', 'CHECK', 'FOLD', 'BET', 'ALL_IN')),
  amount numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (hand_id, action_order)
);

create index if not exists recorded_hands_session_id_idx
on public.recorded_hands(session_id);

create index if not exists recorded_hands_created_by_idx
on public.recorded_hands(created_by);

create index if not exists recorded_hand_actions_hand_id_idx
on public.recorded_hand_actions(hand_id);

drop trigger if exists recorded_hands_set_updated_at on public.recorded_hands;
create trigger recorded_hands_set_updated_at
before update on public.recorded_hands
for each row execute function public.set_updated_at();

create or replace function public.current_user_in_session(target_session_id uuid)
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

alter table public.recorded_hands enable row level security;
alter table public.recorded_hand_actions enable row level security;

drop policy if exists "Operators can read recorded hands for managed sessions" on public.recorded_hands;
create policy "Operators can read recorded hands for managed sessions"
on public.recorded_hands
for select
to authenticated
using (public.session_belongs_to_current_operator(session_id) and public.is_table_operator());

drop policy if exists "Players can read recorded hands for their sessions" on public.recorded_hands;
create policy "Players can read recorded hands for their sessions"
on public.recorded_hands
for select
to authenticated
using (public.current_user_in_session(session_id));

drop policy if exists "Operators can create recorded hands for managed sessions" on public.recorded_hands;
create policy "Operators can create recorded hands for managed sessions"
on public.recorded_hands
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.session_belongs_to_current_operator(session_id)
  and public.is_table_operator()
);

drop policy if exists "Players can create recorded hands for their sessions" on public.recorded_hands;
create policy "Players can create recorded hands for their sessions"
on public.recorded_hands
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_in_session(session_id)
  and (
    creator_player_id is null
    or exists (
      select 1
      from public.session_players sp
      join public.players p on p.id = sp.player_id
      where sp.id = creator_player_id
        and sp.session_id = recorded_hands.session_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Creators can update their recorded hand drafts" on public.recorded_hands;
create policy "Creators can update their recorded hand drafts"
on public.recorded_hands
for update
to authenticated
using (created_by = auth.uid() and status = 'DRAFT')
with check (created_by = auth.uid());

drop policy if exists "Hosts can delete recorded hands for their sessions" on public.recorded_hands;
create policy "Hosts can delete recorded hands for their sessions"
on public.recorded_hands
for delete
to authenticated
using (
  exists (
    select 1
    from public.sessions s
    where s.id = recorded_hands.session_id
      and s.host_id = auth.uid()
      and public.current_user_role()::text = 'HOST'
  )
);

drop policy if exists "Operators can read recorded hand actions" on public.recorded_hand_actions;
create policy "Operators can read recorded hand actions"
on public.recorded_hand_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.recorded_hands h
    where h.id = recorded_hand_actions.hand_id
      and public.session_belongs_to_current_operator(h.session_id)
      and public.is_table_operator()
  )
);

drop policy if exists "Players can read recorded hand actions for their sessions" on public.recorded_hand_actions;
create policy "Players can read recorded hand actions for their sessions"
on public.recorded_hand_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.recorded_hands h
    where h.id = recorded_hand_actions.hand_id
      and public.current_user_in_session(h.session_id)
  )
);

drop policy if exists "Creators can create recorded hand actions" on public.recorded_hand_actions;
create policy "Creators can create recorded hand actions"
on public.recorded_hand_actions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.recorded_hands h
    join public.session_players sp on sp.id = recorded_hand_actions.session_player_id
    where h.id = recorded_hand_actions.hand_id
      and sp.session_id = h.session_id
      and h.created_by = auth.uid()
  )
);

grant select, insert, update, delete on public.recorded_hands to authenticated;
grant select, insert on public.recorded_hand_actions to authenticated;
grant execute on function public.current_user_in_session(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.recorded_hands;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.recorded_hand_actions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
