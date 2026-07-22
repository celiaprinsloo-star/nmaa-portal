alter table public.tournaments
add column if not exists fee_structure jsonb not null default '{}'::jsonb;
