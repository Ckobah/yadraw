alter table card_types
add column if not exists default_visual_style jsonb not null default '{}'::jsonb;

comment on column card_types.default_visual_style is
  'Default card visual presentation for new cards of this type. Separate from card data, schema, and default_data.';
