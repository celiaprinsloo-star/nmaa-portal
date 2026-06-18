create table if not exists public.compliance_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.compliance_documents(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  reminder_type text not null,
  recipient_email text not null,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (document_id, reminder_type)
);

create index if not exists compliance_reminder_logs_document_type_idx
on public.compliance_reminder_logs(document_id, reminder_type);

create index if not exists compliance_reminder_logs_school_id_idx
on public.compliance_reminder_logs(school_id);

alter table public.compliance_reminder_logs enable row level security;

drop policy if exists "National admins can view compliance reminder logs" on public.compliance_reminder_logs;
create policy "National admins can view compliance reminder logs"
on public.compliance_reminder_logs for select
using (public.is_national_admin());
