# DATABASE_SCHEMA.md

# Схема базы данных для визуальной системы JSON-карточек, связей, файлов, AI-поиска и workflow

## 0. Назначение документа

Этот документ описывает базовую production-ready схему PostgreSQL/Supabase-compatible базы данных для системы, где:

- доска — это визуальный граф;
- карточка — это JSON-сущность;
- связь — это смысловой контракт между карточками;
- файлы прикрепляются к карточкам;
- данные индексируются для full-text и vector search;
- система поддерживает совместное редактирование, версии, audit log и workflow-исполнение.

Архитектурная идея:

```text
PostgreSQL       — источник истины
JSONB            — гибкая структура карточек и связей
pgvector         — semantic search / embeddings
Object Storage   — файлы
Yjs/Hocuspocus   — live collaboration
Snapshots        — восстановление состояния доски
Workers          — file processing, embeddings, workflow execution
```

---

# 1. PostgreSQL extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";
```

Если используется Supabase, `auth.users` уже существует.  
Если используется чистый PostgreSQL, нужно создать собственную таблицу пользователей или подключить внешний identity provider.

---

# 2. Общие соглашения

## 2.1. UUID

Все основные сущности используют `uuid`.

```sql
id uuid primary key default gen_random_uuid()
```

## 2.2. Timestamps

Почти все таблицы имеют:

```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

## 2.3. Soft delete

Для сущностей, которые нельзя удалять физически сразу:

```sql
deleted_at timestamptz
```

## 2.4. JSONB

Используется для гибких частей:

```text
cards.data
cards.position
cards.size
cards.style
connections.contract
connections.mapping
connections.condition
files.metadata
boards.viewport
boards.settings
```

Но важные поля, по которым часто ищем или строим права, выносятся в отдельные колонки.

---

# 3. Enums

В Supabase можно использовать `text` + CHECK constraints для гибкости.  
Для серьёзного проекта лучше начать с enums там, где значения устойчивые.

```sql
create type workspace_role as enum (
  'owner',
  'admin',
  'editor',
  'viewer',
  'guest',
  'service'
);

create type card_status as enum (
  'draft',
  'active',
  'approved',
  'archived',
  'error',
  'deleted'
);

create type connection_status as enum (
  'draft',
  'active',
  'disabled',
  'error',
  'deleted'
);

create type file_processing_status as enum (
  'pending',
  'processing',
  'processed',
  'failed'
);

create type workflow_run_status as enum (
  'queued',
  'running',
  'success',
  'failed',
  'cancelled'
);

create type node_execution_status as enum (
  'queued',
  'running',
  'success',
  'skipped',
  'failed',
  'cancelled'
);

create type ai_action_mode as enum (
  'read_only',
  'suggest_changes',
  'apply_with_confirmation',
  'auto_apply'
);
```

---

# 4. Trigger для updated_at

```sql
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
```

Пример применения:

```sql
create trigger trg_workspaces_updated_at
before update on workspaces
for each row execute function set_updated_at();
```

---

# 5. Workspaces

Workspace — верхний уровень владения данными.

```sql
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_workspaces_owner_id on workspaces(owner_id);
create index idx_workspaces_slug on workspaces(slug);
create index idx_workspaces_settings_gin on workspaces using gin(settings);
```

```sql
create trigger trg_workspaces_updated_at
before update on workspaces
for each row execute function set_updated_at();
```

---

# 6. Workspace members

```sql
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'viewer',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(workspace_id, user_id)
);

create index idx_workspace_members_workspace_id on workspace_members(workspace_id);
create index idx_workspace_members_user_id on workspace_members(user_id);
create index idx_workspace_members_role on workspace_members(role);
```

```sql
create trigger trg_workspace_members_updated_at
before update on workspace_members
for each row execute function set_updated_at();
```

---

# 7. Projects

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_projects_workspace_id on projects(workspace_id);
create index idx_projects_created_by on projects(created_by);
create index idx_projects_settings_gin on projects using gin(settings);
```

```sql
create trigger trg_projects_updated_at
before update on projects
for each row execute function set_updated_at();
```

---

# 8. Boards

Board — визуальная рабочая область.

```sql
create table boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,

  name text not null,
  description text,

  viewport jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,

  -- Yjs binary state. Можно хранить здесь или в отдельной таблице board_yjs_states.
  yjs_state bytea,

  latest_snapshot_id uuid,

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_boards_project_id on boards(project_id);
create index idx_boards_workspace_id on boards(workspace_id);
create index idx_boards_created_by on boards(created_by);
create index idx_boards_settings_gin on boards using gin(settings);
```

```sql
create trigger trg_boards_updated_at
before update on boards
for each row execute function set_updated_at();
```

---

# 9. Card types

Типы карточек должны быть schema-driven.

```sql
create table card_types (
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

  execution_config jsonb not null default '{}'::jsonb,
  ai_indexing_config jsonb not null default '{}'::jsonb,

  version int not null default 1,
  is_system boolean not null default false,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(workspace_id, key, version)
);

