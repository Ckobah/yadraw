# NEXT_IMPLEMENTATION_PLAN.md

# План следующих этапов реализации Yadraw

Дата: 2026-06-26

Этот документ фиксирует разбор исходного `IMPLEMENTATION_PLAN.md` относительно текущего состояния проекта и задает практический порядок реализации оставшихся функций.

## 1. Текущее состояние

Уже реализовано:

- npm workspaces monorepo.
- Next.js web app с визуальной доской.
- Fastify API.
- PostgreSQL + Redis + MinIO через Docker Compose.
- SQL foundation schema и demo seed.
- Shared TypeScript/Zod domain contracts.
- Загрузка demo board из API.
- Создание карточек.
- Обновление карточек через inspector.
- Поиск карточек внутри frontend-модалки.
- UX-stabilization первого визита: понятный первый экран, отключенные pending-действия, mobile fallback.
- Unit tests для shared schemas и repository.
- Базовый security hardening: CORS allowlist, security headers, `.env` вне Git.

Главная граница текущей версии: это рабочий foundation/demo editor, но еще не полноценный multi-user workflow product.

## 2. Gap-анализ исходного плана

### Фаза 1. Фундамент

Статус: частично закрыта.

Сделано:

- monorepo;
- PostgreSQL;
- schema/migrations;
- workspace/project/board/card/connection/file data model;
- базовый API;
- frontend shell;
- React Flow canvas.

Не сделано:

- authentication;
- workspace membership;
- создание workspace/project/board через UI;
- создание и редактирование connections;
- полноценная files runtime-логика.

### Фаза 2. Полноценный canvas

Статус: частично закрыта.

Сделано:

- custom nodes;
- inspector panel;
- card create/update;
- save/load board;
- drag position persistence.

Не сделано:

- custom edge editor;
- connection creation UI;
- card resize;
- context menu;
- multi-select;
- undo/redo;
- board snapshots.

### Фаза 3. Schema-driven карточки

Статус: почти не начата.

Сделано:

- `card_types` есть в DB/schema;
- `typeKey` уже присутствует в shared model.

Не сделано:

- JSON Schema registry runtime;
- UI Schema;
- schema validation в inspector;
- template system;
- schema versioning and migrations.

### Фаза 4. Умные связи

Статус: не начата как продуктовая функция.

Сделано:

- таблицы connections/connection_types;
- demo connections отображаются как graph edges.

Не сделано:

- создание связи на canvas;
- редактирование source/target handles;
- contract/mapping/condition editor;
- validation связей;
- визуальные типы связей.

### Фаза 5. Файлы

Статус: инфраструктурно подготовлена, runtime не реализован.

Сделано:

- MinIO в Docker Compose;
- DB schema для `files` и `card_files`;
- demo file metadata в карточках.

Не сделано:

- upload API;
- S3/MinIO client in API;
- file list screen;
- attach/detach files;
- preview/download;
- processing statuses;
- extraction/OCR pipeline.

### Фаза 6. AI и embeddings

Статус: только foundation.

Сделано:

- pgvector dependency in Postgres image/schema;
- tables planned in database document.

Не сделано:

- embedding builder;
- file chunking;
- hybrid search;
- Ask Board / Ask Card / Ask File;
- AI audit log;
- AI assistant UI connected to backend.

### Фаза 7. Realtime collaboration

Статус: не начата.

Не сделано:

- Hocuspocus/Yjs service;
- presence/cursors;
- collaborative selection;
- CRDT persistence;
- realtime board channels.

### Фаза 8. Workflow execution

Статус: не начата.

Не сделано:

- executable card types;
- workflow planner;
- DAG builder;
- contract checker;
- BullMQ worker;
- `workflow_runs` runtime API;
- run/debug UI.

### Фаза 9. AI-agent поверх графа

Статус: не начата.

Не сделано:

- suggest missing cards;
- suggest connections;
- detect duplicates/contradictions;
- explain graph;
- generate workflow from prompt.

