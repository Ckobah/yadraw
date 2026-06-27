insert into workspaces (id, name, slug, settings, metadata)
values (
  '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
  'Acme Workspace',
  'acme-workspace',
  '{}'::jsonb,
  '{"seed": true}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    updated_at = now();

insert into workspace_members (workspace_id, user_id, role)
values
  (
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    '02f38bb1-0cde-4473-95ef-1d50db3467e4',
    'owner'
  ),
  (
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4',
    'editor'
  ),
  (
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    '9f18a762-bf5b-4aa8-b934-f286cc51dc5b',
    'viewer'
  )
on conflict (workspace_id, user_id) do update
set role = excluded.role,
    updated_at = now();

insert into projects (id, workspace_id, name, description, settings, metadata)
values (
  '8bdcdb31-40d7-4f66-b2b3-7f972e7f07d3',
  '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
  'Product Pipeline',
  'Demo product data workflow',
  '{}'::jsonb,
  '{"seed": true}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

insert into boards (id, project_id, workspace_id, name, description, viewport, settings)
values (
  'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
  '8bdcdb31-40d7-4f66-b2b3-7f972e7f07d3',
  '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
  'Main Board',
  'Product pipeline workflow',
  '{"x":0,"y":0,"zoom":1}'::jsonb,
  '{"snapToGrid":true}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    viewport = excluded.viewport,
    settings = excluded.settings,
    updated_at = now();

insert into card_types (workspace_id, key, name, description, icon, color, is_system)
values
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'trigger', 'Trigger', 'Receives external events.', 'radio-tower', 'green', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'ai_action', 'AI Action', 'Runs an AI operation.', 'sparkles', 'blue', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'database', 'Database', 'Reads or writes records.', 'database', 'purple', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'vector_store', 'Vector Store', 'Stores vector embeddings.', 'box', 'teal', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'storage', 'Storage', 'Stores files.', 'file-text', 'pink', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'note', 'Note', 'Free-form JSON note.', 'file-text', 'blue', true)
on conflict (workspace_id, key, version) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    updated_at = now();

with types as (
  select key, id
  from card_types
  where workspace_id = '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33'
)
insert into cards (id, workspace_id, board_id, type_id, title, description, status, data, position, size, style)
values
  (
    '67d1c197-2a85-47d1-9e32-8b03c32ff8d0',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'trigger'),
    '1. Webhook Trigger',
    'Receives an external order payload.',
    'active',
    '{"endpoint":"/webhook","method":"POST","_yadraw":{"typeKey":"trigger","inputs":[],"outputs":["payload"],"tags":["trigger"],"files":[{"id":"8bf62d90-5fb9-48ae-b242-121988499d68","filename":"schema.json","role":"source_document"}]}}'::jsonb,
    '{"x":120,"y":140}'::jsonb,
    '{"width":280,"height":170}'::jsonb,
    '{"accent":"green"}'::jsonb
  ),
  (
    '6bb48e57-ed49-4fd6-bdbc-a449b2756be9',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'ai_action'),
    '2. Enrich Data',
    'AI analyzes order data, fills gaps, and classifies items.',
    'active',
    '{"model":"gpt","mode":"suggest_changes","_yadraw":{"typeKey":"ai_action","inputs":["payload"],"outputs":["enriched_order","items"],"tags":["ai","enrich"],"files":[{"id":"63830d13-3317-4148-94ff-31005ef48e55","filename":"prompt.md","role":"source_document","sizeBytes":2100}]}}'::jsonb,
    '{"x":470,"y":138}'::jsonb,
    '{"width":300,"height":190}'::jsonb,
    '{"accent":"blue"}'::jsonb
  ),
  (
    'a67a335e-2bc2-4af7-a926-070c80a7a352',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'database'),
    '3. Save to Database',
    'Persists enriched order and item records.',
    'active',
    '{"table":"orders","_yadraw":{"typeKey":"database","inputs":["enriched_order","items"],"outputs":["order_id"],"tags":["database"],"files":[{"id":"7f0672e7-6f51-4178-b840-22d955137428","filename":"insert.sql","role":"source_document"}]}}'::jsonb,
    '{"x":850,"y":140}'::jsonb,
    '{"width":300,"height":170}'::jsonb,
    '{"accent":"purple"}'::jsonb
  ),
  (
    '9d99f039-b747-4c89-bd40-4756407aa8c4',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'ai_action'),
    '4. Generate Embedding',
    'Builds embeddings for semantic retrieval.',
    'active',
    '{"objectType":"card","_yadraw":{"typeKey":"ai_action","inputs":["enriched_order"],"outputs":["embedding"],"tags":["ai","embedding"],"files":[{"id":"464d260e-4462-4e86-bc09-c51cf9d4c524","filename":"embedding.json","role":"generated_document"}]}}'::jsonb,
    '{"x":180,"y":430}'::jsonb,
    '{"width":300,"height":185}'::jsonb,
    '{"accent":"orange"}'::jsonb
  ),
  (
    '1e6fa19e-0480-463f-b6bb-80983564246b',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'vector_store'),
    '5. Vector Store',
    'Stores searchable vector chunks.',
    'active',
    '{"index":"orders","_yadraw":{"typeKey":"vector_store","inputs":["embedding","order_id"],"outputs":["indexed"],"tags":["vector_store"],"files":[{"id":"d448846d-2bf9-4f5b-89bb-a989a8ae9fb8","filename":"index.json","role":"generated_document"}]}}'::jsonb,
    '{"x":560,"y":430}'::jsonb,
    '{"width":300,"height":185}'::jsonb,
    '{"accent":"teal"}'::jsonb
  ),
  (
    '86c367b6-4504-4f8c-867f-b66cfd9a63ac',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    (select id from types where key = 'storage'),
    '6. File Storage',
    'Stores files related to the order.',
    'active',
    '{"bucket":"workspace-files","fileCount":12,"_yadraw":{"typeKey":"storage","inputs":["files","order_id"],"outputs":[],"tags":["storage"],"files":[]}}'::jsonb,
    '{"x":900,"y":430}'::jsonb,
    '{"width":300,"height":175}'::jsonb,
    '{"accent":"pink"}'::jsonb
  )
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    data = excluded.data,
    position = excluded.position,
    size = excluded.size,
    style = excluded.style,
    updated_at = now();

