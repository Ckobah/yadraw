create table if not exists v2_card_field_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  board_id uuid not null references boards(id),
  target_card_id uuid not null references cards(id),
  target_field text not null,
  source_mode text not null,
  connection_direction text not null,
  source_card_id uuid null references cards(id),
  source_card_type_id uuid null references card_types(id),
  source_card_type_key text null,
  source_field_path text not null,
  on_missing text not null default 'empty',
  on_multiple text not null default 'warning',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint v2_card_field_bindings_source_mode_check
    check (source_mode in ('exactCard', 'connectedCard')),
  constraint v2_card_field_bindings_direction_check
    check (connection_direction in ('incoming', 'outgoing')),
  constraint v2_card_field_bindings_on_missing_check
    check (on_missing in ('empty')),
  constraint v2_card_field_bindings_on_multiple_check
    check (on_multiple in ('warning')),
  constraint v2_card_field_bindings_status_check
    check (status in ('active', 'deleted')),
  constraint v2_card_field_bindings_target_field_check
    check (length(trim(target_field)) > 0),
  constraint v2_card_field_bindings_source_field_path_check
    check (length(trim(source_field_path)) > 0)
);

create index if not exists idx_v2_card_field_bindings_workspace_id
  on v2_card_field_bindings (workspace_id);

create index if not exists idx_v2_card_field_bindings_board_id
  on v2_card_field_bindings (board_id);

create index if not exists idx_v2_card_field_bindings_target_card_id
  on v2_card_field_bindings (target_card_id);

create index if not exists idx_v2_card_field_bindings_deleted_at
  on v2_card_field_bindings (deleted_at);
