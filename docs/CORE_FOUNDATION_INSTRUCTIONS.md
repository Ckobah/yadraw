# Yadraw Core Foundation Instructions

Дата: 2026-06-27

Цель документа: зафиксировать минимальный план укрепления ядра Yadraw V2 без перегруза проекта. Это не enterprise-roadmap и не список всех будущих возможностей. Это базовый набор работ, после которого проект перестает быть демо с хорошей схемой и становится устойчивым продуктовым ядром.

## 1. Что Уже Сделано

В проекте уже есть рабочая основа:

- npm workspaces monorepo.
- Next.js web app.
- Fastify API.
- Shared TypeScript/Zod contracts в `packages/shared`.
- PostgreSQL schema/migrations в `packages/db`.
- Docker Compose для PostgreSQL, Redis и MinIO.
- Визуальная доска на React Flow.
- Карточки, связи, inspector, файлы, trash, share, notifications, templates.
- PostgreSQL repository и memory repository.
- Demo seed для workspace/project/board/cards/connections.
- Базовые тесты для shared schemas и repository.
- Базовые security headers и CORS allowlist.
- `npm run test`, `npm run typecheck`, `npm run build` проходят.

Главный вывод: V2 уже имеет правильную форму продукта, но runtime-ядро еще смешивает demo-mode и product-mode.

## 2. Что Считается Минимальным Ядром

Минимальное ядро Yadraw должно гарантировать:

1. API является источником истины.
2. Storage mode выбран явно и не подменяется молча.
3. Каждый API-запрос имеет понятный user context.
4. Workspace membership защищает board/card данные.
5. Пользовательский JSON не может перезаписать системные metadata-поля.
6. Search работает через один backend contract.
7. PostgreSQL path проверяется хотя бы smoke/integration-тестами.

Все остальное можно делать позже.

## 3. Что Не Входит В Минимальное Ядро Сейчас

Эти вещи важны, но сейчас они перегрузят V2:

- OAuth/Auth.js/Supabase Auth.
- RLS.
- Полный audit log.
- Board snapshots.
- Realtime/Yjs.
- Undo/redo.
- Workflow execution.
- AI assistant.
- Реальный binary upload в MinIO.
- Полная нормализация `files/card_files`.
- Сложная permissions-система.
- Production observability.

Их нельзя забывать, но они не должны блокировать укрепление ядра.

## 4. Что Нужно Сделать

### Этап 1. API-First Board Loading

Проблема:

- `apps/web/app/page.tsx` сейчас стартует от `demoBoard`.
- API уже есть, но web все еще использует demo board как первичное состояние.

Что сделать:

- Добавить нормальный route `/boards/[boardId]`.
- Загружать board из API как основной источник.
- Оставить demo board только для явного dev/demo режима.
- Home page может редиректить на demo board id в dev, но не должна маскировать это как production behavior.

Definition of Done:

- Board UI открывается от API response.
- Если API недоступен, пользователь видит явное error/demo состояние.
- `demoBoard` не является основным happy path.

Оценка:

- Codex/один разработчик: 3-5 часов.
- Усилие: среднее.
- Риск: средний, потому что затрагивается web entrypoint и flow загрузки.

### Этап 2. Явный Storage Mode

Проблема:

- Если Postgres недоступен, API молча падает в memory repository.
- Для dev это удобно, для ядра продукта опасно.

Что сделать:

- Ввести `YADRAW_STORAGE=postgres|memory`.
- `postgres` должен требовать `DATABASE_URL`.
- Если выбран Postgres и подключение не удалось, API должен падать при старте.
- `memory` разрешить только явно.
- В production запретить `memory`.

Definition of Done:

- Невозможно случайно писать данные в memory fallback.
- `/health` показывает честный storage mode.
- README/.env.example обновлены.

Оценка:

- Codex/один разработчик: 1-2 часа.
- Усилие: низкое.
- Риск: низкий.

### Этап 3. Request User Context

Проблема:

- API сейчас может молча считать пользователя owner.
- Это ломает будущую модель доступа.

Что сделать:

- Добавить helper `getRequestContext(request)`.
- В dev принимать `x-yadraw-user-id` или `DEV_USER_ID`.
- Если user id отсутствует, возвращать `401`.
- Не делать автоматический fallback на owner.

Definition of Done:

- Все защищенные endpoints имеют user context.
- Без user id API возвращает `401`.
- Dev запуск остается простым через `DEV_USER_ID`.

Оценка:

- Codex/один разработчик: 2-4 часа.
- Усилие: среднее.
- Риск: средний, потому что надо аккуратно провести context через endpoints.

### Этап 4. Минимальная Workspace Authorization

Проблема:

- Board/card endpoints сейчас не проверяют membership.
- Любой, кто достучался до API, может читать/изменять данные.

Что сделать:

- Добавить role helper:
  - `viewer` может читать.
  - `editor`, `admin`, `owner` могут писать.
- Проверять membership для:
  - `GET /boards/:boardId`
  - `POST /boards/:boardId/cards`
  - `PATCH /cards/:cardId`
  - `DELETE /cards/:cardId`
  - `POST /cards/:cardId/restore`
  - `GET /boards/:boardId/files`
  - `GET /boards/:boardId/trash`
  - search endpoint.
- Для первого прохода не делать сложные permissions.

Definition of Done:

- User вне workspace не читает board.
- `viewer` не может писать.
- `editor` может создавать/обновлять cards.
- Есть tests на owner/editor/viewer/missing membership.

Оценка:

- Codex/один разработчик: 5-8 часов.
- Усилие: высокое для минимального ядра.
- Риск: средний/высокий, потому что меняется repository contract.

