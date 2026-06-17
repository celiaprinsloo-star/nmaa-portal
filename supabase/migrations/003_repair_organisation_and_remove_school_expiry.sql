create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organisations (name, slug)
values ('NMAA SA', 'nmaa-sa')
on conflict (slug) do nothing;

create or replace function public.nmaa_sa_organisation_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.organisations where slug = 'nmaa-sa'
$$;

alter table public.provinces
add column if not exists organisation_id uuid references public.organisations(id) on delete restrict;

update public.provinces
set organisation_id = public.nmaa_sa_organisation_id()
where organisation_id is null;

alter table public.provinces
alter column organisation_id set default public.nmaa_sa_organisation_id();

alter table public.provinces
alter column organisation_id set not null;

alter table public.schools
drop column if exists affiliation_expires_at;
