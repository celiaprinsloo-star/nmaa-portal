alter table public.students
add column if not exists gender text,
add column if not exists race text;

alter table public.students
drop column if exists grade,
drop column if exists membership_expires_at;
