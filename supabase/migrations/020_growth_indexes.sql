create index if not exists schools_province_status_idx
on public.schools(province_id, affiliation_status);

create index if not exists schools_contact_email_idx
on public.schools(contact_email);

create index if not exists students_status_idx
on public.students(membership_status);

create index if not exists students_school_status_rank_idx
on public.students(school_id, membership_status, belt_rank);

create index if not exists students_school_gender_race_idx
on public.students(school_id, gender, race);

create index if not exists instructors_school_status_rank_idx
on public.instructors(school_id, training_status, rank);

create index if not exists instructors_school_collar_idx
on public.instructors(school_id, collar_level);

create index if not exists events_starts_status_idx
on public.events(starts_at, status);

create index if not exists events_school_starts_idx
on public.events(school_id, starts_at);

create index if not exists event_bookings_event_school_type_idx
on public.event_bookings(event_id, school_id, attendee_type);

create index if not exists tournament_entries_school_category_medal_idx
on public.tournament_entries(school_id, category, medal);

create index if not exists tournament_entries_student_tournament_idx
on public.tournament_entries(student_id, tournament_id);

create index if not exists school_orders_status_created_idx
on public.school_orders(status, created_at desc);

create index if not exists school_orders_school_created_idx
on public.school_orders(school_id, created_at desc);

create index if not exists compliance_requirements_category_active_idx
on public.compliance_requirements(category, active);

create index if not exists compliance_documents_expires_status_idx
on public.compliance_documents(expires_at, status);

create index if not exists profiles_requested_role_status_idx
on public.profiles(requested_role, approval_status);