create index idx_card_types_workspace_id on card_types(workspace_id);
create index idx_card_types_key on card_types(key);
create index idx_card_types_json_schema_gin on card_types using gin(json_schema);
```

```sql
create trigger trg_card_types_updated_at
before update on card_types
for each row execute function set_updated_at();
```

## 9.1. Пример card type

```json
{
  "key": "supplier_item",
  "name": "Позиция поставщика",
  "json_schema": {
    "type": "object",
    "required": ["supplier", "item"],
    "properties": {
      "supplier": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "inn": { "type": "string" }
        }
      },
      "item": {
        "type": "object",
        "required": ["name", "quantity"],
        "properties": {
          "name": { "type": "string" },
          "sku": { "type": "string" },
          "quantity": { "type": "number" },
          "unit": { "type": "string" }
        }
      }
    }
  }
}
```

---

# 10. Cards

Card — главная сущность системы.

```sql
create table cards (
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

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint cards_position_is_object check (jsonb_typeof(position) = 'object'),
  constraint cards_size_is_object check (jsonb_typeof(size) = 'object'),
  constraint cards_data_is_object check (jsonb_typeof(data) = 'object')
);

create index idx_cards_workspace_id on cards(workspace_id);
create index idx_cards_board_id on cards(board_id);
create index idx_cards_type_id on cards(type_id);
create index idx_cards_status on cards(status);
create index idx_cards_created_by on cards(created_by);
create index idx_cards_updated_at on cards(updated_at);
create index idx_cards_data_gin on cards using gin(data);
create index idx_cards_position_gin on cards using gin(position);
create index idx_cards_search_text on cards using gin(search_text);
create index idx_cards_title_trgm on cards using gin(title gin_trgm_ops);
```

```sql
create trigger trg_cards_updated_at
before update on cards
for each row execute function set_updated_at();
```

## 10.1. Пример cards.data

```json
{
  "kind": "supplier_item",
  "supplier": {
    "name": "ООО Метизы",
    "inn": "0000000000"
  },
  "item": {
    "name": "Болт М8x30",
    "sku": "BOLT-M8-30",
    "quantity": 120,
    "unit": "pcs"
  },
  "price": {
    "value": 5.4,
    "currency": "RUB"
  },
  "status": "approved"
}
```

---

# 11. Connection types

```sql
create table connection_types (
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

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(workspace_id, key, version)
);

create index idx_connection_types_workspace_id on connection_types(workspace_id);
create index idx_connection_types_key on connection_types(key);
```

```sql
create trigger trg_connection_types_updated_at
before update on connection_types
for each row execute function set_updated_at();
```

## 11.1. Базовые типы связей

```text
depends_on
provides_data_to
generates
approves
blocks
references
transforms
triggers
contains
derived_from
```

---

# 12. Connections

```sql
create table connections (
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

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint connections_no_self_loop check (source_card_id <> target_card_id),
  constraint connections_contract_is_object check (jsonb_typeof(contract) = 'object'),
  constraint connections_mapping_is_object check (jsonb_typeof(mapping) = 'object'),
  constraint connections_condition_is_object check (jsonb_typeof(condition) = 'object')
);

create index idx_connections_workspace_id on connections(workspace_id);
create index idx_connections_board_id on connections(board_id);
create index idx_connections_source_card_id on connections(source_card_id);
create index idx_connections_target_card_id on connections(target_card_id);
create index idx_connections_type_id on connections(type_id);
create index idx_connections_status on connections(status);
create index idx_connections_contract_gin on connections using gin(contract);
create index idx_connections_mapping_gin on connections using gin(mapping);
create index idx_connections_condition_gin on connections using gin(condition);
```

```sql
create trigger trg_connections_updated_at
before update on connections
for each row execute function set_updated_at();
```

## 12.1. Пример connections.contract

```json
{
  "relation": "generates",
  "source_output_schema": "bom.v1",
  "target_input_schema": "purchase_request.v1",
  "required_fields": [
    "items[].sku",
    "items[].quantity"
  ]
}
```

## 12.2. Пример connections.mapping

```json
{
  "items[].sku": "purchase.lines[].sku",
  "items[].quantity": "purchase.lines[].qty",
  "items[].unit": "purchase.lines[].unit"
}
```

## 12.3. Пример connections.condition

```json
{
  "when": "source.status == 'approved'",
  "mode": "manual_or_auto"
}
```

---

# 13. Files

Файлы физически лежат в object storage.  
В PostgreSQL хранятся метаданные и результаты обработки.

```sql
create table files (
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

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique(storage_bucket, storage_path)
);

