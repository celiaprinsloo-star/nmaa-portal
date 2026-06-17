create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text not null,
  recipient_count integer not null default 0,
  provider_message_id text,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.email_logs enable row level security;

drop policy if exists "National admins can view email logs" on public.email_logs;
create policy "National admins can view email logs"
on public.email_logs for select
using (public.is_national_admin());

drop policy if exists "National admins can create email logs" on public.email_logs;
create policy "National admins can create email logs"
on public.email_logs for insert
with check (public.is_national_admin());
