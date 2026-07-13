insert into users (id, email, name, auth_provider, auth_subject)
values
  (
    '02f38bb1-0cde-4473-95ef-1d50db3467e4',
    'owner@local.invalid',
    'Local owner',
    'legacy',
    '02f38bb1-0cde-4473-95ef-1d50db3467e4'
  ),
  (
    'bb7ef8c4-91fd-4f3a-86d2-fb760a532c45',
    'editor@local.invalid',
    'Local editor',
    'legacy',
    'bb7ef8c4-91fd-4f3a-86d2-fb760a532c45'
  ),
  (
    '9f18a762-53e5-4922-9b0b-8f168921bb0f',
    'viewer@local.invalid',
    'Local viewer',
    'legacy',
    '9f18a762-53e5-4922-9b0b-8f168921bb0f'
  )
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    auth_provider = excluded.auth_provider,
    auth_subject = excluded.auth_subject,
    updated_at = now(),
    deleted_at = null;

insert into workspaces (id, name, slug, owner_user_id)
values (
  '11111111-1111-4111-8111-111111111111',
  'Local Workspace',
  'local-workspace',
  '02f38bb1-0cde-4473-95ef-1d50db3467e4'
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    owner_user_id = excluded.owner_user_id,
    updated_at = now(),
    deleted_at = null;

insert into workspace_members (workspace_id, user_id, role)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '02f38bb1-0cde-4473-95ef-1d50db3467e4',
    'owner'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'bb7ef8c4-91fd-4f3a-86d2-fb760a532c45',
    'editor'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '9f18a762-53e5-4922-9b0b-8f168921bb0f',
    'viewer'
  )
on conflict (workspace_id, user_id) do update
set role = excluded.role,
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
    196,
    122
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    'task',
    'Task',
    'Transforms input data.',
    '{"kind":"task"}'::jsonb,
    196,
    122
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

insert into connection_types (
  id,
  workspace_id,
  key,
  name,
  description,
  schema,
  default_visual_style
)
values
  (
    '99999999-9999-4999-8999-999999999991',
    '11111111-1111-4111-8111-111111111111',
    'generic',
    'Generic',
    'Default relationship type.',
    '{"fields":[]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '99999999-9999-4999-8999-999999999992',
    '11111111-1111-4111-8111-111111111111',
    'contains',
    'Contains',
    'One card contains another.',
    '{"fields":[{"key":"quantity","label":"Quantity per assembly","type":"number","required":true,"defaultValue":1,"numberConstraints":{"min":0,"integer":true}},{"key":"unit","label":"Unit","type":"select","required":true,"defaultValue":"piece","options":[{"value":"piece","label":"pcs"},{"value":"pcs","label":"pcs (legacy)"}]},{"key":"note","label":"Note","type":"text"}],"semantics":{"version":1,"sourceRole":"component","targetRole":"assembly","quantity":{"valueField":"quantity","unitField":"unit","basis":"per_target","targetMultiplierField":"plannedQuantity","aggregation":"sum"}}}'::jsonb,
    '{}'::jsonb
  ),
  (
    '99999999-9999-4999-8999-999999999993',
    '11111111-1111-4111-8111-111111111111',
    'supplies',
    'Supplies',
    'A supplier relationship.',
    '{"fields":[{"key":"price","label":"Price","type":"number"},{"key":"currency","label":"Currency","type":"text"},{"key":"leadTimeDays","label":"Lead time days","type":"number"},{"key":"minOrderQty","label":"Minimum order quantity","type":"number"},{"key":"note","label":"Note","type":"text"}]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '99999999-9999-4999-8999-999999999994',
    '11111111-1111-4111-8111-111111111111',
    'uses',
    'Uses',
    'One card uses another.',
    '{"fields":[{"key":"quantity","label":"Quantity","type":"number"},{"key":"unit","label":"Unit","type":"text"},{"key":"note","label":"Note","type":"text"}]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '99999999-9999-4999-8999-999999999995',
    '11111111-1111-4111-8111-111111111111',
    'depends_on',
    'Depends on',
    'A dependency relationship.',
    '{"fields":[{"key":"dependencyType","label":"Dependency type","type":"text"},{"key":"lagDays","label":"Lag days","type":"number"},{"key":"note","label":"Note","type":"text"}]}'::jsonb,
    '{}'::jsonb
  )
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    key = excluded.key,
    name = excluded.name,
    description = excluded.description,
    schema = excluded.schema,
    default_visual_style = excluded.default_visual_style,
    updated_at = now(),
    deleted_at = null;

insert into cards (
  id,
  workspace_id,
  board_id,
  card_type_id,
  title,
  description,
  data,
  position_x,
  position_y,
  width,
  height,
  visual_style,
  status
)
values
  (
    '77777777-7777-4777-8777-777777777771',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'Incoming data',
    'Source payload for the board.',
    '{"kind":"source","endpoint":"/input"}'::jsonb,
    120,
    160,
    196,
    122,
    '{}'::jsonb,
    'active'
  ),
  (
    '77777777-7777-4777-8777-777777777772',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555',
    'Normalize payload',
    'Transforms incoming data into a clean JSON shape.',
    '{"kind":"task","operation":"normalize"}'::jsonb,
    390,
    160,
    196,
    122,
    '{}'::jsonb,
    'active'
  )
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    board_id = excluded.board_id,
    card_type_id = excluded.card_type_id,
    title = excluded.title,
    description = excluded.description,
    data = excluded.data,
    position_x = excluded.position_x,
    position_y = excluded.position_y,
    width = excluded.width,
    height = excluded.height,
    visual_style = excluded.visual_style,
    status = excluded.status,
    updated_at = now(),
    deleted_at = null;

insert into connections (
  id,
  workspace_id,
  board_id,
  connection_type_id,
  source_card_id,
  target_card_id,
  source_port_key,
  target_port_key,
  type,
  label,
  status
)
values (
  '88888888-8888-4888-8888-888888888881',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '99999999-9999-4999-8999-999999999991',
  '77777777-7777-4777-8777-777777777771',
  '77777777-7777-4777-8777-777777777772',
  'payload',
  'input',
  'data',
  'payload',
  'active'
)
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    board_id = excluded.board_id,
    connection_type_id = excluded.connection_type_id,
    source_card_id = excluded.source_card_id,
    target_card_id = excluded.target_card_id,
    source_port_key = excluded.source_port_key,
    target_port_key = excluded.target_port_key,
    type = excluded.type,
    label = excluded.label,
    status = excluded.status,
    updated_at = now(),
    deleted_at = null;
