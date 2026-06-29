do $$ begin
  create type workspace_role as enum ('owner', 'admin', 'editor', 'viewer', 'service');
exception
  when duplicate_object then null;
end $$;

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint workspace_members_workspace_user_unique unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on workspace_members(user_id)
  where deleted_at is null;

create index if not exists workspace_members_workspace_id_idx
  on workspace_members(workspace_id)
  where deleted_at is null;

drop trigger if exists trg_workspace_members_updated_at on workspace_members;
create trigger trg_workspace_members_updated_at
before update on workspace_members
for each row execute function set_updated_at();
