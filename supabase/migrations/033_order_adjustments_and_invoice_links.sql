alter table public.school_orders
add column if not exists discount_zar numeric(12, 2) not null default 0,
add column if not exists discount_note text;

alter table public.school_invoices
add column if not exists source_order_id uuid references public.school_orders(id) on delete set null;

create unique index if not exists school_invoices_source_order_id_unique
on public.school_invoices(source_order_id)
where source_order_id is not null;

create index if not exists school_invoices_source_order_id_idx
on public.school_invoices(source_order_id);