create index idx_files_workspace_id on files(workspace_id);
create index idx_files_created_by on files(created_by);
create index idx_files_sha256 on files(sha256);
create index idx_files_mime_type on files(mime_type);
create index idx_files_processing_status on files(processing_status);
create index idx_files_metadata_gin on files using gin(metadata);
create index idx_files_filename_trgm on files using gin(filename gin_trgm_ops);
```

```sql
create trigger trg_files_updated_at
before update on files
for each row execute function set_updated_at();
```

---

# 14. Card files

```sql
create table card_files (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,

  role text not null default 'attachment',
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  unique(card_id, file_id, role)
);

create index idx_card_files_workspace_id on card_files(workspace_id);
create index idx_card_files_card_id on card_files(card_id);
create index idx_card_files_file_id on card_files(file_id);
create index idx_card_files_role on card_files(role);
```

Рекомендуемые роли:

```text
attachment
drawing
specification
invoice
photo
contract
bom
report
source_document
generated_document
```

---

# 15. Board snapshots

Snapshots нужны для восстановления состояния доски и версионирования.

```sql
create table board_snapshots (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,

  snapshot jsonb not null,
  yjs_state bytea,

  reason text,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_board_snapshots_workspace_id on board_snapshots(workspace_id);
create index idx_board_snapshots_board_id on board_snapshots(board_id);
create index idx_board_snapshots_created_at on board_snapshots(created_at);
```

После создания таблицы можно добавить внешний ключ в `boards.latest_snapshot_id`.

```sql
alter table boards
add constraint fk_boards_latest_snapshot
foreign key (latest_snapshot_id)
references board_snapshots(id)
on delete set null;
```

---

# 16. Card versions

```sql
create table card_versions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,

  version int not null,

  title text,
  description text,
  status card_status,
  data jsonb not null,
  position jsonb,
  size jsonb,
  style jsonb,

  changed_by uuid references auth.users(id) on delete set null,
  change_reason text,

  created_at timestamptz not null default now(),

  unique(card_id, version)
);

create index idx_card_versions_workspace_id on card_versions(workspace_id);
create index idx_card_versions_card_id on card_versions(card_id);
create index idx_card_versions_created_at on card_versions(created_at);
```

---

# 17. Connection versions

```sql
create table connection_versions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,

  version int not null,

  label text,
  status connection_status,
  contract jsonb not null,
  mapping jsonb not null,
  condition jsonb not null,
  style jsonb,

  changed_by uuid references auth.users(id) on delete set null,
  change_reason text,

  created_at timestamptz not null default now(),

  unique(connection_id, version)
);

