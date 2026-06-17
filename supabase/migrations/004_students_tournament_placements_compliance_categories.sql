alter table public.compliance_requirements
add column if not exists category text not null default 'general';

alter table public.tournament_entries
add column if not exists placement integer,
add column if not exists result_label text,
add column if not exists medal text,
add column if not exists points numeric(8, 2);

insert into public.compliance_requirements
  (name, description, category, applies_to, renewal_period_months, active)
values
  ('Safeguarding clearance', 'Safeguarding clearance for adults working with students.', 'safeguarding', 'instructor', 12, true),
  ('First aid certification', 'Valid first aid training for instructors and school staff.', 'first_aid', 'instructor', 24, true),
  ('NQF training record', 'NQF-linked training record or equivalent recognised training evidence.', 'nqf_training', 'instructor', 36, true),
  ('Instructor training status', 'Current instructor development, renewal, or assessment status.', 'instructor_training', 'instructor', 12, true),
  ('School safeguarding policy', 'School-level safeguarding policy and acknowledgement.', 'safeguarding', 'school', 12, true)
on conflict (name) do update
set
  description = excluded.description,
  category = excluded.category,
  applies_to = excluded.applies_to,
  renewal_period_months = excluded.renewal_period_months,
  active = excluded.active;