### Фаза 10. Enterprise-ready layer

Статус: не начата.

Не сделано:

- production auth/security model;
- audit log in runtime;
- CI/CD;
- observability;
- deployment profile;
- backup/restore strategy;
- permissioned sharing.

## 3. Рекомендуемый порядок следующих этапов

### Этап A. Product trust and permissions

Цель: убрать главный production-risk и подготовить основу для Share, Files, Notifications.

Задачи:

1. Добавить dev-auth middleware в API.
2. Ввести request user context.
3. Проверять workspace membership на board/card endpoints.
4. Добавить роли `owner/admin/editor/viewer`.
5. Добавить тесты доступа: read allowed, write denied, missing membership, wrong role.
6. Подготовить переход к Supabase/Auth.js без переписывания домена.

Результат: API больше не является полностью открытым.

### Этап B. Board editing completeness

Цель: сделать canvas полноценным редактором, а не только card editor.

Задачи:

1. Реализовать connection creation.
2. Добавить connection inspector.
3. Добавить delete/soft-delete card.
4. Добавить undo/redo для card update/create/delete.
5. Добавить board snapshots.
6. Добавить resize cards.
7. Добавить context menu для node actions.

Результат: пользователь может строить и править граф.

### Этап C. Files MVP

Цель: включить `Files` и `Attach file` как рабочие функции.

Задачи:

1. Добавить API для files/card_files.
2. Подключить MinIO client.
3. Реализовать upload/download.
4. Реализовать attach/detach к карточке.
5. Добавить file screen и card file panel.
6. Добавить тесты upload metadata, attach, detach.

Результат: файлы становятся реальными сущностями продукта.

### Этап D. Templates and schema-driven cards

Цель: включить `Templates` и сделать карточки расширяемыми.

Задачи:

1. Использовать `card_types` как runtime registry.
2. Добавить template list.
3. Добавить create card from template.
4. Добавить JSON Schema fields for templates.
5. Добавить schema-aware inspector.

Результат: пользователь создает разные типы карточек без правки frontend-кода.

### Этап E. Workflow Run MVP

Цель: включить `Run workflow` как контролируемый dry-run/debug flow.

Задачи:

1. Добавить API `POST /workflow/run`.
2. Создать `workflow_runs` и `node_executions` runtime repository.
3. Реализовать DAG planner.
4. На первом этапе выполнять только safe/mock executable types.
5. Добавить run panel with logs.
6. Добавить cancellation and failure states.

Результат: граф можно запустить в безопасном режиме и увидеть execution log.

### Этап F. Notifications MVP

Цель: включить bell button и связать события продукта с пользователем.

Задачи:

1. Добавить repository/API для notifications.
2. Создавать notifications на file upload, share invite, workflow finished/failed.
3. Добавить unread counter.
4. Добавить notification popover.
5. Добавить mark read / mark all read.

Результат: пользователь видит важные события внутри продукта.

### Этап G. AI Assistant MVP

Цель: включить AI Assistant без риска неконтролируемых изменений.

Задачи:

1. Добавить chat UI panel.
2. Добавить `POST /ai/ask-board`.
3. Сначала использовать deterministic board summary без внешней модели.
4. Затем подключить embeddings/RAG.
5. Добавить source citations: cards/files/connections.
6. Добавить AI audit log.
7. Запретить silent mutations: AI только предлагает изменения, пользователь применяет их явно.

Результат: AI Assistant отвечает по доске и не меняет данные без подтверждения.

## 4. План по текущим отключенным функциям

### 4.1. Files

Статус: выполнено как read-only MVP.

Назначение: отдельный экран всех файлов workspace/project/board.

MVP:

1. API:
   - `GET /boards/:boardId/files`;
   - `GET /files/:fileId`;
   - `DELETE /files/:fileId` as soft delete.
2. DB:
   - использовать `files`;
   - использовать `card_files`;
   - добавить seed/runtime examples.
