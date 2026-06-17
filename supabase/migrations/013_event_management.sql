alter table public.events
add column if not exists description text,
add column if not exists capacity integer,
add column if not exists status text not null default 'open';

alter table public.event_bookings
add column if not exists attendee_phone text,
add column if not exists attendee_type text,
add column if not exists notes text;
