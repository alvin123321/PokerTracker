create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.users(id) on delete cascade,
  sender_display_name text not null,
  sender_role text not null check (sender_role in ('HOST', 'MANAGER', 'PLAYER')),
  message text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint global_chat_messages_message_not_blank check (length(btrim(message)) > 0),
  constraint global_chat_messages_message_length check (char_length(message) <= 500)
);

create index if not exists global_chat_messages_created_at_idx
on public.global_chat_messages(created_at desc);

create index if not exists global_chat_messages_sender_user_id_idx
on public.global_chat_messages(sender_user_id);

alter table public.global_chat_messages enable row level security;

drop policy if exists "Authenticated users can read global chat" on public.global_chat_messages;
create policy "Authenticated users can read global chat"
on public.global_chat_messages
for select
to authenticated
using (deleted_at is null);

drop policy if exists "Authenticated users can send their own global chat messages" on public.global_chat_messages;
create policy "Authenticated users can send their own global chat messages"
on public.global_chat_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and deleted_at is null
  and sender_display_name = (
    select coalesce(nullif(btrim(display_name), ''), 'Member')
    from public.users
    where id = (select auth.uid())
  )
  and sender_role = (
    select role::text
    from public.users
    where id = (select auth.uid())
  )
);

grant select, insert on public.global_chat_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'global_chat_messages'
    ) then
      alter publication supabase_realtime add table public.global_chat_messages;
    end if;
  end if;
end $$;