### Этап 5. Единый Error Handling

Проблема:

- Часть endpoints использует `safeParse`, часть `parse`.
- Ошибки могут быть неравномерными.

Что сделать:

- Ввести единый response format:

```json
{
  "error": {
    "code": "invalid_payload",
    "message": "Invalid payload",
    "fields": {}
  }
}
```

- Заменить прямой `parse` на `safeParse` в write endpoints.
- Добавить Fastify error handler для unexpected errors.

Definition of Done:

- Invalid body всегда возвращает `400`.
- Missing auth возвращает `401`.
- Missing role возвращает `403`.
- Missing entity возвращает `404`.

Оценка:

- Codex/один разработчик: 2-3 часа.
- Усилие: низкое/среднее.
- Риск: низкий.

### Этап 6. Защита Системных Metadata

Проблема:

- Runtime хранит часть системных данных в `cards.data._yadraw`.
- Клиент потенциально может перезаписать `_yadraw` через `data`.

Что сделать:

- Запретить пользовательскому `data` писать `_yadraw`.
- При create/update вычищать `_yadraw` из payload.
- Описать internal metadata schema в shared package.
- Обновлять `inputs`, `outputs`, `tags`, `files` только через контролируемые поля API.

Definition of Done:

- `PATCH /cards/:id` с `data._yadraw` не ломает системные поля.
- Тест покрывает попытку перезаписи `_yadraw`.
- В коде явно видно разделение user data и system metadata.

Оценка:

- Codex/один разработчик: 2-4 часа.
- Усилие: среднее.
- Риск: средний, потому что надо не сломать текущие demo данные.

### Этап 7. API Search Contract

Проблема:

- UI search ищет локально по загруженной доске.
- API search существует отдельно.
- Поведение со временем разойдется.

Что сделать:

- Сделать `GET /boards/:boardId/search?q=...`.
- Проверять workspace membership.
- UI SearchDialog должен ходить в API.
- Локальный search оставить только как fallback для explicit demo/offline mode.

Definition of Done:

- Search results приходят из backend.
- Search respects workspace access.
- UI/API search не расходятся.

Оценка:

- Codex/один разработчик: 3-5 часов.
- Усилие: среднее.
- Риск: средний.

### Этап 8. PostgreSQL Smoke Tests

Проблема:

- Сейчас основные repository tests идут по memory repository.
- SQL path и migrations почти не защищены тестами.

Что сделать:

- Добавить `npm run test:postgres` или `npm run test:integration`.
- Использовать `DATABASE_URL_TEST`.
- Минимально проверить:
  - migrations применяются;
  - board читается;
  - card create работает;
  - card update работает;
  - card delete/restore работает;
  - authorization helper работает на seeded members.

Definition of Done:

- Есть отдельный тестовый command.
- Postgres path проверяется независимо от memory tests.
- Тесты можно запускать локально после `npm run infra:up`.

Оценка:

- Codex/один разработчик: 4-8 часов.
- Усилие: среднее/высокое.
- Риск: средний, потому что надо аккуратно не портить local dev DB.

## 5. Рекомендуемый Порядок Работы

Оптимальный порядок без перегруза:

1. Явный storage mode.
2. Единый error handling.
3. Request user context.
4. Минимальная workspace authorization.
5. Защита `_yadraw`.
6. API-first board loading.
7. API search contract.
8. PostgreSQL smoke tests.

Почему так:

- Сначала убираются опасные runtime-неопределенности.
- Потом вводится identity/access boundary.
- Потом защищается доменная модель.
- Потом web переводится на правильный API-first режим.
- В конце фиксируется тестами реальный PostgreSQL path.

## 6. Общая Оценка

Минимальное ядро:

| Этап | Время | Усилие | Риск |
| --- | ---: | --- | --- |
| Storage mode | 1-2 ч | Низкое | Низкий |
| Error handling | 2-3 ч | Низкое/среднее | Низкий |
| Request context | 2-4 ч | Среднее | Средний |
| Authorization | 5-8 ч | Высокое | Средний/высокий |
| Protect `_yadraw` | 2-4 ч | Среднее | Средний |
| API-first board | 3-5 ч | Среднее | Средний |
| API search | 3-5 ч | Среднее | Средний |
| Postgres smoke tests | 4-8 ч | Среднее/высокое | Средний |

Итого:

- Быстрый проход: 22-31 час.
- Реалистичный проход с проверками: 4-6 рабочих дней.
- С запасом на ревью, исправления и ручное тестирование: 1-1.5 недели.

Оценка дана для одного сильного разработчика с помощью Codex. Если работать без отвлечений и не расширять scope, это можно сделать быстро. Если параллельно добавлять новые фичи, сроки начнут расползаться.

## 7. Definition Of Done Для Всего Ядра

Минимальное ядро считается готовым, когда:

- Web работает от API как основного источника.
- API не делает silent fallback в memory.
- Все product endpoints имеют user context.
- Workspace membership реально ограничивает чтение и запись.
- Invalid payload/auth/permission/not-found возвращают предсказуемые ошибки.
- User data не может сломать `_yadraw` metadata.
- Search идет через backend contract.
- Есть Postgres smoke tests.
- `npm run test`, `npm run typecheck`, `npm run build` проходят.

## 8. Главный Принцип

Не расширять продукт до укрепления ядра.

Сейчас правильная работа - не добавить еще одну фичу, а убрать двусмысленность из runtime:

- кто пользователь;
- где источник истины;
- где постоянное хранилище;
- кто имеет доступ;
- какие данные системные;
- какой contract использует UI.

После этого Yadraw можно развивать быстрее и без постоянной боязни сломать фундамент.
