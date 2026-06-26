# Yadraw

Structured visual workspace for typed cards, JSON data, and board connections.

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-1f8f4d?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-202020?style=for-the-badge&logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Languages

- [English](#english)
- [Русский](#русский)

---

## English

### What Yadraw Is

Yadraw is an early-stage product for building visual systems where every canvas object is also structured data.

The product direction is a professional board editor for:

- typed cards
- JSON-backed card data
- explicit card ports
- typed connections
- persistent board state
- future workflow, file, search, and AI capabilities

The current repository contains two layers:

- the existing prototype UI and API, still useful as a visual reference
- the new v2 foundation, which is being built in smaller, cleaner steps

### Current Status

Yadraw is not yet a finished product. The current work is focused on replacing the original broad prototype with a reliable v2 core.

Implemented in the v2 foundation:

- v2 product scope and non-goals
- clean v2 database design
- v2 PostgreSQL migration
- deterministic local seed
- v2 Zod API contracts
- v2 repository interface
- v2 memory repository for unit tests
- v2 PostgreSQL repository
- v2 service layer with validation
- unit tests for contracts and service behavior
- optional PostgreSQL integration test

Still intentionally out of scope for the v2 foundation:

- authentication
- workspace membership and roles
- file uploads
- AI assistant
- embeddings and semantic search
- workflow execution
- real-time collaboration
- notifications
- polished v2 frontend

See:

- [V2_FOUNDATION.md](V2_FOUNDATION.md)
- [V2_DATABASE_SCHEMA.md](V2_DATABASE_SCHEMA.md)

### Architecture

```mermaid
flowchart LR
  Web["Next.js Web App"] --> API["Fastify API"]
  API --> Contracts["Shared Zod Contracts"]
  API --> Service["v2 Service Layer"]
  Service --> Repository["v2 Repository"]
  Repository --> Postgres["PostgreSQL"]
```

The v2 direction is deliberately simple: the database is the source of truth, domain entities are explicit, and UI-shaped data is mapped at the API boundary.

### Repository Layout

```text
apps/
  web/          Next.js prototype board UI
  api/          Fastify API and v2 backend foundation

packages/
  shared/       Shared schemas, types, and v2 API contracts
  db/           SQL migrations and local seed files

infra/
  docker/       Local PostgreSQL, Redis, and MinIO stack

docs/
  screenshots/  Prototype screenshots
```

### Prototype Screenshots

The screenshots below represent the existing prototype UI, not the final v2 interface.

![Yadraw workspace overview](docs/screenshots/yadraw-workspace-inspector.png)

![Yadraw card detail](docs/screenshots/yadraw-card-detail.png)

### Requirements

- Node.js 22+
- npm
- Docker Desktop with WSL2 enabled

### Install

```bash
npm install
```

### Run The Prototype

Start infrastructure:

```bash
npm run infra:up
```

Create a local environment file:

```bash
copy .env.example .env
```

Start the API:

```bash
npm run dev:api
```

Start the web app:

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:3000
```

### v2 Database

The v2 schema is kept separate from the original migrations:

```text
packages/db/migrations/v2/001_core_foundation.sql
packages/db/seeds/v2_local_seed.sql
```

The v2 migration defines only the core model:

- `workspaces`
- `projects`
- `boards`
- `card_types`
- `card_type_ports`
- `cards`
- `connections`

The seed creates one local workspace, one project, one board, two card types, and three ports.

### v2 Integration Test

The PostgreSQL integration test is opt-in. It is skipped unless `V2_DATABASE_URL` is set.

Example:

```bash
set V2_DATABASE_URL=postgres://yadraw:yadraw@127.0.0.1:55433/yadraw_v2_verify
npm run test --workspace @yadraw/api -- src/v2/repository.postgres.test.ts
```

### Quality Checks

```bash
npm run typecheck
npm run test
npm run build
```

Current tests cover:

- legacy shared schemas
- legacy in-memory repository behavior
- v2 API contracts
- v2 service validation
- v2 memory repository workflow
- optional v2 PostgreSQL persistence workflow

### Security

The current security notes are documented in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Implemented baseline protections include:

- CORS allowlist via `CORS_ORIGIN`
- browser security headers in Next.js
- parameterized SQL queries
- `.env` excluded from Git

Authentication and workspace authorization are still planned work.

### Roadmap

Near-term v2 work:

1. Wire v2 Fastify routes.
2. Build a minimal v2 board UI.
3. Load a seeded board from PostgreSQL.
4. Create and edit cards through v2 contracts.
5. Create and delete typed connections.
6. Preserve board state after reload.

Later work:

- authentication and roles
- undo/redo
- files and attachments
- search
- AI assistant
- workflow execution
- collaboration

### License

Private project foundation. License to be defined.

---

## Русский

### Что Такое Yadraw

Yadraw - ранняя стадия продукта для визуальных систем, где каждый объект на canvas является не только блоком интерфейса, но и структурированными данными.

Продуктовое направление:

- типизированные карточки
- JSON-данные внутри карточек
- явные порты карточек
- типизированные связи
- сохранение состояния доски
- будущие workflow, файлы, поиск и AI-функции

Сейчас в репозитории есть два слоя:

- существующий прототип UI и API, который остается визуальным ориентиром
- новый v2 foundation, который строится маленькими и более чистыми шагами

### Текущий Статус

Yadraw пока не готовый продукт. Сейчас основная работа - заменить широкий прототип надежным v2-ядром.

Уже сделано для v2 foundation:

- зафиксированы scope и non-goals
- спроектирована чистая v2-схема БД
- добавлена v2 PostgreSQL migration
- добавлен детерминированный local seed
- добавлены v2 Zod API-контракты
- добавлен v2 repository interface
- добавлен v2 memory repository для unit-тестов
- добавлен v2 PostgreSQL repository
- добавлен v2 service layer с валидацией
- добавлены тесты контрактов и service behavior
- добавлен опциональный PostgreSQL integration test

Сознательно не входит в v2 foundation:

- авторизация
- workspace membership и роли
- загрузка файлов
- AI assistant
- embeddings и semantic search
- workflow execution
- real-time collaboration
- notifications
- финальный v2 frontend

См.:

- [V2_FOUNDATION.md](V2_FOUNDATION.md)
- [V2_DATABASE_SCHEMA.md](V2_DATABASE_SCHEMA.md)

### Архитектура

```mermaid
flowchart LR
  Web["Next.js Web App"] --> API["Fastify API"]
  API --> Contracts["Shared Zod Contracts"]
  API --> Service["v2 Service Layer"]
  Service --> Repository["v2 Repository"]
  Repository --> Postgres["PostgreSQL"]
```

Направление v2 простое: база данных является источником истины, доменные сущности описаны явно, а удобные для UI объекты собираются на границе API.

### Структура Репозитория

```text
apps/
  web/          прототип UI доски на Next.js
  api/          Fastify API и v2 backend foundation

packages/
  shared/       общие схемы, типы и v2 API-контракты
  db/           SQL-миграции и local seed-файлы

infra/
  docker/       локальный PostgreSQL, Redis и MinIO

docs/
  screenshots/  скриншоты прототипа
```

### Скриншоты Прототипа

Скриншоты ниже показывают существующий прототип UI, а не финальный v2-интерфейс.

![Yadraw workspace overview](docs/screenshots/yadraw-workspace-inspector.png)

![Yadraw card detail](docs/screenshots/yadraw-card-detail.png)

### Требования

- Node.js 22+
- npm
- Docker Desktop с включенным WSL2

### Установка

```bash
npm install
```

### Запуск Прототипа

Запустить инфраструктуру:

```bash
npm run infra:up
```

Создать локальный env-файл:

```bash
copy .env.example .env
```

Запустить API:

```bash
npm run dev:api
```

Запустить web app:

```bash
npm run dev:web
```

Открыть:

```text
http://127.0.0.1:3000
```

### v2 База Данных

v2-схема отделена от старых миграций:

```text
packages/db/migrations/v2/001_core_foundation.sql
packages/db/seeds/v2_local_seed.sql
```

v2 migration описывает только core-модель:

- `workspaces`
- `projects`
- `boards`
- `card_types`
- `card_type_ports`
- `cards`
- `connections`

Seed создает один local workspace, один project, одну board, два card types и три ports.

### v2 Integration Test

PostgreSQL integration test запускается только при наличии `V2_DATABASE_URL`. Без этой переменной он пропускается.

Пример:

```bash
set V2_DATABASE_URL=postgres://yadraw:yadraw@127.0.0.1:55433/yadraw_v2_verify
npm run test --workspace @yadraw/api -- src/v2/repository.postgres.test.ts
```

### Проверки Качества

```bash
npm run typecheck
npm run test
npm run build
```

Сейчас тестами покрыты:

- старые shared schemas
- старое in-memory repository behavior
- v2 API contracts
- v2 service validation
- v2 memory repository workflow
- опциональный v2 PostgreSQL persistence workflow

### Безопасность

Текущие security notes описаны в [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Уже есть базовые меры:

- CORS allowlist через `CORS_ORIGIN`
- security headers в Next.js
- параметризованные SQL-запросы
- `.env` исключен из Git

Авторизация и workspace permissions еще не реализованы.

### Roadmap

Ближайшие v2-шаги:

1. Подключить v2 Fastify routes.
2. Собрать минимальный v2 board UI.
3. Загружать seeded board из PostgreSQL.
4. Создавать и редактировать cards через v2 contracts.
5. Создавать и удалять typed connections.
6. Сохранять board state после reload.

Позже:

- авторизация и роли
- undo/redo
- файлы и attachments
- поиск
- AI assistant
- workflow execution
- collaboration

### Лицензия

Private project foundation. License to be defined.