create index idx_connection_versions_workspace_id on connection_versions(workspace_id);
create index idx_connection_versions_connection_id on connection_versions(connection_id);
create index idx_connection_versions_created_at on connection_versions(created_at);
```

---

# 18. Comments

```sql
create table comments (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,

  object_type text not null,
  object_id uuid not null,

  body text not null,

  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_comments_workspace_id on comments(workspace_id);
create index idx_comments_object on comments(object_type, object_id);
create index idx_comments_created_by on comments(created_by);
create index idx_comments_created_at on comments(created_at);
```

```sql
create trigger trg_comments_updated_at
before update on comments
for each row execute function set_updated_at();
```

---

# 19. Activity log

Audit log для всех важных действий.

```sql
create table activity_log (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid references workspaces(id) on delete cascade,

  actor_id uuid references auth.users(id) on delete set null,

  action text not null,
  object_type text not null,
  object_id uuid,

  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_activity_log_workspace_id on activity_log(workspace_id);
create index idx_activity_log_actor_id on activity_log(actor_id);
create index idx_activity_log_object on activity_log(object_type, object_id);
create index idx_activity_log_action on activity_log(action);
create index idx_activity_log_created_at on activity_log(created_at);
```

Примеры `action`:

```text
workspace.created
board.created
card.created
card.updated
card.deleted
connection.created
connection.updated
file.uploaded
file.processed
ai.suggestion.created
workflow.run.started
workflow.run.finished
```

---

# 20. Embeddings

## 20.1. Общая таблица embeddings

Размерность `vector(1536)` указана как пример.  
Её нужно согласовать с выбранной embedding-моделью.

```sql
create table embeddings (
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

create index idx_embeddings_workspace_id on embeddings(workspace_id);
create index idx_embeddings_object on embeddings(object_type, object_id);
create index idx_embeddings_model on embeddings(model);
create index idx_embeddings_metadata_gin on embeddings using gin(metadata);
```

## 20.2. Vector index

Для больших объёмов:

```sql
create index idx_embeddings_vector_hnsw
on embeddings
using hnsw (embedding vector_cosine_ops);
```

Для маленьких объёмов на старте можно использовать IVFFlat:

```sql
create index idx_embeddings_vector_ivfflat
on embeddings
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

---

# 21. File chunks

Для RAG по файлам лучше хранить chunks отдельно.

```sql
create table file_chunks (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,

  chunk_index int not null,
  content text not null,
  content_hash text not null,

  page_number int,
  token_count int,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  unique(file_id, chunk_index, content_hash)
);

create index idx_file_chunks_workspace_id on file_chunks(workspace_id);
create index idx_file_chunks_file_id on file_chunks(file_id);
create index idx_file_chunks_content_hash on file_chunks(content_hash);
create index idx_file_chunks_metadata_gin on file_chunks using gin(metadata);
```

`embeddings.object_type = 'file_chunk'`, `embeddings.object_id = file_chunks.id`.

---

# 22. Board summaries

Для ускорения AI-ответов по большим доскам можно хранить summaries.

```sql
create table board_summaries (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,

  summary_type text not null,
  content text not null,

  source_snapshot_id uuid references board_snapshots(id) on delete set null,

  model text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_board_summaries_workspace_id on board_summaries(workspace_id);
create index idx_board_summaries_board_id on board_summaries(board_id);
create index idx_board_summaries_summary_type on board_summaries(summary_type);
```

Примеры `summary_type`:

```text
short
detailed
workflow
risk_analysis
changes_since_last_week
```

---

# 23. AI actions

Все AI-действия должны логироваться.

```sql
create table ai_actions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,

  mode ai_action_mode not null default 'read_only',

  prompt text not null,
  response jsonb,
  suggested_changes jsonb,
  applied_changes jsonb,

  model text,
  usage jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_ai_actions_workspace_id on ai_actions(workspace_id);
create index idx_ai_actions_board_id on ai_actions(board_id);
create index idx_ai_actions_card_id on ai_actions(card_id);
create index idx_ai_actions_created_by on ai_actions(created_by);
create index idx_ai_actions_created_at on ai_actions(created_at);
```

---

# 24. Workflow runs

```sql
create table workflow_runs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,

  status workflow_run_status not null default 'queued',

  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,

  started_by uuid references auth.users(id) on delete set null,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);

create index idx_workflow_runs_workspace_id on workflow_runs(workspace_id);
create index idx_workflow_runs_board_id on workflow_runs(board_id);
create index idx_workflow_runs_status on workflow_runs(status);
create index idx_workflow_runs_started_by on workflow_runs(started_by);
create index idx_workflow_runs_created_at on workflow_runs(created_at);
```

---

# 25. Node executions

```sql
create table node_executions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,

  run_id uuid not null references workflow_runs(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,

  status node_execution_status not null default 'queued',

  input jsonb not null default '{}'::jsonb,
  output jsonb,
  logs jsonb not null default '[]'::jsonb,
  error jsonb,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);

create index idx_node_executions_workspace_id on node_executions(workspace_id);
create index idx_node_executions_run_id on node_executions(run_id);
create index idx_node_executions_card_id on node_executions(card_id);
create index idx_node_executions_status on node_executions(status);
create index idx_node_executions_created_at on node_executions(created_at);
```

---

# 26. Webhooks

Если система будет принимать внешние события.

```sql
create table webhooks (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,

  name text not null,
  secret_hash text not null,

  is_enabled boolean not null default true,

  config jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_webhooks_workspace_id on webhooks(workspace_id);
create index idx_webhooks_board_id on webhooks(board_id);
create index idx_webhooks_card_id on webhooks(card_id);
create index idx_webhooks_is_enabled on webhooks(is_enabled);
```

```sql
create trigger trg_webhooks_updated_at
before update on webhooks
for each row execute function set_updated_at();
```

---

# 27. Notifications

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  body text,

  type text not null,
  data jsonb not null default '{}'::jsonb,

  read_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_workspace_id on notifications(workspace_id);
create index idx_notifications_read_at on notifications(read_at);
create index idx_notifications_created_at on notifications(created_at);
```

---

# 28. Utility views

## 28.1. Active cards

```sql
create view active_cards as
select *
from cards
where deleted_at is null;
```

## 28.2. Active connections

```sql
create view active_connections as
select *
from connections
where deleted_at is null;
```

## 28.3. Board graph view

```sql
create view board_graph as
select
  b.id as board_id,
  b.workspace_id,
  b.name as board_name,
  c.id as card_id,
  c.title as card_title,
  c.status as card_status,
  c.type_id as card_type_id,
  c.position,
  c.size,
  c.data
from boards b
join cards c on c.board_id = b.id
where b.deleted_at is null
  and c.deleted_at is null;
```

---

# 29. Graph helper queries

## 29.1. Входящие связи карточки

```sql
select *
from connections
where target_card_id = :card_id
  and deleted_at is null;
```

## 29.2. Исходящие связи карточки

```sql
select *
from connections
where source_card_id = :card_id
  and deleted_at is null;
```

## 29.3. Соседние карточки

```sql
select distinct c.*
from cards c
where c.id in (
  select source_card_id
  from connections
  where target_card_id = :card_id
    and deleted_at is null

  union

  select target_card_id
  from connections
  where source_card_id = :card_id
    and deleted_at is null
)
and c.deleted_at is null;
```

---

# 30. Semantic search query

Пример поиска по embeddings:

```sql
select
  e.object_type,
  e.object_id,
  e.content,
  e.metadata,
  1 - (e.embedding <=> :query_embedding) as similarity
from embeddings e
where e.workspace_id = :workspace_id
order by e.embedding <=> :query_embedding
limit 20;
```

---

# 31. Hybrid search query

Пример упрощённого hybrid search по карточкам:

```sql
with text_results as (
  select
    c.id,
    ts_rank(c.search_text, plainto_tsquery('simple', :query)) as text_score
  from cards c
  where c.workspace_id = :workspace_id
    and c.deleted_at is null
    and c.search_text @@ plainto_tsquery('simple', :query)
),
vector_results as (
  select
    e.object_id as id,
    1 - (e.embedding <=> :query_embedding) as vector_score
  from embeddings e
  where e.workspace_id = :workspace_id
    and e.object_type = 'card'
  order by e.embedding <=> :query_embedding
  limit 50
)
select
  c.*,
  coalesce(t.text_score, 0) as text_score,
  coalesce(v.vector_score, 0) as vector_score,
  (
    coalesce(t.text_score, 0) * 0.35 +
    coalesce(v.vector_score, 0) * 0.65
  ) as total_score
from cards c
left join text_results t on t.id = c.id
left join vector_results v on v.id = c.id
where c.workspace_id = :workspace_id
  and c.deleted_at is null
  and (t.id is not null or v.id is not null)
order by total_score desc
limit 20;
```

---

# 32. RLS helper functions

## 32.1. Проверка членства в workspace

```sql
create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean as $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$ language sql stable security definer;
```

## 32.2. Проверка роли

```sql
create or replace function has_workspace_role(
  target_workspace_id uuid,
  allowed_roles workspace_role[]
)
returns boolean as $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$ language sql stable security definer;
```

---

# 33. RLS policies

## 33.1. Workspaces

```sql
alter table workspaces enable row level security;

create policy "workspace members can read workspace"
on workspaces for select
using (
  owner_id = auth.uid()
  or is_workspace_member(id)
);

create policy "workspace owners can update workspace"
on workspaces for update
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);
```

---

## 33.2. Workspace members

```sql
alter table workspace_members enable row level security;

create policy "members can read workspace members"
on workspace_members for select
using (
  is_workspace_member(workspace_id)
);

create policy "owners and admins can manage workspace members"
on workspace_members for all
using (
  has_workspace_role(workspace_id, array['owner', 'admin']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin']::workspace_role[])
);
```

---

## 33.3. Projects

```sql
alter table projects enable row level security;

create policy "workspace members can read projects"
on projects for select
using (
  is_workspace_member(workspace_id)
);

create policy "editors can insert projects"
on projects for insert
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can update projects"
on projects for update
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);
```

---

## 33.4. Boards

```sql
alter table boards enable row level security;

create policy "workspace members can read boards"
on boards for select
using (
  is_workspace_member(workspace_id)
);

create policy "editors can create boards"
on boards for insert
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can update boards"
on boards for update
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);
```

---

## 33.5. Cards

```sql
alter table cards enable row level security;

create policy "workspace members can read cards"
on cards for select
using (
  is_workspace_member(workspace_id)
);

create policy "editors can create cards"
on cards for insert
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can update cards"
on cards for update
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can delete cards"
on cards for delete
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);
```

---

## 33.6. Connections

```sql
alter table connections enable row level security;

