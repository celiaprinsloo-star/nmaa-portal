alter table public.instructors
add column if not exists rank text,
add column if not exists collar_level text,
add column if not exists certification_date date;

update public.instructors
set
  rank = coalesce(rank, certification_level),
  certification_date = coalesce(certification_date, training_expires_at)
where rank is null
   or certification_date is null;

alter table public.compliance_documents
add column if not exists file_name text,
add column if not exists file_type text,
add column if not exists file_size integer;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
