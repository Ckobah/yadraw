create extension if not exists "pgcrypto";

do $$ begin
  create type card_status as enum ('draft', 'active', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type port_direction as enum ('input', 'output');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type connection_status as enum ('active', 'disabled');
exception
  when duplicate_object then null;
end $$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint workspaces_name_not_blank check (length(trim(name)) > 0),
  constraint workspaces_slug_not_blank check (length(trim(slug)) > 0),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

create unique index if not exists workspaces_slug_active_unique
  on workspaces(slug)
  where deleted_at is null;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint projects_workspace_id_id_unique unique (workspace_id, id),
  constraint projects_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists projects_workspace_id_idx
  on projects(workspace_id)
  where deleted_at is null;

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  viewport_x numeric not null default 0,
  viewport_y numeric not null default 0,
  viewport_zoom numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint boards_name_not_blank check (length(trim(name)) > 0),
  constraint boards_workspace_id_id_unique unique (workspace_id, id),
  constraint boards_viewport_zoom_positive check (viewport_zoom > 0),
  constraint boards_workspace_project_consistency
    foreign key (workspace_id, project_id)
    references projects(workspace_id, id)
);

create index if not exists boards_project_id_idx
  on boards(project_id)
  where deleted_at is null;

create index if not exists boards_workspace_id_idx
  on boards(workspace_id)
  where deleted_at is null;

create table if not exists card_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  default_data jsonb not null default '{}'::jsonb,
  default_width numeric not null default 300,
  default_height numeric not null default 180,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint card_types_workspace_id_id_unique unique (workspace_id, id),
  constraint card_types_key_not_blank check (length(trim(key)) > 0),
  constraint card_types_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint card_types_name_not_blank check (length(trim(name)) > 0),
  constraint card_types_default_data_is_object check (jsonb_typeof(default_data) = 'object'),
  constraint card_types_default_width_positive check (default_width > 0),
  constraint card_types_default_height_positive check (default_height > 0)
);

create unique index if not exists card_types_workspace_key_active_unique
  on card_types(workspace_id, key)
  where deleted_at is null;

create index if not exists card_types_workspace_id_idx
  on card_types(workspace_id)
  where deleted_at is null;

create table if not exists card_type_ports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_type_id uuid not null references card_types(id) on delete cascade,
  key text not null,
  label text not null,
  direction port_direction not null,
  data_type text not null default 'json',
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint card_type_ports_key_not_blank check (length(trim(key)) > 0),
  constraint card_type_ports_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint card_type_ports_label_not_blank check (length(trim(label)) > 0),
  constraint card_type_ports_data_type_not_blank check (length(trim(data_type)) > 0),
  constraint card_type_ports_workspace_type_consistency
    foreign key (workspace_id, card_type_id)
    references card_types(workspace_id, id)
);

create unique index if not exists card_type_ports_type_direction_key_active_unique
  on card_type_ports(card_type_id, direction, key)
  where deleted_at is null;

create index if not exists card_type_ports_card_type_id_idx
  on card_type_ports(card_type_id, direction, sort_order)
  where deleted_at is null;

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  card_type_id uuid not null references card_types(id),
  title text not null,
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  width numeric not null default 300,
  height numeric not null default 180,
  status card_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint cards_board_id_id_unique unique (board_id, id),
  constraint cards_title_not_blank check (length(trim(title)) > 0),
  constraint cards_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint cards_data_no_internal_yadraw check (not (data ? '_yadraw')),
  constraint cards_width_positive check (width > 0),
  constraint cards_height_positive check (height > 0),
  constraint cards_workspace_board_consistency
    foreign key (workspace_id, board_id)
    references boards(workspace_id, id),
  constraint cards_workspace_type_consistency
    foreign key (workspace_id, card_type_id)
    references card_types(workspace_id, id)
);

create index if not exists cards_board_id_idx
  on cards(board_id)
  where deleted_at is null;

create index if not exists cards_workspace_id_idx
  on cards(workspace_id)
  where deleted_at is null;

create index if not exists cards_card_type_id_idx
  on cards(card_type_id)
  where deleted_at is null;

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  source_card_id uuid not null references cards(id),
  target_card_id uuid not null references cards(id),
  source_port_key text not null,
  target_port_key text not null,
  type text not null default 'data',
  label text not null default '',
  status connection_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint connections_no_self_loop check (source_card_id <> target_card_id),
  constraint connections_source_port_key_not_blank check (length(trim(source_port_key)) > 0),
  constraint connections_target_port_key_not_blank check (length(trim(target_port_key)) > 0),
  constraint connections_type_not_blank check (length(trim(type)) > 0),
  constraint connections_workspace_board_consistency
    foreign key (workspace_id, board_id)
    references boards(workspace_id, id),
  constraint connections_source_card_on_board
    foreign key (board_id, source_card_id)
    references cards(board_id, id),
  constraint connections_target_card_on_board
    foreign key (board_id, target_card_id)
    references cards(board_id, id)
);

create unique index if not exists connections_active_unique
  on connections(board_id, source_card_id, source_port_key, target_card_id, target_port_key, type)
  where deleted_at is null;

create index if not exists connections_board_id_idx
  on connections(board_id)
  where deleted_at is null;

create index if not exists connections_source_card_id_idx
  on connections(source_card_id)
  where deleted_at is null;

create index if not exists connections_target_card_id_idx
  on connections(target_card_id)
  where deleted_at is null;

drop trigger if exists trg_workspaces_updated_at on workspaces;
create trigger trg_workspaces_updated_at
before update on workspaces
for each row execute function set_updated_at();

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
before update on projects
for each row execute function set_updated_at();

drop trigger if exists trg_boards_updated_at on boards;
create trigger trg_boards_updated_at
before update on boards
for each row execute function set_updated_at();

drop trigger if exists trg_card_types_updated_at on card_types;
create trigger trg_card_types_updated_at
before update on card_types
for each row execute function set_updated_at();

drop trigger if exists trg_card_type_ports_updated_at on card_type_ports;
create trigger trg_card_type_ports_updated_at
before update on card_type_ports
for each row execute function set_updated_at();

drop trigger if exists trg_cards_updated_at on cards;
create trigger trg_cards_updated_at
before update on cards
for each row execute function set_updated_at();

drop trigger if exists trg_connections_updated_at on connections;
create trigger trg_connections_updated_at
before update on connections
for each row execute function set_updated_at();
