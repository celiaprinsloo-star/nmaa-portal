alter table public.students
add column if not exists external_source text,
add column if not exists external_student_id text;

alter table public.instructors
add column if not exists student_id uuid references public.students(id) on delete set null,
add column if not exists external_source text,
add column if not exists external_instructor_id text,
add column if not exists external_student_id text,
add column if not exists external_synced_at timestamptz;

create unique index if not exists students_external_source_id_unique
on public.students(external_source, external_student_id);

create unique index if not exists instructors_external_source_id_unique
on public.instructors(external_source, external_instructor_id);
