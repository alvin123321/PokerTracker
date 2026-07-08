create table if not exists public.password_change_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.users(id) on delete cascade,
  changed_by uuid references public.users(id) on delete set null,
  change_source text not null check (
    change_source in ('SELF_SERVICE', 'ADMIN_APP', 'SERVICE_SCRIPT', 'SUPABASE_DASHBOARD')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists password_change_audit_target_user_id_idx
on public.password_change_audit(target_user_id, created_at desc);

alter table public.password_change_audit enable row level security;

drop policy if exists "Hosts can read password change audit" on public.password_change_audit;
create policy "Hosts can read password change audit"
on public.password_change_audit
for select
to authenticated
using (public.is_host());

drop policy if exists "Users can record their own password change" on public.password_change_audit;
create policy "Users can record their own password change"
on public.password_change_audit
for insert
to authenticated
with check (
  target_user_id = auth.uid()
  and changed_by = auth.uid()
  and change_source = 'SELF_SERVICE'
);

grant select, insert on public.password_change_audit to authenticated;
grant select, insert on public.password_change_audit to service_role;

notify pgrst, 'reload schema';
