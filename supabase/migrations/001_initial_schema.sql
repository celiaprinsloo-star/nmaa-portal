create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum (
    'super_admin',
    'national_admin',
    'provincial_admin',
    'school_owner',
    'instructor'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.approval_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.compliance_status as enum ('pending', 'submitted', 'approved', 'rejected', 'expired');
exception
  when duplicate_object then null;
end $$;

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

create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict default public.nmaa_sa_organisation_id(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete restrict,
  name text not null,
  registration_number text,
  city text,
  address text,
  contact_email text,
  contact_phone text,
  logo_url text,
  affiliation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (province_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  requested_role public.user_role not null,
  role public.user_role,
  approval_status public.approval_status not null default 'pending',
  province_id uuid references public.provinces(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, profile_id, role)
);

create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  certification_level text,
  rank text,
  collar_level text,
  certification_date date,
  training_status text not null default 'pending',
  training_expires_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete set null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text,
  race text,
  belt_rank text,
  membership_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete set null,
  name text not null,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  category text,
  placement integer,
  result_label text,
  medal text,
  points numeric(8, 2),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (tournament_id, student_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  title text not null,
  event_type text not null,
  description text,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  attendee_name text not null,
  attendee_email text,
  attendee_phone text,
  attendee_type text,
  notes text,
  status text not null default 'booked',
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text not null default 'general',
  applies_to text not null default 'school',
  renewal_period_months integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  requirement_id uuid references public.compliance_requirements(id) on delete set null,
  document_name text not null,
  storage_path text,
  file_name text,
  file_type text,
  file_size integer,
  status public.compliance_status not null default 'pending',
  expires_at date,
  uploaded_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_documents_owner_check check (
    school_id is not null or instructor_id is not null or student_id is not null
  )
);

create table if not exists public.compliance_submissions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.compliance_requirements(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete cascade,
  document_id uuid references public.compliance_documents(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  status public.compliance_status not null default 'submitted',
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  constraint compliance_submissions_owner_check check (
    school_id is not null or instructor_id is not null
  )
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_approval_status_idx on public.profiles(approval_status);
create index if not exists schools_province_id_idx on public.schools(province_id);
create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists instructors_school_id_idx on public.instructors(school_id);
create index if not exists compliance_documents_expires_at_idx on public.compliance_documents(expires_at);

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.provinces enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.students enable row level security;
alter table public.instructors enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.events enable row level security;
alter table public.event_bookings enable row level security;
alter table public.compliance_documents enable row level security;
alter table public.compliance_requirements enable row level security;
alter table public.compliance_submissions enable row level security;

create or replace function public.current_profile_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_province_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select province_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_school_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_national_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() in ('super_admin', 'national_admin')
$$;

create policy "Profiles can view self"
on public.profiles for select
using (id = auth.uid() or public.is_national_admin());

create policy "Profiles can update self basic fields"
on public.profiles for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and role is not distinct from (select role from public.profiles where id = auth.uid())
  and approval_status is not distinct from (select approval_status from public.profiles where id = auth.uid())
);

create policy "National admins can manage profiles"
on public.profiles for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "Approved users can view organisations"
on public.organisations for select
using (public.current_profile_role() is not null);

create policy "National admins can manage organisations"
on public.organisations for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "Approved users can view provinces"
on public.provinces for select
using (public.current_profile_role() is not null);

create policy "National admins can manage provinces"
on public.provinces for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "Role scoped school visibility"
on public.schools for select
using (
  public.is_national_admin()
  or (public.current_profile_role() = 'provincial_admin' and province_id = public.current_profile_province_id())
  or (public.current_profile_role() in ('school_owner', 'instructor') and id = public.current_profile_school_id())
);

create policy "National admins can manage schools"
on public.schools for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "School member visibility"
on public.school_members for select
using (
  public.is_national_admin()
  or profile_id = auth.uid()
  or school_id = public.current_profile_school_id()
);

create policy "National admins can manage school members"
on public.school_members for all
using (public.is_national_admin())
with check (public.is_national_admin());

create policy "Role scoped instructor visibility"
on public.instructors for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = instructors.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

create policy "Role scoped student visibility"
on public.students for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = students.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

create policy "Role scoped tournament visibility"
on public.tournaments for select
using (
  public.is_national_admin()
  or province_id is null
  or province_id = public.current_profile_province_id()
);

create policy "Role scoped tournament entry visibility"
on public.tournament_entries for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = tournament_entries.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

create policy "Role scoped event visibility"
on public.events for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or province_id = public.current_profile_province_id()
  or (province_id is null and school_id is null)
);

create policy "Role scoped booking visibility"
on public.event_bookings for select
using (
  public.is_national_admin()
  or profile_id = auth.uid()
  or school_id = public.current_profile_school_id()
);

create policy "Scoped compliance document visibility"
on public.compliance_documents for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = compliance_documents.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);

create policy "Approved users can view compliance requirements"
on public.compliance_requirements for select
using (public.current_profile_role() is not null);

create policy "Scoped compliance submission visibility"
on public.compliance_submissions for select
using (
  public.is_national_admin()
  or school_id = public.current_profile_school_id()
  or exists (
    select 1 from public.schools s
    where s.id = compliance_submissions.school_id
    and s.province_id = public.current_profile_province_id()
    and public.current_profile_role() = 'provincial_admin'
  )
);
