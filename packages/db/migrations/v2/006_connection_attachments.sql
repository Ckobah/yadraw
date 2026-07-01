create table if not exists connection_files (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,

  role text not null default 'attachment',
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid,
  created_at timestamptz not null default now(),

  deleted_at timestamptz,

  constraint connection_files_role_not_blank check (length(trim(role)) > 0),
  constraint connection_files_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists connection_files_workspace_idx
  on connection_files(workspace_id)
  where deleted_at is null;

create index if not exists connection_files_connection_idx
  on connection_files(connection_id)
  where deleted_at is null;

create index if not exists connection_files_file_idx
  on connection_files(file_id)
  where deleted_at is null;

create unique index if not exists connection_files_unique_active_idx
  on connection_files(connection_id, file_id)
  where deleted_at is null;
