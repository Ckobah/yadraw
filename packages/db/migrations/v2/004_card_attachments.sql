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

  processing_status text not null default 'pending',
  processing_error jsonb,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint files_workspace_id_id_unique unique (workspace_id, id),
  constraint files_storage_bucket_not_blank check (length(trim(storage_bucket)) > 0),
  constraint files_storage_path_not_blank check (length(trim(storage_path)) > 0),
  constraint files_filename_not_blank check (length(trim(filename)) > 0),
  constraint files_size_bytes_nonnegative check (size_bytes is null or size_bytes >= 0),
  constraint files_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint files_processing_error_is_object check (
    processing_error is null or jsonb_typeof(processing_error) = 'object'
  ),
  constraint files_processing_status_allowed check (
    processing_status in ('pending', 'processing', 'processed', 'failed')
  )
);

create unique index if not exists files_storage_unique_idx
  on files(storage_bucket, storage_path)
  where deleted_at is null;

create index if not exists files_workspace_idx
  on files(workspace_id)
  where deleted_at is null;

create index if not exists files_processing_status_idx
  on files(processing_status)
  where deleted_at is null;

create table if not exists card_files (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,

  role text not null default 'attachment',
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid,
  created_at timestamptz not null default now(),

  deleted_at timestamptz,

  constraint card_files_role_not_blank check (length(trim(role)) > 0),
  constraint card_files_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists card_files_card_idx
  on card_files(card_id)
  where deleted_at is null;

create index if not exists card_files_file_idx
  on card_files(file_id)
  where deleted_at is null;

create index if not exists card_files_workspace_idx
  on card_files(workspace_id)
  where deleted_at is null;

create unique index if not exists card_files_unique_active_idx
  on card_files(card_id, file_id, role)
  where deleted_at is null;

drop trigger if exists trg_files_updated_at on files;
create trigger trg_files_updated_at
before update on files
for each row execute function set_updated_at();
