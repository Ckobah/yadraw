create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

do $$ begin
  create type workspace_role as enum ('owner', 'admin', 'editor', 'viewer', 'guest', 'service');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type card_status as enum ('draft', 'active', 'approved', 'archived', 'error', 'deleted');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type connection_status as enum ('draft', 'active', 'disabled', 'error', 'deleted');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type file_processing_status as enum ('pending', 'processing', 'processed', 'failed');
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
  slug text unique,
  owner_id uuid,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role workspace_role not null default 'viewer',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  viewport jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  yjs_state bytea,
  latest_snapshot_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists card_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  json_schema jsonb not null default '{}'::jsonb,
  ui_schema jsonb not null default '{}'::jsonb,
  default_data jsonb not null default '{}'::jsonb,
  icon text,
  color text,
  allowed_connection_type_keys text[] not null default '{}',
  allowed_handles jsonb not null default '{}'::jsonb,
  version int not null default 1,
  is_system boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, key, version)
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  type_id uuid references card_types(id) on delete set null,
  title text not null default '',
  description text,
  status card_status not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  position jsonb not null default '{"x":0,"y":0}'::jsonb,
  size jsonb not null default '{"width":320,"height":180}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  search_text tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(data::text, '')
    )
  ) stored,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cards_position_is_object check (jsonb_typeof(position) = 'object'),
  constraint cards_size_is_object check (jsonb_typeof(size) = 'object'),
  constraint cards_data_is_object check (jsonb_typeof(data) = 'object')
);

create table if not exists connection_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  contract_schema jsonb not null default '{}'::jsonb,
  mapping_schema jsonb not null default '{}'::jsonb,
  condition_schema jsonb not null default '{}'::jsonb,
  visual_style jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  version int not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, key, version)
);

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  source_card_id uuid not null references cards(id) on delete cascade,
  target_card_id uuid not null references cards(id) on delete cascade,
  source_handle text,
  target_handle text,
  type_id uuid references connection_types(id) on delete set null,
  label text,
  status connection_status not null default 'draft',
  contract jsonb not null default '{}'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  condition jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint connections_no_self_loop check (source_card_id <> target_card_id),
  constraint connections_contract_is_object check (jsonb_typeof(contract) = 'object'),
  constraint connections_mapping_is_object check (jsonb_typeof(mapping) = 'object'),
  constraint connections_condition_is_object check (jsonb_typeof(condition) = 'object')
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  storage_bucket text not null default 'workspace-files',
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  extracted_text text,
  processing_status file_processing_status not null default 'pending',
  processing_error jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(storage_bucket, storage_path)
);

create table if not exists card_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  role text not null default 'attachment',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(card_id, file_id, role)
);

create table if not exists board_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  snapshot jsonb not null,
  yjs_state bytea,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table boards
  drop constraint if exists fk_boards_latest_snapshot;

alter table boards
  add constraint fk_boards_latest_snapshot
  foreign key (latest_snapshot_id)
  references board_snapshots(id)
  on delete set null;

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  actor_id uuid,
  action text not null,
  object_type text not null,
  object_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  chunk_index int not null default 0,
  content text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique(object_type, object_id, chunk_index, content_hash)
);

create index if not exists idx_workspaces_owner_id on workspaces(owner_id);
create index if not exists idx_workspace_members_workspace_id on workspace_members(workspace_id);
create index if not exists idx_projects_workspace_id on projects(workspace_id);
create index if not exists idx_boards_project_id on boards(project_id);
create index if not exists idx_boards_workspace_id on boards(workspace_id);
create index if not exists idx_card_types_workspace_id on card_types(workspace_id);
create index if not exists idx_cards_workspace_id on cards(workspace_id);
create index if not exists idx_cards_board_id on cards(board_id);
create index if not exists idx_cards_status on cards(status);
create index if not exists idx_cards_data_gin on cards using gin(data);
create index if not exists idx_cards_search_text on cards using gin(search_text);
create index if not exists idx_cards_title_trgm on cards using gin(title gin_trgm_ops);
create index if not exists idx_connections_workspace_id on connections(workspace_id);
create index if not exists idx_connections_board_id on connections(board_id);
create index if not exists idx_connections_source_card_id on connections(source_card_id);
create index if not exists idx_connections_target_card_id on connections(target_card_id);
create index if not exists idx_files_workspace_id on files(workspace_id);
create index if not exists idx_files_processing_status on files(processing_status);
create index if not exists idx_card_files_card_id on card_files(card_id);
create index if not exists idx_board_snapshots_board_id on board_snapshots(board_id);
create index if not exists idx_activity_log_object on activity_log(object_type, object_id);
create index if not exists idx_embeddings_workspace_id on embeddings(workspace_id);
create index if not exists idx_embeddings_object on embeddings(object_type, object_id);

drop trigger if exists trg_workspaces_updated_at on workspaces;
create trigger trg_workspaces_updated_at before update on workspaces for each row execute function set_updated_at();

drop trigger if exists trg_workspace_members_updated_at on workspace_members;
create trigger trg_workspace_members_updated_at before update on workspace_members for each row execute function set_updated_at();

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects for each row execute function set_updated_at();

drop trigger if exists trg_boards_updated_at on boards;
create trigger trg_boards_updated_at before update on boards for each row execute function set_updated_at();

drop trigger if exists trg_card_types_updated_at on card_types;
create trigger trg_card_types_updated_at before update on card_types for each row execute function set_updated_at();

drop trigger if exists trg_cards_updated_at on cards;
create trigger trg_cards_updated_at before update on cards for each row execute function set_updated_at();

drop trigger if exists trg_connection_types_updated_at on connection_types;
create trigger trg_connection_types_updated_at before update on connection_types for each row execute function set_updated_at();

drop trigger if exists trg_connections_updated_at on connections;
create trigger trg_connections_updated_at before update on connections for each row execute function set_updated_at();

drop trigger if exists trg_files_updated_at on files;
create trigger trg_files_updated_at before update on files for each row execute function set_updated_at();
