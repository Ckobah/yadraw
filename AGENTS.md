# AGENTS.md

## Project

Yadraw is a V2 visual graph/card editor.

Core model:

- `card` is a semantic JSON entity.
- Canvas is for graph layout and connections.
- Inspector is for editing card content.
- Visual edit mode is for card appearance/layout only.
- Attachments are stored outside `card.data`.

## Current stack

- Web: Next.js / React / TypeScript / React Flow.
- API: Fastify / TypeScript.
- DB: PostgreSQL V2 schema.
- Files: MinIO/S3 via backend API.
- Runtime: strict V2, `v2-postgres`.

## Mandatory rules

### V2 only

Work on V2 code unless the task explicitly says otherwise.

Do not change:

- legacy BoardEditor
- legacy adapter
- old V1 runtime
- V1 database behavior

### Browser auth boundary

Never expose server auth/config to browser code.

Forbidden in browser/client bundle:

- `V2_USER_ID`
- `x-yadraw-user-id`
- database URLs
- S3 credentials
- MinIO credentials

Browser must call same-origin Next proxy routes under:

```text
/v2/actions/...
```

Next proxy routes may call backend API with server-side headers.

### Product UI language

Use English for all hardcoded product UI labels, buttons, messages, placeholders, section titles, and warnings.

Do not add Russian UI strings unless the task explicitly asks for Russian UI.

Future i18n/language switching will be implemented separately.

### Card data boundary

Do not store system metadata in `card.data`.

Forbidden inside `card.data`:

- files
- attachments
- storage paths
- connections
- visual style
- ports
- card type metadata
- auth/user IDs

`card.data` is user/business JSON only.

### Attachments boundary

Files are not part of `card.data`.

Attachments must use:

- binary object in MinIO/S3
- metadata in `files`
- card relation in `card_files`

Do not copy physical files or `card_files` unless the task explicitly says so.

### Visual style boundary

Visual appearance is separate from semantic data.

Use `visualStyle` / `size` for presentation.

Do not put visual settings into `card.data`.

Card background color belongs to card type, not individual card visual style.

### Ports and connections

Ports are semantic card type/interface data.

Do not create, delete, or rename ports unless the task explicitly says so.

Visual editing may adjust presentation only, not port semantics.

Connections must not be copied or mutated unless the task explicitly says so.

### DB and migrations

Do not add migrations unless the task explicitly asks for schema changes.

Do not run destructive DB commands.

Do not run V1→V2 migration unless explicitly instructed.

### Files to avoid unless required

Do not modify these unless the task explicitly requires it:

- legacy BoardEditor
- legacy repository/adapter
- production deploy workflow
- DB migrations
- shared schemas
- auth/runtime config

## Work style

Keep changes small and task-scoped.

Prefer existing patterns over new abstractions.

Do not add dependencies unless explicitly required.

Do not refactor unrelated code.

Do not combine multiple product features in one PR.

## Testing policy

Run checks only for affected workspaces.

For web-only changes:

```bash
npm run typecheck --workspace @yadraw/web
npm run build --workspace @yadraw/web
git diff --check
```

For API changes:

```bash
npm run typecheck --workspace @yadraw/api
npm run test --workspace @yadraw/api
npm run build --workspace @yadraw/api
git diff --check
```

For shared changes:

```bash
npm run typecheck --workspace @yadraw/shared
npm run test --workspace @yadraw/shared
git diff --check
```

When touching browser code, also check:

```bash
grep -R "V2_USER_ID" apps/web/.next/static || true
grep -R "x-yadraw-user-id" apps/web/.next/static || true
grep -R "S3_SECRET_ACCESS_KEY" apps/web/.next/static || true
```

Expected result: no matches.

## Before starting work

Always start from current `main`:

```bash
git fetch origin main
git reset --hard origin/main
git status -sb
git rev-parse HEAD
```

Do not start from an outdated local checkout.

## Report format

After completing a task, report:

- commit hash
- changed files
- what was implemented
- checks run and results
- manual verification
- confirmation of boundaries:
  - legacy untouched
  - `card.data` boundary preserved
  - browser secrets not exposed
  - files/attachments boundary preserved when relevant
  - connections/ports untouched when relevant
