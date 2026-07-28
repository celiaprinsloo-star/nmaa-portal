alter table public.school_orders
add column if not exists order_type text not null default 'purchase';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_orders_order_type_check'
      and conrelid = 'public.school_orders'::regclass
  ) then
    alter table public.school_orders
    add constraint school_orders_order_type_check
    check (order_type in ('purchase', 'consignment'))
    not valid;
  end if;
end $$;

alter table public.school_orders
validate constraint school_orders_order_type_check;

create index if not exists school_orders_order_type_idx
on public.school_orders(order_type);
