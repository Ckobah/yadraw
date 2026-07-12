# Yadraw

**A visual workspace where every card is structured data.**

Build diagrams, data maps, workflows, system designs, and connected knowledge on an infinite canvas. Yadraw combines the simplicity of a whiteboard with typed cards, explicit ports, files, JSON data, and persistent connections.

<p align="center">
  <a href="https://yadraw.com"><strong>Open Yadraw</strong></a>
  ·
  <a href="#english">English</a>
  ·
  <a href="#русский">Русский</a>
</p>

<p align="center">
  <a href="https://github.com/Ckobah/yadraw/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/Ckobah/yadraw/actions/workflows/deploy.yml/badge.svg"></a>
  <img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-V2-4169E1?logo=postgresql&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-beta-175CD3">
</p>

![Yadraw board overview](docs/screenshots/yadraw-board-overview.png)

> The screenshot shows the product direction and the core interaction model. The active V2 interface is intentionally more compact and continues to evolve.

---

<a id="english"></a>

## English

### One canvas, many uses

Yadraw is not tied to one methodology. A card can represent a task, service, database, document, person, decision, API endpoint, or any JSON-shaped entity you define.

| Use case | Simple example |
| --- | --- |
| System architecture | Connect services, queues, databases, and external APIs through typed ports. |
| Data mapping | Show how fields move from a source to a target and keep mapping details on each connection. |
| Product planning | Arrange initiatives, requirements, decisions, and dependencies on one board. |
| Research | Build a connected map of sources, findings, files, and open questions. |
| Operations | Model an incident, ownership, affected systems, and recovery steps. |
| Content pipeline | Connect ideas, drafts, reviews, assets, and publication targets. |

### Designed to stay out of the way

- **Direct manipulation** — select, connect, move, and edit objects on the canvas.
- **Automatic saving** — changes are persisted without Save or Cancel buttons.
- **Typed cards** — reusable schemas keep information consistent.
- **Explicit ports** — connections attach to stable semantic inputs and outputs.
- **Automatic or manual routes** — keep connectors tidy or shape them yourself.
- **Multi-selection** — select with Ctrl/Cmd, drag groups, or use a selection rectangle.
- **Keyboard workflow** — copy, paste, cut, delete, undo, and redo.
- **Files where they belong** — attach files without mixing storage metadata into card data.
- **Private workspaces** — Supabase authentication and server-side access checks protect boards.

### Structured, not restrictive

Every card has two independent layers:

```text
Content                         Presentation
────────────────────────────    ────────────────────────────
title                           position and size
description                     typography and alignment
user-defined JSON data          connector slot placement
typed schema fields             visual connector style
```

This separation keeps business data portable while the canvas remains free to evolve.

![Structured card details](docs/screenshots/yadraw-card-detail.png)

### A small example

Create three card types:

```text
API endpoint     output: order
Transformer      input: order       output: normalized_order
Database         input: normalized_order
```

Place one card of each type, connect matching ports, and attach the API specification to the first card. The board is now both a readable diagram and a structured model that can be exported as JSON.

### What is available today

- personal accounts and private workspaces;
- dashboard with create, rename, duplicate, archive, export, and delete actions;
- typed cards and card type schemas;
- typed connections with automatic and manual geometry;
- card and connection attachments with preview;
- linked fields between connected cards;
- minimap, zoom controls, multi-selection, clipboard, undo, and redo;
- automatic persistence to PostgreSQL;
- responsive inspectors with keyboard-accessible dialogs;
- production backup, health checks, rate limiting, and structured API logs.

Yadraw is currently in **beta**. Real-time collaboration, invitations, semantic search, AI assistance, and workflow execution are not part of the current release.

### Architecture

```mermaid
flowchart LR
  Browser["Next.js / React Flow"] -->|same-origin /v2/actions| Web["Next.js server"]
  Web -->|verified user context| API["Fastify API"]
  API --> Service["V2 service layer"]
  Service --> DB[(PostgreSQL)]
  Service --> Files[(MinIO / S3)]
  Browser --> Auth["Supabase Auth"]
```

The browser never receives database credentials, S3 credentials, the internal API secret, or a trusted user-id header.

### Repository

```text
apps/
  web/              Next.js application and V2 board editor
  api/              Fastify API, authorization, and V2 services

packages/
  shared/           Zod schemas, types, and API contracts
  db/               V2 PostgreSQL migrations and local seed

infra/docker/       PostgreSQL, Redis, and MinIO for development
scripts/            backup, deployment, and production smoke checks
docs/               architecture notes and screenshots
```

### Local development

#### Requirements

- Node.js 22+
- npm
- Docker
- a hosted or self-hosted Supabase project with email/password authentication

#### 1. Install and start infrastructure

```bash
git clone https://github.com/Ckobah/yadraw.git
cd yadraw
npm ci
npm run infra:up
docker exec yadraw-postgres createdb -U yadraw yadraw_v2
```

Create the `workspace-files` bucket in MinIO at <http://127.0.0.1:9001> before testing attachments.

#### 2. Configure the environment

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

At minimum, configure:

```dotenv
YADRAW_V2_STORAGE=v2-postgres
V2_DATABASE_URL=postgres://yadraw:yadraw@127.0.0.1:5433/yadraw_v2
INTERNAL_API_SECRET=replace-with-at-least-32-random-characters

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=yadraw
S3_SECRET_ACCESS_KEY=yadraw-secret
S3_BUCKET=workspace-files
```

Allow this Supabase redirect URL:

```text
http://127.0.0.1:3000/auth/callback
```

#### 3. Apply the schema and optional demo data

```bash
npm run v2:migrations:apply --workspace @yadraw/api
docker exec -i yadraw-postgres psql -U yadraw -d yadraw_v2 < packages/db/seeds/v2_local_seed.sql
```

