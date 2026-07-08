create table if not exists connection_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text null,
  schema jsonb not null default '{"fields":[]}'::jsonb,
  default_visual_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint connection_types_workspace_id_id_unique unique (workspace_id, id),
  constraint connection_types_key_not_blank check (length(trim(key)) > 0),
  constraint connection_types_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint connection_types_name_not_blank check (length(trim(name)) > 0),
  constraint connection_types_schema_is_object check (jsonb_typeof(schema) = 'object'),
  constraint connection_types_default_visual_style_is_object check (jsonb_typeof(default_visual_style) = 'object')
);

create unique index if not exists connection_types_workspace_key_active_unique
  on connection_types(workspace_id, key)
  where deleted_at is null;

create index if not exists connection_types_workspace_id_idx
  on connection_types(workspace_id);

alter table connections
  add column if not exists connection_type_id uuid null references connection_types(id);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'connections_connection_type_workspace_consistency'
  ) then
    alter table connections
      add constraint connections_connection_type_workspace_consistency
      foreign key (workspace_id, connection_type_id)
      references connection_types(workspace_id, id);
  end if;
end $$;

create index if not exists connections_connection_type_id_idx
  on connections(connection_type_id);

insert into connection_types (
  workspace_id,
  key,
  name,
  description,
  schema,
  default_visual_style
)
select
  w.id,
  'generic',
  'Generic',
  'Default relationship type.',
  '{"fields":[]}'::jsonb,
  '{}'::jsonb
from workspaces w
where w.deleted_at is null
  and not exists (
    select 1
    from connection_types ct
    where ct.workspace_id = w.id
      and ct.key = 'generic'
      and ct.deleted_at is null
  );

drop trigger if exists trg_connection_types_updated_at on connection_types;
create trigger trg_connection_types_updated_at
before update on connection_types
for each row execute function set_updated_at();
