alter table public.tournaments
add column if not exists tournament_categories jsonb not null default '[
  "Form",
  "Weapons Form",
  "Escrima Sparring",
  "Sparring",
  "Sword Sparring",
  "Continuous Sparring",
  "Inventive",
  "Elevate"
]'::jsonb;
