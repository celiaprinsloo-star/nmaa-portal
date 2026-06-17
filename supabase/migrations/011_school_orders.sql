create table if not exists public.school_orders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  contact_name text,
  contact_email text,
  notes text,
  status text not null default 'submitted',
  admin_notes text,
  total_zar numeric(12, 2) not null default 0,
  total_usd numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.school_orders(id) on delete cascade,
  catalog_item_id text not null,
  section text not null,
  item text not null,
  size text,
  quantity integer not null,
  currency text not null default 'ZAR',
  instructor_price numeric(12, 2),
  student_price numeric(12, 2),
  line_total numeric(12, 2) not null default 0,
  note text,
  special_order boolean not null default false
);

create index if not exists school_orders_school_id_idx on public.school_orders(school_id);
create index if not exists school_orders_status_idx on public.school_orders(status);
create index if not exists school_order_items_order_id_idx on public.school_order_items(order_id);

alter table public.school_orders enable row level security;
alter table public.school_order_items enable row level security;
