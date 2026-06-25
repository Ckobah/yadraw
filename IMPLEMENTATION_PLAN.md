# IMPLEMENTATION_PLAN.md

# Пошаговый план реализации серьёзной системы визуальных JSON-карточек, связей, файлов и AI-поиска

## 0. Цель проекта

Создать систему визуального проектирования данных и процессов, похожую по UX на n8n, Excalidraw, Miro и low-code workflow builder, но с более сильной моделью данных.

Каждая карточка — не просто визуальный блок, а JSON-сущность, совместимая с PostgreSQL/Supabase.

Каждая связь — не просто стрелка, а описанный контракт взаимодействия между карточками.

Файлы можно привязывать к карточкам.

Доска поддерживает совместное редактирование, версионирование, поиск, AI-анализ, embeddings, RAG и потенциальное исполнение workflow.

---

# 1. Основные архитектурные принципы

## 1.1. Карточка — это данные, а не прямоугольник

Карточка должна иметь:

- уникальный id;
- тип;
- JSON-данные;
- JSON Schema;
- UI Schema;
- позицию на canvas;
- размеры;
- стиль;
- связи;
- файлы;
- версию;
- права доступа;
- историю изменений.

## 1.2. Связь — это контракт

Связь между карточками должна описывать:

- источник;
- получатель;
- тип взаимодействия;
- направление;
- data mapping;
- условие активации;
- входной и выходной контракт;
- статус;
- визуальный стиль;
- историю изменений.

## 1.3. Canvas — это представление графа

Canvas не должен быть единственным источником истины.

Источник истины:

- PostgreSQL — постоянные данные;
- JSONB — гибкие данные карточек;
- Yjs/CRDT — live-состояние совместного редактирования;
- snapshots — восстановление состояния доски;
- object storage — файлы;
- vector index — AI-поиск.

## 1.4. AI — не надстройка, а часть архитектуры

AI-функции должны проектироваться сразу:

- embeddings карточек;
- embeddings файлов;
- semantic search;
- graph-aware search;
- RAG;
- AI-помощник по доске;
- генерация карточек;
- объяснение связей;
- поиск противоречий;
- авто-классификация файлов;
- извлечение структурированных данных из документов.

---

# 2. Целевой стек

## 2.1. Frontend

```text
Next.js
React
TypeScript
React Flow / XYFlow
Tailwind CSS
shadcn/ui
Zustand
TanStack Query
Zod
```

Назначение:

- Next.js — приложение и API-роуты;
- React Flow — node-based canvas;
- Tailwind/shadcn — интерфейс;
- Zustand — локальное состояние canvas;
- TanStack Query — синхронизация с backend;
- Zod — валидация данных карточек, связей и API.

---

## 2.2. Backend

```text
Node.js
NestJS или Fastify
PostgreSQL
Supabase-compatible schema
Prisma или Drizzle
Redis
BullMQ
Hocuspocus
Yjs
```

Рекомендация:

Для серьёзного проекта лучше не ограничиваться только Next.js API routes. Лучше выделить backend-сервис:

```text
apps/web          — frontend
apps/api          — backend API
apps/realtime     — Hocuspocus/Yjs server
apps/worker       — jobs, embeddings, file processing, workflow execution
packages/db       — schema, migrations, types
packages/shared   — common types, zod schemas
packages/ui       — shared UI
packages/ai       — AI helpers, chunking, embeddings, RAG
```

---

## 2.3. База и хранилище

```text
PostgreSQL
JSONB
pgvector
Supabase Auth
Supabase Storage или S3-compatible storage
Supabase Realtime или отдельный websocket-сервис
```

Важная позиция:

Схема должна быть совместима с Supabase, но архитектура не должна полностью зависеть от Supabase. Нужно оставить возможность перейти на обычный PostgreSQL + S3 + Keycloak/Auth.js + отдельный realtime layer.

---

## 2.4. AI-слой

```text
pgvector
OpenAI / локальные embedding-модели
RAG pipeline
document chunking
hybrid search
graph-aware retrieval
```

В дальнейшем можно добавить:

```text
reranker
knowledge graph
agent runtime
workflow assistant
OCR pipeline
document understanding pipeline
```

