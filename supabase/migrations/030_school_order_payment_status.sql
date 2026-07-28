alter table public.school_orders
add column if not exists payment_status text not null default 'outstanding';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_orders_payment_status_check'
      and conrelid = 'public.school_orders'::regclass
  ) then
    alter table public.school_orders
    add constraint school_orders_payment_status_check
    check (payment_status in ('outstanding', 'paid'))
    not valid;
  end if;
end $$;

alter table public.school_orders
validate constraint school_orders_payment_status_check;

create index if not exists school_orders_payment_status_idx
on public.school_orders(payment_status);
