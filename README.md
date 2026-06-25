# Yadraw

Visual JSON cards, workflows, files, and AI search system.

This repository currently contains the first implementation foundation:

- npm workspaces monorepo
- Next.js web app with a visual board editor
- Fastify API skeleton with board/card endpoints
- API storage modes: PostgreSQL when `DATABASE_URL` is available, memory fallback otherwise
- editable card properties and positions through the board inspector
- shared TypeScript and Zod domain contracts
- PostgreSQL foundation migration with `pgvector`
- local Docker Compose for PostgreSQL, Redis, and MinIO

## Project Layout

```text
apps/
  web/          Next.js board editor
  api/          Fastify API service
packages/
  shared/       Domain schemas, types, and demo board data
  db/           SQL migrations
infra/
  docker/       Local infrastructure
```

## Requirements

- Node.js 22+
- npm 11+
- Docker, for local infrastructure

## Install

```bash
npm install
```

## Run Web App

```bash
npm run dev:web
```

The web app runs at:

```text
http://localhost:3000
```

## Run API

```bash
npm run dev:api
```

The API runs at:

```text
http://127.0.0.1:4000
```

Useful endpoints:

```text
GET  /health
GET  /boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2
GET  /search?q=enrich
POST /boards/:boardId/cards
PATCH /cards/:cardId
```

`GET /health` returns the active storage mode:

```json
{"ok":true,"service":"yadraw-api","storage":"memory"}
```

When `DATABASE_URL` points to a reachable PostgreSQL database, the API uses PostgreSQL.
Without it, the API falls back to the in-memory demo board so the app remains usable during local setup.

## Local Infrastructure

```bash
npm run infra:up
```

This starts:

- PostgreSQL with `pgvector` on port `5433`
- Redis on port `6379`
- MinIO on ports `9000` and `9001`

The first SQL migration is mounted into PostgreSQL's init directory for fresh local databases.
The second migration seeds the visual demo board shown in the web app.

To run the API against local PostgreSQL, create `.env` from `.env.example` and start the API:

```bash
copy .env.example .env
npm run dev:api
```

Docker Desktop must be running before `npm run infra:up`.

## Current Phase

Phase 1 is focused on getting the foundation in place:

1. Monorepo
2. PostgreSQL-compatible schema
3. Workspace/project/board/card/connection/file model
4. Basic API shape
5. Frontend shell
6. React Flow canvas

Next implementation steps:

- add auth and workspace membership
- add connection creation and editing flows
- add undo/redo and board snapshots
- add file upload and card attachments
- add focused tests for shared schemas and API endpoints