---

# 3. Структура репозитория

```text
visual-json-system/
  apps/
    web/
    api/
    realtime/
    worker/
  packages/
    db/
    shared/
    ui/
    canvas/
    ai/
    workflow/
    file-processing/
  infra/
    docker/
    terraform/
    nginx/
    monitoring/
  docs/
    architecture/
    database/
    api/
    ai/
    workflow/
```

---

# 4. Этап 1 — проектирование доменной модели

## 4.1. Основные сущности

```text
users
workspaces
workspace_members
projects
boards
cards
card_types
connections
connection_types
files
card_files
board_snapshots
card_versions
connection_versions
comments
activity_log
embeddings
workflow_runs
node_executions
```

---

## 4.2. Workspace

Workspace — верхний уровень владения данными.

```sql
workspaces
- id uuid primary key
- name text not null
- slug text unique
- owner_id uuid
- settings jsonb
- created_at timestamptz
- updated_at timestamptz
```

---

## 4.3. Project

Project группирует доски.

```sql
projects
- id uuid primary key
- workspace_id uuid references workspaces(id)
- name text not null
- description text
- settings jsonb
- created_at timestamptz
- updated_at timestamptz
```

---

## 4.4. Board

Board — визуальная рабочая область.

```sql
boards
- id uuid primary key
- project_id uuid references projects(id)
- name text not null
- description text
- viewport jsonb
- settings jsonb
- yjs_state bytea
- latest_snapshot_id uuid
- created_by uuid
- created_at timestamptz
- updated_at timestamptz
```

---

## 4.5. Card

Card — главная сущность системы.

```sql
cards
- id uuid primary key
- board_id uuid references boards(id)
- type_id uuid references card_types(id)
- title text
- description text
- data jsonb not null
- position jsonb not null
- size jsonb
- style jsonb
- status text
- schema_version int
- created_by uuid
- updated_by uuid
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz
```

Пример `data`:

