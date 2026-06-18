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
duplicates as (
  select
    duplicate_groups.ids[1] as keep_id,
    unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
update public.tournament_entries entry
set tournament_id = duplicates.keep_id
from duplicates
where entry.tournament_id = duplicates.duplicate_id;

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
duplicates as (
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
from duplicates
join public.tournaments duplicate_tournament on duplicate_tournament.id = duplicates.duplicate_id
where keep_tournament.id = duplicates.keep_id;

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
duplicates as (
  select unnest(duplicate_groups.ids[2:array_length(duplicate_groups.ids, 1)]) as duplicate_id
  from duplicate_groups
)
delete from public.tournaments tournament
using duplicates
where tournament.id = duplicates.duplicate_id;
