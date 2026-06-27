# Server Deployment And Physical Tests

Дата: 2026-06-27

Этот документ описывает практический способ развернуть текущий Yadraw V2 core на сервере и вручную проверить, что ядро работает как продукт: API является источником истины, Postgres используется явно, user context обязателен, workspace roles ограничивают доступ, поиск идет через backend.

## 1. Выводы По Текущему Состоянию

После core-hardening этапов проект получил минимальное продуктовое ядро:

- Web открывает конкретную доску через `/boards/:boardId`.
- API больше не подменяет PostgreSQL in-memory режимом молча.
- `YADRAW_STORAGE=postgres|memory` выбирает storage явно.
- Product endpoints требуют user context.
- Workspace roles уже ограничивают чтение и запись.
- Demo seed создает owner/editor/viewer membership в `workspace_members`.
- API errors приведены к единому формату.
- Пользовательский `data._yadraw` не может перезаписать системные metadata.
- SearchDialog использует backend search contract.
- Добавлены PostgreSQL smoke tests через временную schema.

Это все еще не production SaaS. Здесь нет полноценного OAuth, RLS, realtime, object storage upload и deployment automation. Но текущая база уже годится для серверного dev/staging-развертывания и физического тестирования ядра.

## 2. Требования К Серверу

Минимально:

- Ubuntu 22.04/24.04 или другой Linux VPS.
- 2 CPU.
- 2-4 GB RAM.
- 20+ GB disk.
- Node.js 22+.
- npm 11+.
- Docker + Docker Compose plugin.
- Nginx или Caddy для reverse proxy.
- Открытые порты:
  - `80/443` наружу;
  - web/API порты только локально, если используется reverse proxy.

По умолчанию документация использует:

- Web: `3000`.
- API: `4000`.

На сервере эти порты часто уже заняты, например Supabase Studio может занимать `3000`, Analytics - `4000`. В таком случае используйте свободные порты, например `3004/4004`, и синхронно обновите `.env`, systemd и reverse proxy.

## 3. Подготовка Сервера

