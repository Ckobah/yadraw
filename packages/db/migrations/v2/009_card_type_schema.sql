alter table card_types
  add column if not exists schema jsonb not null default '{"fields":[]}'::jsonb;
