create index if not exists schools_name_idx
on public.schools(name);

create index if not exists students_school_gender_idx
on public.students(school_id, gender);

create index if not exists students_school_race_idx
on public.students(school_id, race);

create index if not exists students_school_birth_date_idx
on public.students(school_id, date_of_birth);

create index if not exists instructors_school_active_idx
on public.instructors(school_id, active);

create index if not exists compliance_requirements_active_applies_to_idx
on public.compliance_requirements(active, applies_to);

create index if not exists compliance_documents_school_requirement_instructor_idx
on public.compliance_documents(school_id, requirement_id, instructor_id);

create index if not exists compliance_documents_school_status_expires_idx
on public.compliance_documents(school_id, status, expires_at);

create index if not exists compliance_documents_school_id_idx
on public.compliance_documents(school_id);
