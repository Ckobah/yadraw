insert into workspaces (id, name, slug)
values (
  '11111111-1111-4111-8111-111111111111',
  'Local Workspace',
  'local-workspace'
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    updated_at = now(),
    deleted_at = null;

insert into projects (id, workspace_id, name)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Core Project'
)
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    name = excluded.name,
    updated_at = now(),
    deleted_at = null;

insert into boards (
  id,
  workspace_id,
  project_id,
  name,
  viewport_x,
  viewport_y,
  viewport_zoom
)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'Main Board',
  0,
  0,
  1
)
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    project_id = excluded.project_id,
    name = excluded.name,
    viewport_x = excluded.viewport_x,
    viewport_y = excluded.viewport_y,
    viewport_zoom = excluded.viewport_zoom,
    updated_at = now(),
    deleted_at = null;

insert into card_types (
  id,
  workspace_id,
  key,
  name,
  description,
  default_data,
  default_width,
  default_height
)
values
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'source',
    'Source',
    'Provides input data.',
    '{"kind":"source"}'::jsonb,
    280,
    160
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    'task',
    'Task',
    'Transforms input data.',
    '{"kind":"task"}'::jsonb,
    300,
    180
  )
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    key = excluded.key,
    name = excluded.name,
    description = excluded.description,
    default_data = excluded.default_data,
    default_width = excluded.default_width,
    default_height = excluded.default_height,
    updated_at = now(),
    deleted_at = null;

insert into card_type_ports (
  id,
  workspace_id,
  card_type_id,
  key,
  label,
  direction,
  data_type,
  required,
  sort_order
)
values
  (
    '66666666-6666-4666-8666-666666666661',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'payload',
    'Payload',
    'output',
    'json',
    true,
    0
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'input',
    'Input',
    'input',
    'json',
    true,
    0
  ),
  (
    '66666666-6666-4666-8666-666666666663',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'result',
    'Result',
    'output',
    'json',
    false,
    1
  )
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    card_type_id = excluded.card_type_id,
    key = excluded.key,
    label = excluded.label,
    direction = excluded.direction,
    data_type = excluded.data_type,
    required = excluded.required,
    sort_order = excluded.sort_order,
    updated_at = now(),
    deleted_at = null;