Установить базовые пакеты:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates nginx
```

Установить Node.js 22 через NodeSource или другой управляемый способ:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Установить Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

После добавления пользователя в группу Docker перелогиниться.

## 4. Получение Кода

```bash
mkdir -p /opt/yadraw
sudo chown "$USER":"$USER" /opt/yadraw
cd /opt/yadraw
git clone https://github.com/Ckobah/yadraw.git .
```

Установить зависимости:

```bash
npm install
```

## 5. Environment

Создать `.env`:

```bash
cp .env.example .env
```

Минимальный server/staging вариант:

```text
PORT=4000
HOST=127.0.0.1
WEB_PORT=3000
CORS_ORIGIN=https://your-domain.example
YADRAW_STORAGE=postgres
DATABASE_URL=postgres://yadraw:yadraw@127.0.0.1:5433/yadraw
DATABASE_URL_TEST=postgres://yadraw:yadraw@127.0.0.1:5433/yadraw
DEV_USER_ID=02f38bb1-0cde-4473-95ef-1d50db3467e4
REDIS_URL=redis://127.0.0.1:6379
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=yadraw
S3_SECRET_ACCESS_KEY=change-this
S3_BUCKET=workspace-files
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=https://your-domain.example/api
```

Важно:

- Для staging можно оставить `DEV_USER_ID`.
- Для production вместо `DEV_USER_ID` нужен настоящий auth layer.
- `YADRAW_STORAGE=memory` на сервере использовать только для одноразовой проверки без сохранения данных.
- `PORT` управляет API.
- `WEB_PORT` используется в systemd-команде для Next.js.
- `API_URL` нужен server-side Next rendering.
- `NEXT_PUBLIC_API_URL` инлайнится в клиентский bundle во время `npm run build`; web app загружает root `.env` из монорепы через `apps/web/next.config.mjs`.
- Если меняете `NEXT_PUBLIC_API_URL`, нужно пересобрать web: `npm run build --workspace @yadraw/web`.

## 6. Инфраструктура

Поднять PostgreSQL, Redis, MinIO:

```bash
npm run infra:up
docker ps
```

Проверить Postgres:

```bash
docker exec yadraw-postgres pg_isready -U yadraw -d yadraw
```

На чистой базе Docker применит `packages/db/migrations/*.sql`, включая demo seed. Demo users уже должны быть в `workspace_members`; ручной `insert` не нужен.

Проверить:

```bash
docker exec yadraw-postgres psql -U yadraw -d yadraw -c \
  "select user_id, role from workspace_members where workspace_id = '3cce8c2f-3d0f-49aa-89da-9f2f1f655b33' order by role"
```

Ожидаемо: owner/editor/viewer demo users.

Если база уже существовала до этого исправления, Docker entrypoint не перезапустит миграции автоматически. Для staging проще пересоздать volume или вручную применить новый блок `workspace_members` из `packages/db/migrations/002_demo_seed.sql`.

## 7. Проверки Перед Запуском

```bash
npm run test
npm run typecheck
npm run build
npm run test:postgres
```

Ожидаемо:

- unit/shared/API tests проходят;
- build проходит;
- `test:postgres` создает временную schema, применяет migrations и удаляет schema после тестов.

## 8. Запуск Сервисов Через systemd

Собрать проект:

```bash
npm run build
```

Создать API service:

```bash
sudo tee /etc/systemd/system/yadraw-api.service >/dev/null <<'EOF'
[Unit]
Description=Yadraw API
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/yadraw
EnvironmentFile=/opt/yadraw/.env
ExecStart=/usr/bin/npm run start --workspace @yadraw/api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Создать Web service:

```bash
sudo tee /etc/systemd/system/yadraw-web.service >/dev/null <<'EOF'
[Unit]
Description=Yadraw Web
After=network.target yadraw-api.service

[Service]
Type=simple
WorkingDirectory=/opt/yadraw
EnvironmentFile=/opt/yadraw/.env
ExecStart=/usr/bin/npm run start --workspace @yadraw/web -- -p ${WEB_PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Если systemd ругается на `${WEB_PORT}`, замените строку на конкретный порт:

```ini
ExecStart=/usr/bin/npm run start --workspace @yadraw/web -- -p 3004
```

Запустить:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now yadraw-api yadraw-web
sudo systemctl status yadraw-api
sudo systemctl status yadraw-web
```

Логи:

```bash
journalctl -u yadraw-api -f
journalctl -u yadraw-web -f
```

## 9. Reverse Proxy Nginx

Пример для одного домена:

```nginx
server {
  listen 80;
  server_name your-domain.example;

  location /api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Если используете нестандартные порты:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:4004/;
}

location / {
  proxy_pass http://127.0.0.1:3004;
}
```

Активировать:

```bash
sudo ln -s /etc/nginx/sites-available/yadraw /etc/nginx/sites-enabled/yadraw
sudo nginx -t
sudo systemctl reload nginx
```

Если используется Nginx Proxy Manager, после смены портов проверьте не только UI/SQLite-значения, но и сгенерированный `.conf`. NPM не всегда немедленно регенерирует конфиги из БД. Надежная проверка:

```bash
docker exec <npm-container> nginx -T | grep -E "proxy_pass|server_name" -n
docker restart <npm-container>
```

Для HTTPS подключить certbot или использовать Caddy.

## 10. Физические Тесты

Использовать demo board:

```text
b4f94635-6fd5-4a6b-8608-61a69c81fbe2
```

Demo users:

```text
owner  02f38bb1-0cde-4473-95ef-1d50db3467e4
editor bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4
viewer 9f18a762-bf5b-4aa8-b934-f286cc51dc5b
```

### 10.1. Health

```bash
curl -s http://127.0.0.1:4000/health
```

Ожидаемо:

```json
{"ok":true,"service":"yadraw-api","storage":"postgres"}
```

### 10.2. User Context Required

Без пользователя:

```bash
curl -i http://127.0.0.1:4000/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2
```

Ожидаемо:

```text
401
```

С owner:

```bash
curl -s \
  -H "x-yadraw-user-id: 02f38bb1-0cde-4473-95ef-1d50db3467e4" \
  http://127.0.0.1:4000/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2
```

Ожидаемо: JSON доски.

### 10.3. Viewer Read, Viewer Write Denied

Read:

```bash
curl -i \
  -H "x-yadraw-user-id: 9f18a762-bf5b-4aa8-b934-f286cc51dc5b" \
  http://127.0.0.1:4000/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2
```

Ожидаемо: `200`.

Write:

```bash
curl -i \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-yadraw-user-id: 9f18a762-bf5b-4aa8-b934-f286cc51dc5b" \
  -d '{"title":"Viewer should not edit"}' \
  http://127.0.0.1:4000/cards/6bb48e57-ed49-4fd6-bdbc-a449b2756be9
```

Ожидаемо: `403`.

### 10.4. Editor Write

```bash
curl -i \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-yadraw-user-id: bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4" \
  -d '{"title":"Editor smoke update"}' \
  http://127.0.0.1:4000/cards/6bb48e57-ed49-4fd6-bdbc-a449b2756be9
```

Ожидаемо: `200`, title изменился.

### 10.5. Error Format

```bash
curl -s \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-yadraw-user-id: bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4" \
  -d '{"status":"published"}' \
  http://127.0.0.1:4000/cards/6bb48e57-ed49-4fd6-bdbc-a449b2756be9
```

Ожидаемо:

```json
{
  "error": {
    "code": "invalid_payload",
    "message": "Invalid card payload",
    "fields": {
      "status": ["..."]
    }
  }
}
```

### 10.6. Metadata Protection

```bash
curl -s \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-yadraw-user-id: bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4" \
  -d '{"data":{"safe":true,"_yadraw":{"typeKey":"hijack","inputs":["bad"],"tags":["bad"],"files":[]}}}' \
  http://127.0.0.1:4000/cards/6bb48e57-ed49-4fd6-bdbc-a449b2756be9
```

Ожидаемо:

- `data` содержит только `{ "safe": true }`;
- `typeKey`, `inputs`, `tags`, `files` не перезаписались из пользовательского `data._yadraw`.

### 10.7. Search

```bash
curl -s \
  -H "x-yadraw-user-id: 9f18a762-bf5b-4aa8-b934-f286cc51dc5b" \
  "http://127.0.0.1:4000/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2/search?q=enrich"
```

Ожидаемо: results только если user имеет доступ к workspace.

Проверить чужого пользователя:

```bash
curl -i \
  -H "x-yadraw-user-id: a57baac3-0d79-4b95-bfdd-6366d7681c81" \
  "http://127.0.0.1:4000/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2/search?q=enrich"
```

Ожидаемо: `403`.

### 10.8. Browser Test

Открыть:

```text
https://your-domain.example/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2
```

Проверить:

- доска открылась;
- cards отображаются;
- card inspector открывается;
- Add card создает карточку;
- PATCH сохраняет изменения;
- Search ищет через API;
- Trash удаляет и восстанавливает карточку;
- Files показывает привязанные file metadata;
- Share и Notifications не ломают основной flow.

## 11. Rollback

Остановить сервисы:

```bash
sudo systemctl stop yadraw-web yadraw-api
```

Откатиться на предыдущий commit:

```bash
cd /opt/yadraw
git log --oneline -5
git checkout <previous_commit>
npm install
npm run build
sudo systemctl restart yadraw-api yadraw-web
```

Если менялась база, сначала проверить migrations/backup. Текущие core-hardening изменения не добавляют новых production migrations.

## 12. Что Не Считать Пройденным Production Launch

Даже если все физические тесты зелёные, это еще не полноценный production launch, потому что остаются обязательные будущие слои:

- настоящий auth provider;
- secure sessions/tokens;
- invite flow;
- stronger deployment profile;
- backups;
- HTTPS;
- monitoring/log aggregation;
- real file upload storage path;
- rate limits.

Этот документ закрывает staging/server verification для минимального ядра, а не весь production checklist.
