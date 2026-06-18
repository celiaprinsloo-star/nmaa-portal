create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_profile_id_idx
on public.audit_logs(actor_profile_id);

create index if not exists audit_logs_entity_idx
on public.audit_logs(entity_table, entity_id);

create index if not exists audit_logs_created_at_idx
on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "National admins can view audit logs" on public.audit_logs;
create policy "National admins can view audit logs"
on public.audit_logs for select
using (public.is_national_admin());

drop policy if exists "National admins can create audit logs" on public.audit_logs;
create policy "National admins can create audit logs"
on public.audit_logs for insert
with check (public.is_national_admin());

alter table public.tournament_entries
drop column if exists placement;
