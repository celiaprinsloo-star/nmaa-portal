alter table public.tournaments
add column if not exists external_source text,
add column if not exists external_tournament_id text,
add column if not exists external_synced_at timestamptz;

alter table public.events
add column if not exists external_source text,
add column if not exists external_event_id text,
add column if not exists external_synced_at timestamptz;

create unique index if not exists tournaments_external_source_id_unique
on public.tournaments(external_source, external_tournament_id);

create unique index if not exists events_external_source_id_unique
on public.events(external_source, external_event_id);