```json
{
  "kind": "supplier_item",
  "supplier": {
    "name": "ООО Метизы",
    "inn": "..."
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

## 4.6. Card Types

Тип карточки должен быть schema-driven.

```sql
card_types
- id uuid primary key
- workspace_id uuid
- key text
- name text
- description text
- json_schema jsonb
- ui_schema jsonb
- default_data jsonb
- icon text
- color text
- version int
- is_system boolean
- created_at timestamptz
- updated_at timestamptz
```

Примеры типов:

```text
note
task
document
supplier
part
assembly
bom
operation
approval
api_call
condition
transform
file_parser
ai_prompt
database_record
```

---

## 4.7. Connections

Связь — это отдельная сущность с бизнес-смыслом.

```sql
connections
- id uuid primary key
- board_id uuid references boards(id)
- source_card_id uuid references cards(id)
- target_card_id uuid references cards(id)
- source_handle text
- target_handle text
- type_id uuid references connection_types(id)
- label text
- contract jsonb
- mapping jsonb
- condition jsonb
- style jsonb
- status text
- created_by uuid
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz
```

Пример `contract`:

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

Пример `mapping`:

```json
{
  "items[].sku": "purchase.lines[].sku",
  "items[].quantity": "purchase.lines[].qty",
  "items[].unit": "purchase.lines[].unit"
}
```

Пример `condition`:

```json
{
  "when": "source.status == 'approved'",
  "mode": "manual_or_auto"
}
```

---

# 5. Этап 2 — права доступа и безопасность

## 5.1. Роли

```text
owner
admin
editor
viewer
guest
service
```

---

## 5.2. Workspace Members

```sql
workspace_members
- id uuid primary key
- workspace_id uuid
- user_id uuid
- role text
- permissions jsonb
- created_at timestamptz
```

---

## 5.3. Политики доступа

Нужно реализовать:

- доступ к workspace;
- доступ к project;
- доступ к board;
- доступ к card;
- доступ к files;
- доступ к workflow execution;
- доступ к embeddings;
- audit trail.

---

## 5.4. Row Level Security

Если используется Supabase, обязательно включить RLS для ключевых таблиц:

```text
workspaces
workspace_members
projects
boards
cards
connections
files
card_files
comments
```

---

# 6. Этап 3 — canvas engine

## 6.1. Базовый редактор

Реализовать:

- создание карточки;
- перемещение карточки;
- изменение размера;
- выделение;
- мультивыделение;
- удаление;
- копирование;
- вставку;
- undo/redo;
- zoom;
- pan;
- minimap;
- группировку;
- слои;
- snap-to-grid;
- drag-and-drop файлов на доску;
- drag-and-drop файлов в карточку.

---

## 6.2. React Flow custom nodes

Сделать собственные node-компоненты:

```text
BaseCardNode
DocumentCardNode
FileCardNode
TaskCardNode
SupplierCardNode
WorkflowNode
AiPromptNode
DatabaseRecordNode
GroupNode
```

---

## 6.3. Custom edges

Сделать собственные edge-компоненты:

```text
DataFlowEdge
DependencyEdge
ApprovalEdge
TransformEdge
BlockingEdge
ReferenceEdge
GeneratedByEdge
```

Каждая связь должна иметь:

- label;
- direction;
- type;
- статус;
- hover details;
- editable contract;
- inspector panel.

---

## 6.4. Inspector Panel

Справа должен быть inspector:

```text
Card inspector
Connection inspector
Board inspector
File inspector
AI inspector
Workflow run inspector
```

---

# 7. Этап 4 — JSON Schema и типизация карточек

## 7.1. Schema Registry

Нужно сделать registry типов карточек.

Каждый тип содержит:

- JSON Schema;
- UI Schema;
- default data;
- icon;
- color;
- allowed handles;
- allowed connection types;
- validation rules;
- execution behavior;
- AI indexing rules.

---

## 7.2. Validation Engine

Каждое изменение карточки должно проходить валидацию:

```text
client-side validation — быстрое предупреждение
server-side validation — финальная проверка
database constraints — базовая целостность
```

---

## 7.3. Версионирование схем

Нельзя перезаписывать схему без версии.

Нужно хранить:

```text
card_type.version
card.schema_version
migration scripts
compatibility rules
```

---

# 8. Этап 5 — файлы и документы

## 8.1. File Storage

Файлы хранятся в object storage.

В базе хранятся только:

- путь;
- имя;
- MIME type;
- размер;
- hash;
- владелец;
- workspace;
- extracted text;
- metadata;
- processing status.

---

## 8.2. Таблица files

```sql
files
- id uuid primary key
- workspace_id uuid
- storage_path text
- filename text
- mime_type text
- size_bytes bigint
- sha256 text
- metadata jsonb
- extracted_text text
- processing_status text
- created_by uuid
- created_at timestamptz
```

---

## 8.3. Связь files с cards

```sql
card_files
- id uuid primary key
- card_id uuid references cards(id)
- file_id uuid references files(id)
- role text
- metadata jsonb
- created_at timestamptz
```

Роли файлов:

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

## 8.4. File Processing Pipeline

После загрузки файла worker должен:

```text
1. Проверить MIME type.
2. Посчитать hash.
3. Сохранить файл.
4. Извлечь текст.
5. Сделать OCR при необходимости.
6. Разбить текст на chunks.
7. Создать embeddings.
8. Связать chunks с файлом и карточкой.
9. Обновить processing_status.
```

---

# 9. Этап 6 — AI и векторный слой

## 9.1. Цель AI-слоя

AI-слой должен отвечать на вопросы:

```text
Что находится на этой доске?
Какие карточки связаны с закупками?
Какие файлы относятся к этой сборке?
Какие чертежи нужны сварщику?
Какие карточки противоречат друг другу?
Что изменилось за неделю?
Какие зависимости у этой детали?
Какие документы нужно подготовить?
```

---

## 9.2. Embedding Objects

Индексировать нужно не только текст файлов, но и структурированные данные.

Объекты для embeddings:

```text
card
card_field
connection
file_chunk
board_summary
workflow_run
comment
```

---

## 9.3. Таблица embeddings

```sql
embeddings
- id uuid primary key
- workspace_id uuid
- object_type text
- object_id uuid
- chunk_index int
- content text
- content_hash text
- metadata jsonb
- embedding vector
- model text
- created_at timestamptz
```

---

## 9.4. Что индексировать у карточки

Для карточки нужно формировать canonical text:

```text
Title:
Description:
Type:
Status:
JSON fields:
Connected to:
Files:
Comments:
Last changes:
```

Пример canonical text:

```text
Card: Болт М8x30
Type: supplier_item
Supplier: ООО Метизы
Quantity: 120 pcs
Price: 5.4 RUB
Connected to: Сборка рамы, Заявка на закупку
Attached files: specification.pdf
Status: approved
```

---

## 9.5. Hybrid Search

Нужен не только vector search.

Должно быть 3 типа поиска:

```text
1. Full-text search
2. Vector semantic search
3. Graph-aware search
```

Итоговая выдача должна учитывать:

```text
semantic_score
text_score
graph_distance_score
recency_score
permission_score
object_type_boost
```

---

## 9.6. Graph-aware retrieval

При поиске по карточке нужно доставать:

```text
саму карточку
соседние карточки
входящие связи
исходящие связи
файлы карточки
комментарии
последние изменения
```

Это важно, потому что смысл часто находится не в одной карточке, а в её связях.

---

## 9.7. AI Assistant

Сделать AI-помощника с режимами:

```text
Ask Board
Ask Card
Ask File
Explain Connection
Find Missing Data
Generate Cards
Generate Connections
Detect Conflicts
Summarize Board
Suggest Workflow
```

---

## 9.8. AI Safety и контроль

AI не должен молча менять данные.

Режимы:

```text
read-only
suggest changes
apply with confirmation
auto-apply for trusted automations
```

Все AI-действия должны попадать в audit log.

---

# 10. Этап 7 — realtime и совместное редактирование

## 10.1. Что синхронизировать через Yjs

Через Yjs:

```text
позиции карточек
размеры
выделения
текущий viewport
черновики изменений
presence
курсоры
live-edit текста
```

---

## 10.2. Что сохранять в PostgreSQL

В PostgreSQL:

```text
созданные карточки
удалённые карточки
финальные координаты
связи
файлы
версии
snapshots
права
статусы
workflow runs
```

---

## 10.3. Presence

Показывать:

```text
кто сейчас на доске
кто какую карточку редактирует
курсоры пользователей
lock/soft-lock на карточке
последние действия
```

---

## 10.4. Snapshots

Нужно сохранять snapshots:

```text
по таймеру
после существенных изменений
перед массовыми операциями
перед AI-изменениями
перед workflow execution
```

---

# 11. Этап 8 — workflow engine

## 11.1. Зачем workflow engine

Если система должна быть похожа на n8n, карточки должны не только храниться, но и исполняться.

---

## 11.2. Типы исполняемых карточек

```text
manual_input
api_call
database_query
condition
transform
file_parser
ai_prompt
approval
notification
document_generator
webhook
```

---

## 11.3. Таблицы исполнения

```sql
workflow_runs
- id uuid primary key
- board_id uuid
- status text
- input jsonb
- output jsonb
- error jsonb
- started_by uuid
- started_at timestamptz
- finished_at timestamptz
```

```sql
node_executions
- id uuid primary key
- run_id uuid references workflow_runs(id)
- card_id uuid references cards(id)
- status text
- input jsonb
- output jsonb
- logs jsonb
- error jsonb
- started_at timestamptz
- finished_at timestamptz
```

---

## 11.4. Execution Planner

Перед запуском workflow нужно:

```text
1. Прочитать граф.
2. Проверить циклы.
3. Построить DAG.
4. Проверить контракты связей.
5. Проверить обязательные поля.
6. Проверить доступы.
7. Создать workflow_run.
8. Запустить node executions.
```

---

## 11.5. Очереди

На старте:

```text
BullMQ + Redis
```

Позже, для сложных процессов:

```text
Temporal
```

---

# 12. Этап 9 — версия, история, audit log

## 12.1. Card Versions

```sql
card_versions
- id uuid primary key
- card_id uuid
- version int
- data jsonb
- position jsonb
- size jsonb
- style jsonb
- changed_by uuid
- change_reason text
- created_at timestamptz
```

---

## 12.2. Connection Versions

```sql
connection_versions
- id uuid primary key
- connection_id uuid
- version int
- contract jsonb
- mapping jsonb
- condition jsonb
- changed_by uuid
- created_at timestamptz
```

---

## 12.3. Activity Log

```sql
activity_log
- id uuid primary key
- workspace_id uuid
- actor_id uuid
- action text
- object_type text
- object_id uuid
- before jsonb
- after jsonb
- metadata jsonb
- created_at timestamptz
```

---

# 13. Этап 10 — API

## 13.1. Основные REST/RPC endpoints

```text
POST   /boards
GET    /boards/:id
PATCH  /boards/:id
DELETE /boards/:id