3. UI:
   - заменить disabled `Files` на экран/панель files;
   - показать filename, type, size, status, linked card;
   - открыть file detail drawer.
4. Tests:
   - list files;
   - file not found;
   - permission denied after auth layer.

Зависимости: Auth/membership желательно до production, но dev MVP можно сделать до полной авторизации.

Итог реализации:

- добавлен repository method `listFiles`;
- добавлен API endpoint `GET /boards/:boardId/files`;
- список файлов собирается из файлов, уже привязанных к активным карточкам;
- файлы карточек, перемещенных в Trash, исключаются из списка;
- в UI включен пункт `Files`;
- добавлен read-only экран Files с loading/error/empty/list состояниями;
- добавлена detail-панель выбранного файла и переход к linked card;
- добавлены repository tests для list files и исключения trashed card files;
- проведены `typecheck` и `test`.

Ограничения текущего MVP:

- upload/download, detach, MinIO runtime и permanent file delete остаются в следующем этапе `Attach file` / Files runtime.

### 4.2. AI Assistant

Назначение: чат по текущей доске.

MVP:

1. UI:
   - открыть assistant panel вместо disabled button;
   - input для вопроса;
   - message list;
   - loading/error states.
2. API:
   - `POST /ai/ask-board`;
   - request: `boardId`, `question`;
   - response: answer + referenced cards.
3. First implementation:
   - deterministic answer from board JSON, without external AI key;
   - later OpenAI/RAG adapter.
4. Safety:
   - no direct mutation;
   - suggestions are explicit and require Apply.
5. Tests:
   - asks about existing card;
   - handles unknown question;
   - validates board access.

Зависимости: board summary, later embeddings.

### 4.3. Templates

Назначение: создание карточек из типизированных шаблонов.

MVP:

1. API:
   - `GET /card-types`;
   - `POST /boards/:boardId/cards` accepts template key.
2. UI:
   - Templates screen/panel;
   - template picker in Add flow;
   - preview fields before creation.
3. Data:
   - use `card_types`;
   - add `schema`, `ui_schema`, defaults.
4. Tests:
   - create card from template;
   - invalid template key;
   - schema default application.

Зависимости: card type registry.

### 4.4. Trash

Статус: выполнено в коммите `e084b71`.

Назначение: безопасное удаление и восстановление.

MVP:

1. API:
   - `DELETE /cards/:cardId` sets `deleted_at`;
   - `POST /cards/:cardId/restore`;
   - `GET /boards/:boardId/trash`.
2. UI:
   - Trash screen;
   - restore action;
   - permanent delete only after confirmation.
3. Data:
   - reuse `deleted_at` already present in schema;
   - include cards/files/connections.
4. Tests:
   - deleted card disappears from board;
   - restore returns it;
   - permanent delete requires role.

Зависимости: auth/roles before production.

Итог реализации:

- добавлены repository-операции `deleteCard`, `restoreCard`, `listDeletedCards`;
- добавлены API endpoints `DELETE /cards/:cardId`, `POST /cards/:cardId/restore`, `GET /boards/:boardId/trash`;
- soft-delete использует `deleted_at` и не затирает исходный `status`;
- в UI включен пункт `Trash`;
- в inspector добавлено подтверждаемое действие `Move to Trash`;
- добавлен экран Trash с empty/loading/list состояниями и restore action;
- добавлены repository tests для delete/restore/list;
- проведены `typecheck`, `test`, `build` и browser-level сценарий delete/restore/status-preservation.

### 4.5. Share

Назначение: управление доступом к workspace/board.

MVP:

1. Phase 1:
   - Copy board link.
   - Share modal with current members from demo data.
2. Phase 2:
   - invite by email;
   - role selection;
   - membership persistence.
3. API:
   - `GET /workspaces/:workspaceId/members`;
   - `POST /workspaces/:workspaceId/invites`;
   - `PATCH /workspaces/:workspaceId/members/:userId`.