insert into connection_types (workspace_id, key, name, description, is_system)
values
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'triggers', 'Triggers', 'Starts a downstream action.', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'provides_data_to', 'Provides Data To', 'Passes structured data.', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'generates', 'Generates', 'Creates a downstream object.', true),
  ('3cce8c2f-3d0f-49aa-89da-9f2f1f655b33', 'references', 'References', 'Links related data or files.', true)
on conflict (workspace_id, key, version) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

with types as (
  select key, id
  from connection_types
  where workspace_id = '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33'
)
insert into connections (id, workspace_id, board_id, source_card_id, target_card_id, source_handle, target_handle, type_id, label, status, contract, mapping, condition, style)
values
  (
    'eb8530de-8d60-49de-bb63-bdd7b4131232',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    '67d1c197-2a85-47d1-9e32-8b03c32ff8d0',
    '6bb48e57-ed49-4fd6-bdbc-a449b2756be9',
    'payload',
    'payload',
    (select id from types where key = 'triggers'),
    'payload',
    'active',
    '{"relation":"triggers"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'c2e29d44-2532-4700-9820-1f9e8966c0be',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    '6bb48e57-ed49-4fd6-bdbc-a449b2756be9',
    'a67a335e-2bc2-4af7-a926-070c80a7a352',
    'enriched_order',
    'enriched_order',
    (select id from types where key = 'provides_data_to'),
    'save order',
    'active',
    '{"relation":"provides_data_to"}'::jsonb,
    '{"enriched_order":"orders.payload"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'e1fb98f8-ed9f-44d8-88c6-99b39e4f0c8e',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    '6bb48e57-ed49-4fd6-bdbc-a449b2756be9',
    '9d99f039-b747-4c89-bd40-4756407aa8c4',
    'enriched_order',
    'enriched_order',
    (select id from types where key = 'generates'),
    'embed',
    'active',
    '{"relation":"generates"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '7d278d2b-190d-4e66-aa68-425ebfece20d',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    '9d99f039-b747-4c89-bd40-4756407aa8c4',
    '1e6fa19e-0480-463f-b6bb-80983564246b',
    'embedding',
    'embedding',
    (select id from types where key = 'provides_data_to'),
    'index',
    'active',
    '{"relation":"provides_data_to"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '5daa0bb9-9b07-4b4a-9da8-96ac035b4fa1',
    '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33',
    'b4f94635-6fd5-4a6b-8608-61a69c81fbe2',
    '1e6fa19e-0480-463f-b6bb-80983564246b',
    '86c367b6-4504-4f8c-867f-b66cfd9a63ac',
    'indexed',
    'order_id',
    (select id from types where key = 'references'),
    'attach files',
    'active',
    '{"relation":"references"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  )
on conflict (id) do update
set source_handle = excluded.source_handle,
    target_handle = excluded.target_handle,
    type_id = excluded.type_id,
    label = excluded.label,
    status = excluded.status,
    contract = excluded.contract,
    mapping = excluded.mapping,
    condition = excluded.condition,
    style = excluded.style,
    updated_at = now();
