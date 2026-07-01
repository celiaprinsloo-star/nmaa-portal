with duplicate_groups as (
  select
    lower(trim(name)) as name_key,
    lower(trim(coalesce(venue, ''))) as venue_key,
    starts_at::date as date_key,
    array_agg(id order by created_at asc, id asc) as ids
  from public.tournaments
  group by lower(trim(name)), lower(trim(coalesce(venue, ''))), starts_at::date
  having count(*) > 1
),
duplicate_map as (
  select
    duplicate_groups.ids[1] as keep_id,
    unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
delete from public.tournament_entries duplicate_entry
using duplicate_map, public.tournament_entries keep_entry
where duplicate_entry.tournament_id = duplicate_map.duplicate_id
and keep_entry.tournament_id = duplicate_map.keep_id
and keep_entry.student_id = duplicate_entry.student_id;

with duplicate_groups as (
  select
    lower(trim(name)) as name_key,
    lower(trim(coalesce(venue, ''))) as venue_key,
    starts_at::date as date_key,
    array_agg(id order by created_at asc, id asc) as ids
  from public.tournaments
  group by lower(trim(name)), lower(trim(coalesce(venue, ''))), starts_at::date
  having count(*) > 1
),
duplicate_map as (
  select
    duplicate_groups.ids[1] as keep_id,
    unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
update public.tournament_entries entry
set tournament_id = duplicate_map.keep_id
from duplicate_map
where entry.tournament_id = duplicate_map.duplicate_id;

with duplicate_groups as (
  select
    lower(trim(name)) as name_key,
    lower(trim(coalesce(venue, ''))) as venue_key,
    starts_at::date as date_key,
    array_agg(id order by created_at asc, id asc) as ids
  from public.tournaments
  group by lower(trim(name)), lower(trim(coalesce(venue, ''))), starts_at::date
  having count(*) > 1
),
duplicate_map as (
  select
    duplicate_groups.ids[1] as keep_id,
    unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
update public.tournaments keep_tournament
set
  external_source = coalesce(keep_tournament.external_source, duplicate_tournament.external_source),
  external_tournament_id = coalesce(keep_tournament.external_tournament_id, duplicate_tournament.external_tournament_id),
  external_synced_at = coalesce(keep_tournament.external_synced_at, duplicate_tournament.external_synced_at)
from duplicate_map
join public.tournaments duplicate_tournament on duplicate_tournament.id = duplicate_map.duplicate_id
where keep_tournament.id = duplicate_map.keep_id;

with duplicate_groups as (
  select
    lower(trim(name)) as name_key,
    lower(trim(coalesce(venue, ''))) as venue_key,
    starts_at::date as date_key,
    array_agg(id order by created_at asc, id asc) as ids
  from public.tournaments
  group by lower(trim(name)), lower(trim(coalesce(venue, ''))), starts_at::date
  having count(*) > 1
),
duplicate_map as (
  select unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
delete from public.tournaments tournament
using duplicate_map
where tournament.id = duplicate_map.duplicate_id;

create unique index if not exists tournaments_name_venue_starts_unique
on public.tournaments (lower(trim(name)), lower(trim(coalesce(venue, ''))), starts_at);
