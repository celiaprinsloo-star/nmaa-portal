create table if not exists public.tournament_school_fee_payments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'outstanding',
  amount_zar numeric(12, 2),
  paid_at timestamptz,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournament_school_fee_payments_status_check'
      and conrelid = 'public.tournament_school_fee_payments'::regclass
  ) then
    alter table public.tournament_school_fee_payments
    add constraint tournament_school_fee_payments_status_check
    check (status in ('outstanding', 'paid'))
    not valid;
  end if;
end $$;

alter table public.tournament_school_fee_payments
validate constraint tournament_school_fee_payments_status_check;

create unique index if not exists tournament_school_fee_payments_unique
on public.tournament_school_fee_payments(tournament_id, school_id);

create index if not exists tournament_school_fee_payments_school_status_idx
on public.tournament_school_fee_payments(school_id, status);

alter table public.tournament_school_fee_payments enable row level security;

drop policy if exists "Admins can manage tournament school fee payments" on public.tournament_school_fee_payments;
drop policy if exists "School owners can view own tournament school fee payments" on public.tournament_school_fee_payments;

create policy "Admins can manage tournament school fee payments"
on public.tournament_school_fee_payments for all
using (public.current_profile_role() in ('super_admin', 'national_admin'))
with check (public.current_profile_role() in ('super_admin', 'national_admin'));

create policy "School owners can view own tournament school fee payments"
on public.tournament_school_fee_payments for select
using (
  public.current_profile_role() = 'school_owner'
  and school_id = public.current_profile_school_id()
);