4. Security:
   - only owner/admin can invite/change roles.
5. Tests:
   - viewer cannot invite;
   - editor can access board but cannot manage members.

Зависимости: auth/membership.

### 4.6. Run

Назначение: запуск workflow.

MVP:

1. API:
   - `POST /boards/:boardId/run`;
   - `GET /workflow/runs/:runId`;
   - `GET /workflow/runs/:runId/nodes`.
2. Engine:
   - build DAG from board connections;
   - validate no cycles;
   - validate required inputs;
   - create dry-run result.
3. UI:
   - Run button opens run panel;
   - show queued/running/succeeded/failed;
   - show node execution list.
4. Tests:
   - valid DAG;
   - cycle rejected;
   - missing input rejected.

Зависимости: connection contracts, workflow tables, later worker/BullMQ.

### 4.7. Notifications

Назначение: системные события пользователя.

MVP:

1. API:
   - `GET /notifications`;
   - `PATCH /notifications/:id/read`;
   - `POST /notifications` internal event helper.
2. UI:
   - bell popover;
   - unread badge;
   - mark read.
3. Events:
   - card saved;
   - file uploaded;
   - workflow run finished/failed;
   - share invite received.
4. Tests:
   - unread count;
   - mark read;
   - user only sees own notifications.

Зависимости: auth for production-grade behavior.

### 4.8. Attach file

Назначение: привязка файла к конкретной карточке.

MVP:

1. UI:
   - enable `Attach file` in inspector;
   - open upload/dropzone dialog;
   - show upload progress;
   - update card file list after upload.
2. API:
   - `POST /cards/:cardId/files`;
   - multipart upload;
   - write file to MinIO;
   - insert `files` + `card_files`.
3. Validation:
   - max file size;
   - MIME allowlist;
   - filename normalization.
4. Tests:
   - attach file success;
   - invalid MIME;
   - file appears in card inspector.

Зависимости: Files MVP and MinIO client.

### 4.9. Add tag

Статус: выполнено в коммите `157fa74`.

Назначение: простое редактирование metadata карточки.

MVP:

1. UI:
   - enable `Add tag`;
   - inline input;
   - Enter to add;
   - remove tag button;
   - duplicate prevention.
2. API:
   - reuse `PATCH /cards/:cardId` with `tags`.
3. Validation:
   - trim/lowercase;
   - max length;
   - max count per card.
4. Tests:
   - add tag;
   - remove tag;
   - duplicate tag rejected or ignored.

Зависимости: none. This is the smallest useful next feature.

Итог реализации:

- включено inline-редактирование tags в inspector;
- добавлено удаление tag через chip action;
- добавлена нормализация `trim/lowercase/kebab-case`;
- добавлена защита от дублей;
- сохранение работает через существующий `PATCH /cards/:cardId`;
- проведены `typecheck`, `test`, `build` и browser-level сценарий add/remove/persist.

## 5. Recommended immediate sprint order

1. Add tag. Done.
2. Trash soft-delete/restore for cards. Done.
3. Files list read-only. Done.
4. Attach file upload to card. Current next.
5. Templates picker for Add card.
6. Share modal with copy link, then membership.
7. Notifications popover.
8. Run workflow dry-run.
9. AI Assistant deterministic board Q&A, then RAG.

Reasoning:

- `Add tag` is small, validates inspector UX, and reuses existing PATCH.
- `Trash` creates safe deletion before users can manage many objects.
- `Files` and `Attach file` unlock a core product promise.
- `Templates` makes card creation meaningful.
- `Share`, `Notifications`, `Run`, and `AI` need stronger backend concepts and should follow foundational runtime APIs.

## 6. Definition of done for each feature

Every feature should ship with:

- frontend state for loading/success/error/empty;
- API validation via Zod;
- repository tests;
- at least one browser-level first-user scenario;
- no active button that silently does nothing;
- security check for workspace access once auth is introduced;
- README or docs update when the user-facing workflow changes.
