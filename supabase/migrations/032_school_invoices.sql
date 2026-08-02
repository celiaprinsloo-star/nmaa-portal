create table if not exists public.school_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  invoice_number text not null,
  title text not null,
  description text,
  amount_zar numeric(12, 2) not null default 0,
  status text not null default 'outstanding',
  due_date date,
  admin_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_invoices_status_check'
      and conrelid = 'public.school_invoices'::regclass
  ) then
    alter table public.school_invoices
    add constraint school_invoices_status_check
    check (status in ('outstanding', 'paid', 'cancelled'))
    not valid;
  end if;
end $$;

alter table public.school_invoices
validate constraint school_invoices_status_check;

create index if not exists school_invoices_school_status_idx
on public.school_invoices(school_id, status);

create index if not exists school_invoices_due_date_idx
on public.school_invoices(due_date);

create unique index if not exists school_invoices_invoice_number_unique
on public.school_invoices(invoice_number);

alter table public.school_invoices enable row level security;

drop policy if exists "Super admins can manage school invoices" on public.school_invoices;
drop policy if exists "School owners can view own school invoices" on public.school_invoices;

create policy "Super admins can manage school invoices"
on public.school_invoices for all
using (public.current_profile_role() = 'super_admin')
with check (public.current_profile_role() = 'super_admin');

create policy "School owners can view own school invoices"
on public.school_invoices for select
using (
  public.current_profile_role() = 'school_owner'
  and school_id = public.current_profile_school_id()
);