PowerShell seed command:

```powershell
Get-Content packages/db/seeds/v2_local_seed.sql | docker exec -i yadraw-postgres psql -U yadraw -d yadraw_v2
```

#### 4. Run the application

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

Open <http://127.0.0.1:3000>.

### Quality checks

```bash
npm run typecheck
npm run test
npm run test:postgres
npm run build
```

Production deployment also runs migrations twice to verify idempotency, rejects server secrets in the browser bundle, creates a backup, and performs a smoke test.

### Security model

- Supabase sessions are verified on the server.
- Browser mutations use same-origin proxy routes with origin checks.
- Workspace membership is enforced by the API for boards, cards, connections, and files.
- SQL queries are parameterized.
- Upload size and multipart limits are enforced server-side.
- Files are stored outside `card.data` in private object storage.
- CSP, clickjacking, MIME-sniffing, referrer, and permissions headers are enabled.
- Production API access requires a timing-safe internal secret check.

Security issues should not be posted publicly. Use the contact listed on the [support page](https://yadraw.com/support).

### Project status and license

Yadraw is under active development and may change before a stable release. This repository does not currently publish an open-source license; all rights are reserved unless stated otherwise.

---

<a id="русский"></a>

## Русский

### Один холст — множество задач

Yadraw — это визуальное рабочее пространство, где каждая карточка одновременно является структурированными данными. Карточка может представлять задачу, сервис, базу данных, документ, человека, решение, API endpoint или любую JSON-сущность, которую вы определите сами.

| Сценарий | Простой пример |
| --- | --- |
| Архитектура системы | Соедините сервисы, очереди, базы данных и внешние API через типизированные порты. |
| Маппинг данных | Покажите движение полей от источника к получателю и храните детали на связи. |
| Планирование продукта | Разместите инициативы, требования, решения и зависимости на одной доске. |
| Исследование | Соберите связанную карту источников, выводов, файлов и открытых вопросов. |
| Эксплуатация | Опишите инцидент, ответственных, затронутые системы и шаги восстановления. |
| Контент-процесс | Соедините идеи, черновики, проверки, материалы и каналы публикации. |

### Интерфейс не мешает работе

- **Прямое управление** — выбирайте, соединяйте, перемещайте и редактируйте объекты на холсте.
- **Автосохранение** — изменения сохраняются без кнопок «Сохранить» и «Отмена».
- **Типизированные карточки** — переиспользуемые схемы поддерживают порядок в данных.
- **Явные порты** — связи закреплены за стабильными входами и выходами.
- **Автоматические и ручные маршруты** — коннектор можно доверить редактору или настроить самостоятельно.
- **Групповое выделение** — Ctrl/Cmd, рамка выделения и перемещение нескольких карточек.
- **Горячие клавиши** — копирование, вставка, удаление, undo и redo.
- **Файлы рядом с объектом** — вложения не смешиваются с пользовательскими JSON-данными.
- **Личные пространства** — Supabase Auth и серверная проверка доступа защищают доски.

### Структурированность без ограничений

У карточки есть два независимых слоя:

```text
Содержание                      Представление
────────────────────────────    ────────────────────────────
название                        позиция и размер
описание                        типографика и выравнивание
пользовательские JSON-данные    расположение портов
поля типизированной схемы       внешний вид коннекторов
```

Бизнес-данные остаются переносимыми, а визуальное представление можно менять независимо.

### Простой пример

Создайте три типа карточек:

```text
API endpoint     выход: order
Transformer      вход: order       выход: normalized_order
Database         вход: normalized_order
```

Разместите по одной карточке каждого типа, соедините подходящие порты и прикрепите API-спецификацию к первой карточке. Доска одновременно станет понятной диаграммой и структурированной моделью, которую можно экспортировать в JSON.

### Что уже работает

- личные аккаунты и приватные рабочие пространства;
- dashboard с созданием, переименованием, дублированием, архивом, экспортом и удалением досок;
- типизированные карточки и схемы типов;
- типизированные связи с автоматической и ручной геометрией;
- файлы карточек и связей с предпросмотром;
- связанные поля между соединёнными карточками;
- minimap, масштаб, групповое выделение, clipboard, undo и redo;
- автоматическое сохранение в PostgreSQL;
- адаптивные инспекторы и управление модальными окнами с клавиатуры;
- production backup, health checks, rate limiting и структурированные API-логи.

Сейчас Yadraw находится в статусе **beta**. Совместное редактирование в реальном времени, приглашения, семантический поиск, AI-функции и выполнение workflow пока не входят в текущий релиз.

### Архитектура и безопасность

Основная схема показана в [английском разделе](#architecture). Браузер работает только с same-origin маршрутами Next.js и никогда не получает доступ к БД, S3 credentials, внутреннему API secret или доверенному заголовку пользователя.

Основные меры защиты:

- серверная проверка Supabase-сессии;
- проверка origin для изменяющих запросов;
- проверка membership для досок, карточек, связей и файлов;
- параметризованные SQL-запросы;
- серверные ограничения размера файлов;
- приватное объектное хранилище вне `card.data`;
- CSP и защита от clickjacking и MIME sniffing;
- timing-safe проверка внутреннего API secret.

### Локальный запуск

Команды установки, настройки Supabase, PostgreSQL и MinIO приведены в разделе [Local development](#local-development). После настройки откройте <http://127.0.0.1:3000>.

Проверки проекта:

```bash
npm run typecheck
npm run test
npm run test:postgres
npm run build
```

### Статус и лицензия

Yadraw активно развивается и может меняться до стабильного релиза. В репозитории пока не опубликована open-source лицензия; если не указано иное, все права защищены.
