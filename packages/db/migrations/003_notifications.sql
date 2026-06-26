create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  object_type text,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created_at on notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on notifications(user_id, read_at) where read_at is null;
create index if not exists idx_notifications_workspace_id on notifications(workspace_id);

insert into notifications (
  id,
  workspace_id,
  user_id,
  type,
  title,
  body,
  object_type,
  object_id,
  metadata,
  read_at,
  created_at
)
values
  (
    '10d919f0-a73f-4317-a5bc-4579e276ca12',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    '02f38bb1-0cde-4473-95ef-1d50db3467e4',
    'file_uploaded',
    'File metadata attached',
    'prompt.md is linked to 2. Enrich Data.',
    'card',
    '6bb48e57-ed49-4fd6-bdbc-a449b2756be9',
    '{"filename":"prompt.md"}'::jsonb,
    null,
    '2026-06-26T06:10:00.000Z'
  ),
  (
    '562ad694-e7fc-4132-b477-0779dc7fba99',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    '02f38bb1-0cde-4473-95ef-1d50db3467e4',
    'card_saved',
    'Board card saved',
    '5. Vector Store was updated on the board.',
    'card',
    '1e6fa19e-0480-463f-b6bb-80983564246b',
    '{"status":"active"}'::jsonb,
    '2026-06-26T06:20:00.000Z',
    '2026-06-26T06:05:00.000Z'
  ),
  (
    '8a6bf90c-8bf6-4f0c-86db-32145530d59d',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4',
    'share_invite',
    'Workspace access changed',
    'You were added to Acme Workspace as editor.',
    'workspace',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    '{"role":"editor"}'::jsonb,
    null,
    '2026-06-26T06:00:00.000Z'
  )
on conflict (id) do update
set title = excluded.title,
    body = excluded.body,
    metadata = excluded.metadata;