POST   /boards/:id/cards
PATCH  /cards/:id
DELETE /cards/:id

POST   /boards/:id/connections
PATCH  /connections/:id
DELETE /connections/:id

POST   /files/upload
GET    /files/:id
DELETE /files/:id

POST   /search
POST   /ai/ask-board
POST   /ai/ask-card
POST   /ai/suggest-connections
POST   /workflow/run
GET    /workflow/runs/:id
```

---

## 13.2. Websocket channels

```text
board:{boardId}
presence:{boardId}
workflow:{runId}
notifications:{userId}
```

---

# 14. Этап 11 — интерфейс

## 14.1. Основные экраны

```text
Login
Workspace list
Project list
Board list
Board editor
Card type manager
File manager
AI assistant
Workflow runs
Settings
Audit log
```

---

## 14.2. Board Editor Layout

```text
Top bar:
- board name
- save status
- collaborators
- run workflow
- AI assistant
- search

Left sidebar:
- card types
- templates
- files
- layers

Center:
- canvas

Right inspector:
- selected card
- selected connection
- selected file
- validation
- AI suggestions

Bottom panel:
- logs
- search results
- workflow runs
```

---

# 15. Этап 12 — AI-функции по уровням сложности

## 15.1. Уровень 1

```text
поиск по карточкам
поиск по файлам
поиск по доске
summary карточки
summary файла
```

---

## 15.2. Уровень 2

```text
ответы по доске
ответы по карточке
ответы по связанным файлам
поиск похожих карточек
автоматические теги
автоматическое описание карточки
```

---

## 15.3. Уровень 3

```text
генерация карточек из файла
генерация связей
поиск недостающих данных
обнаружение конфликтов
обнаружение дубликатов
объяснение графа
```

---

## 15.4. Уровень 4

```text
AI-agent для workflow
автозаполнение JSON
авто-построение процесса
автоматическая проверка контракта связей
автоматическое создание заявки, BOM, ТЗ, маршрута
```

---

# 16. Этап 13 — импорт и экспорт

## 16.1. Импорт

Поддержать:

```text
JSON
CSV
XLSX
PDF
DOCX
DXF/DWG later
Markdown
images
API/webhook
```

---

## 16.2. Экспорт

Поддержать:

```text
JSON
Markdown
PDF
CSV
XLSX
PNG/SVG snapshot
workflow package
board backup
```

---

# 17. Этап 14 — производительность

## 17.1. Большие доски

Нужно учитывать:

```text
100 карточек — обычный режим
1 000 карточек — оптимизация rendering
10 000 карточек — virtualization/clustering
100 000 объектов — graph database/cache/search layer
```

---

## 17.2. Индексы PostgreSQL

Нужны индексы:

```sql
create index on cards(board_id);
create index on cards(type_id);
create index on cards(status);
create index on cards using gin(data);
create index on connections(board_id);
create index on connections(source_card_id);
create index on connections(target_card_id);
create index on files(workspace_id);
create index on embeddings(object_type, object_id);
```

Для embeddings:

```sql
create index on embeddings using hnsw (embedding vector_cosine_ops);
```

---

# 18. Этап 15 — DevOps

## 18.1. Среды

```text
local
dev
staging
production
```

---

## 18.2. Инфраструктура

```text
Docker Compose для local
PostgreSQL
Redis
Object Storage
API service
Worker service
Realtime service
Web app
```

---

## 18.3. CI/CD

Pipeline:

```text
lint
typecheck
test
build
migration check
docker build
deploy staging
e2e tests
deploy production
```

---

## 18.4. Observability

Нужно добавить:

```text
structured logs
error tracking
metrics
tracing
slow query logs
queue monitoring
AI usage monitoring
embedding cost monitoring
workflow run logs
```

---

# 19. Этап 16 — тестирование

## 19.1. Unit tests

```text
schema validation
connection validation
mapping engine
workflow planner
permission checks
embedding text builder
```

---

## 19.2. Integration tests

```text
create board
create card
connect cards
upload file
index file
search card
ask AI
run workflow
restore snapshot
```

---

## 19.3. E2E tests

```text
создать workspace
создать доску
добавить карточки
связать карточки
прикрепить файл
найти файл через AI
запустить workflow
пригласить второго пользователя
отредактировать доску совместно
```

---

# 20. Последовательность реализации

## Фаза 1 — фундамент

Цель: получить стабильную основу данных и приложения.

Задачи:

```text
1. Настроить monorepo.
2. Поднять PostgreSQL.
3. Подключить Supabase-compatible schema.
4. Настроить Auth.
5. Создать workspace/project/board модель.
6. Создать cards/connections/files таблицы.
7. Настроить миграции.
8. Настроить базовый API.
9. Настроить frontend shell.
10. Подключить React Flow.
```

Результат:

```text
Пользователь может создать workspace, проект, доску, карточку и связь.
```

---

## Фаза 2 — полноценный canvas

Цель: сделать рабочий визуальный редактор.

Задачи:

```text
1. Custom nodes.
2. Custom edges.
3. Inspector panel.
4. Drag-and-drop.
5. Resize cards.
6. Context menu.
7. Multi-select.
8. Undo/redo.
9. Save/load board.
10. Board snapshots.
```

Результат:

```text
Доска работает как визуальный редактор данных.
```

---

## Фаза 3 — schema-driven карточки

Цель: карточки становятся типизированными JSON-объектами.

Задачи:

```text
1. Реализовать card_types.
2. Добавить JSON Schema.
3. Добавить UI Schema.
4. Добавить валидацию.
5. Добавить template system.
6. Добавить schema versioning.
7. Добавить migrations для карточек.
```

Результат:

```text
Можно создавать разные типы карточек без переписывания frontend.
```

---

## Фаза 4 — умные связи

Цель: связи становятся смысловыми контрактами.

Задачи:

```text
1. Реализовать connection_types.
2. Добавить contract editor.
3. Добавить mapping editor.
4. Добавить condition editor.
5. Добавить validation связей.
6. Добавить визуальные типы связей.
```

Результат:

```text
Связь описывает не только стрелку, но и взаимодействие между сущностями.
```

---

## Фаза 5 — файлы

Цель: карточки работают с прикреплёнными файлами.

Задачи:

```text
1. Реализовать file upload.
2. Реализовать card_files.
3. Сделать file inspector.
4. Добавить file preview.
5. Добавить extraction pipeline.
6. Добавить OCR pipeline.
7. Добавить file processing statuses.
```

Результат:

```text
К карточкам можно прикреплять документы, чертежи, изображения и спецификации.
```

---

## Фаза 6 — AI и embeddings

Цель: добавить semantic search и AI-слой.

Задачи:

```text
1. Подключить pgvector.
2. Создать embeddings таблицу.
3. Сделать embedding builder для карточек.
4. Сделать embedding builder для файлов.
5. Сделать chunking файлов.
6. Сделать hybrid search.
7. Сделать Ask Board.
8. Сделать Ask Card.
9. Сделать Ask File.
10. Добавить AI audit log.
```

Результат:

```text
Пользователь может искать и спрашивать систему естественным языком.
```

---

## Фаза 7 — совместное редактирование

Цель: несколько пользователей работают на одной доске одновременно.

Задачи:

```text
1. Поднять Hocuspocus server.
2. Подключить Yjs document к board.
3. Синхронизировать позиции карточек.
4. Синхронизировать selection.
5. Добавить cursors.
6. Добавить presence.
7. Добавить conflict-free editing.
8. Добавить сохранение Yjs snapshots.
```

Результат:

```text
Доска поддерживает live collaboration.
```

---

## Фаза 8 — workflow execution

Цель: граф можно не только рисовать, но и запускать.

Задачи:

```text
1. Определить executable card types.
2. Сделать workflow planner.
3. Сделать DAG builder.
4. Сделать contract checker.
5. Подключить BullMQ.
6. Реализовать node executions.
7. Реализовать workflow run logs.
8. Добавить run/debug UI.
```

Результат:

```text
Доска превращается в исполняемый workflow.
```

---

## Фаза 9 — AI-агент поверх графа

Цель: AI начинает помогать проектировать, проверять и улучшать систему.

Задачи:

```text
1. Suggest missing cards.
2. Suggest connections.
3. Detect duplicates.
4. Detect contradictions.
5. Explain graph.
6. Generate workflow from prompt.
7. Generate cards from file.
8. Generate document from graph.
```

Результат:

```text
Система становится интеллектуальным проектировщиком процессов и данных.
```

---

## Фаза 10 — enterprise-ready слой

Цель: подготовить продукт к серьёзной эксплуатации.

Задачи:

```text
1. Audit log.
2. Advanced permissions.
3. Backups.
4. Export/import.
5. Rate limits.
6. Billing hooks.
7. Monitoring.
8. Admin panel.
9. Workspace policies.
10. Data retention.
```

Результат:

```text
Продукт готов к использованию командами и компаниями.
```

---

# 21. Критические технические решения

## 21.1. Не хранить всё только в одном JSON

Нужно использовать гибрид:

```text
cards/connections/files — нормализованные таблицы
data/contract/mapping/style — JSONB
board snapshot — JSONB/Yjs
embeddings — отдельная таблица
```

---

## 21.2. Не использовать PostgreSQL как live-canvas транспорт

PostgreSQL — источник истины.

Yjs/Hocuspocus — live collaboration.

Supabase Realtime — события, presence, уведомления, статусы.

---

## 21.3. AI должен видеть граф, а не только текст

AI retrieval должен доставать:

```text
карточку
соседние карточки
связи
файлы
chunks
комментарии
изменения
workflow логи
```

---

## 21.4. Связи должны быть первоклассными объектами

Connection — это не визуальный edge.

Connection — это бизнес-сущность.

---

# 22. Минимальный состав production-ready версии

Production-ready версия должна иметь:

```text
Auth
Workspace model
Boards
Cards
Connections
Files
Storage
JSON Schema
Versioning
Snapshots
Realtime collaboration
Semantic search
AI assistant
Audit log
Workflow runs
Monitoring
Backups
Role-based access
```

---

# 23. Рекомендуемый порядок разработки для команды

## Backend developer

```text
1. Database schema
2. Auth/RLS
3. Cards API
4. Connections API
5. Files API
6. Embeddings API
7. Workflow API
```

## Frontend developer

```text
1. App shell
2. Board editor
3. Custom nodes
4. Custom edges
5. Inspector panel
6. File UI
7. AI assistant UI
8. Workflow run UI
```

## AI/backend developer

```text
1. Embedding pipeline
2. File chunking
3. Hybrid search
4. Graph-aware retrieval
5. RAG endpoints
6. AI suggestions
7. AI audit log
```

## DevOps/backend developer

```text
1. Docker setup
2. CI/CD
3. Environments
4. Monitoring
5. Backups
6. Queue infrastructure
7. Realtime infrastructure
```

---

# 24. Главный итог

Система должна строиться вокруг четырёх ядер:

```text
1. Graph Core
   Cards, connections, board, versions.

2. Data Core
   JSONB, schemas, validation, files.

3. Realtime Core
   Yjs, presence, collaboration, snapshots.

4. AI Core
   embeddings, hybrid search, graph-aware RAG, assistant.
```

Если эти четыре ядра сделать правильно, проект сможет вырасти в серьёзную платформу:

```text
визуальная база знаний
визуальный workflow builder
система проектной документации
AI-помощник по производству/КД/процессам
low-code конструктор бизнес-логики
графовая операционная система для компании
```
