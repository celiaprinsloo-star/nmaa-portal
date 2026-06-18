alter table public.students
add column if not exists external_source text,
add column if not exists external_student_id text;

alter table public.tournament_entries
add column if not exists external_source text,
add column if not exists external_entry_id text,
add column if not exists external_synced_at timestamptz,
add column if not exists external_sync_error text;

alter table public.tournament_entries
drop constraint if exists tournament_entries_tournament_id_student_id_key;

create unique index if not exists students_external_source_id_unique
on public.students(external_source, external_student_id);

create unique index if not exists tournament_entries_external_source_id_unique
on public.tournament_entries(external_source, external_entry_id);

create index if not exists tournament_entries_tournament_student_category_idx
on public.tournament_entries(tournament_id, student_id, category);
