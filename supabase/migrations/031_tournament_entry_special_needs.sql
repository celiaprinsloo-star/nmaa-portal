alter table public.tournament_entries
add column if not exists special_needs boolean not null default false;

create index if not exists tournament_entries_special_needs_idx
on public.tournament_entries(special_needs);
