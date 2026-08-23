alter table public.tournaments
add column if not exists age_calculation_basis text not null default 'competition_date';

alter table public.tournaments
drop constraint if exists tournaments_age_calculation_basis_check;

alter table public.tournaments
add constraint tournaments_age_calculation_basis_check
check (age_calculation_basis in ('competition_date', 'year_end'));