create policy "workspace members can read connections"
on connections for select
using (
  is_workspace_member(workspace_id)
);

create policy "editors can create connections"
on connections for insert
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can update connections"
on connections for update
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can delete connections"
on connections for delete
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);
```

---

## 33.7. Files

```sql
alter table files enable row level security;

create policy "workspace members can read files"
on files for select
using (
  is_workspace_member(workspace_id)
);

create policy "editors can create files"
on files for insert
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);

create policy "editors can update files"
on files for update
using (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
)
with check (
  has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::workspace_role[])
);
```

---

## 33.8. Embeddings

```sql
alter table embeddings enable row level security;

create policy "workspace members can read embeddings"
on embeddings for select
using (
  is_workspace_member(workspace_id)
);

create policy "service role can manage embeddings"
on embeddings for all
using (
  auth.role() = 'service_role'
)
with check (
  auth.role() = 'service_role'
);
```

Обычно embeddings должны создаваться worker-сервисом через service role, а не напрямую клиентом.

---

# 34. Storage path convention

Рекомендуемая структура файлов:

```text
workspace-files/
  {workspace_id}/
    boards/
      {board_id}/
        cards/
          {card_id}/
            {file_id}-{filename}
    uploads/
      {file_id}-{filename}
```

Пример:

```text
workspace-files/8f7.../boards/b12.../cards/c99.../f44...-specification.pdf
```

---

# 35. Canonical text для embeddings

## 35.1. Card canonical text

```text
Card: {title}
Description: {description}
Type: {card_type.name}
Status: {status}
JSON data:
{flattened_data}
Incoming connections:
{incoming_connections}
Outgoing connections:
{outgoing_connections}
Attached files:
{files}
Comments:
{comments}
```

## 35.2. Connection canonical text

```text
Connection: {label}
Type: {connection_type.name}
From: {source_card.title}
To: {target_card.title}
Contract:
{contract}
Mapping:
{mapping}
Condition:
{condition}
```

## 35.3. File chunk canonical text

```text
File: {filename}
MIME type: {mime_type}
Role: {card_file.role}
Page: {page_number}
Content:
{chunk_content}
Related card:
{card_title}
```

---

# 36. Рекомендуемый порядок миграций

```text
001_extensions.sql
002_enums.sql
003_common_triggers.sql
004_workspaces.sql
005_projects.sql
006_boards.sql
007_card_types.sql
008_cards.sql
009_connection_types.sql
010_connections.sql
011_files.sql
012_card_files.sql
013_snapshots.sql
014_versions.sql
015_comments.sql
016_activity_log.sql
017_embeddings.sql
018_file_chunks.sql
019_ai_actions.sql
020_workflow.sql
021_webhooks.sql
022_notifications.sql
023_rls_helpers.sql
024_rls_policies.sql
025_views.sql
```

---

# 37. Что намеренно не решается только базой

База не должна брать на себя:

```text
live-drag карточек 60 раз в секунду
merge conflicts в совместном редактировании
сложный execution engine
валидацию всех JSON Schema
OCR
chunking файлов
создание embeddings
agent reasoning
```

Для этого нужны сервисы:

```text
apps/realtime
apps/worker
apps/api
packages/ai
packages/workflow
```

---

# 38. Итоговая модель

Главное разделение:

```text
cards                 — JSON-сущности
connections           — смысловые связи
files                 — документы и вложения
card_files            — привязка файлов к карточкам
embeddings            — AI-поиск
file_chunks           — RAG по документам
board_snapshots       — восстановление доски
card_versions         — история карточек
connection_versions   — история связей
workflow_runs         — запуски процессов
node_executions       — выполнение отдельных карточек
activity_log          — audit trail
```

Эта схема достаточно гибкая для старта и достаточно серьёзная, чтобы потом вырасти в полноценную платформу:

```text
visual database
workflow builder
AI knowledge graph
document management system
production/engineering process map
low-code automation system
```
