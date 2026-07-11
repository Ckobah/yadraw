alter table boards
  add column if not exists archived_at timestamptz null;

create index if not exists boards_workspace_archived_idx
  on boards (workspace_id, archived_at, updated_at desc)
  where deleted_at is null;
