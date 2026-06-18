alter table public.event_bookings
add column if not exists student_id uuid references public.students(id) on delete set null,
add column if not exists instructor_id uuid references public.instructors(id) on delete set null;

create index if not exists event_bookings_student_id_idx
on public.event_bookings(student_id);

create index if not exists event_bookings_instructor_id_idx
on public.event_bookings(instructor_id);
