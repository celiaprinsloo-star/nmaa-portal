insert into public.provinces (name, code)
values
  ('Eastern Cape', 'EC'),
  ('Free State', 'FS'),
  ('Gauteng', 'GP'),
  ('KwaZulu-Natal', 'KZN'),
  ('Limpopo', 'LP'),
  ('Mpumalanga', 'MP'),
  ('Northern Cape', 'NC'),
  ('North West', 'NW'),
  ('Western Cape', 'WC')
on conflict (code) do update
set name = excluded.name;
