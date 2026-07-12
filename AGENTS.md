# AGENTS.md

## Project

Yadraw is a V2 visual workspace for structured cards, typed ports, persistent connections, and files.

The active product is V2. It is deployed at `https://yadraw.com` and currently has beta status.

Core model:

- A `card` is a semantic entity with user-defined JSON data.
- A card type defines reusable schema fields and semantic ports.
- The canvas owns graph layout and connection geometry.
- Inspectors edit semantic content.
- Visual edit mode changes presentation only.
- Attachments are stored outside card and connection data.
- PostgreSQL is the source of truth.

## Current stack

- Web: Next.js 15, React 19, TypeScript, React Flow, Zustand.
- API: Fastify 5, TypeScript, Zod.
- Auth: Supabase Auth with server-side session verification.
- DB: PostgreSQL strict V2 schema, migrations `001` through `013`.
- Files: private MinIO/S3 objects through the backend API.
- Runtime: `YADRAW_V2_STORAGE=v2-postgres` in production.
- Deployment: GitHub Actions to `us-vmmini`, followed by production smoke checks.

## Active product surfaces

- `/login`, password recovery, email confirmation, account settings.
- `/v2/dashboard` for personal workspaces and board lifecycle actions.
- `/v2/boards/[boardId]` for the V2 editor.
- Same-origin browser API routes under `/v2/actions/...`.
- Fastify V2 routes under `/v2/...` behind the Next server boundary.

## Mandatory boundaries

### V2 only

Work on V2 code unless the task explicitly names legacy behavior.

Do not modify or revive:

- legacy `BoardEditor`;
- legacy repository or adapter;
- old V1 runtime behavior;
- V1 database behavior;
- V1-to-V2 migration code unless explicitly requested.

### Browser authentication boundary

The browser must call same-origin Next routes under:

```text
/v2/actions/...
```

Next route handlers verify the Supabase session and may call Fastify with server-only headers.

Never expose these values in client code or browser bundles:

- `V2_USER_ID` or `DEV_USER_ID`;
- `x-yadraw-user-id`;
- `x-yadraw-internal-secret`;
- `INTERNAL_API_SECRET`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- database URLs;
- S3 or MinIO credentials.

`NEXT_PUBLIC_SUPABASE_URL` and the Supabase publishable key are intentionally public. Do not treat a service-role key as publishable.

All state-changing browser routes must remain protected by same-origin checks in `apps/web/middleware.ts`.

### Authorization boundary

Frontend visibility is UX only. Fastify service methods must authorize every protected operation against workspace membership.

Current access levels:

- `read`: owner, admin, editor, viewer, service;
- `write`: owner, admin, editor, service;
- `manage`: owner, admin, service.

Never authorize access only because a resource UUID is difficult to guess.

### Product UI language

Use English for hardcoded product UI labels, messages, placeholders, section titles, and warnings.

Do not add Russian UI strings unless the task explicitly requests localization. English/Russian documentation is allowed.

### Automatic saving

Editor changes save automatically.

- Do not add Save or Cancel buttons to card, connection, type, or visual editors.
- Use the existing debounced autosave patterns.
- Show progress only while saving and show concise actionable errors.
- Closing an editor must flush valid pending changes.
- Do not open an editor during selection-only interactions.

### Card data boundary

`card.data` contains user/business JSON only.

Never store these values in `card.data`:

- files or attachment metadata;
- storage paths;
- connections;
- visual style or size;
- semantic ports or connector slot positions;
- card type metadata;
- auth, user, or workspace IDs;
- undo/clipboard/system state.

### Attachment boundary

Binary files live in MinIO/S3. Metadata and relations live in PostgreSQL:

- `files` stores file metadata;
- `card_files` relates files to cards;
- `connection_files` relates files to connections.

Rules:

- Maximum upload size is 25 MB unless an explicit task changes the product limit.
- Browser uploads and downloads go through same-origin proxy routes.
- Do not copy physical files or attachment relations when duplicating cards or boards unless explicitly required.
- Board JSON export is metadata-only for attachments.
- If object upload succeeds but DB insertion fails, delete the orphan object.
- Do not render uploaded HTML as active content.

### Visual style boundary

Presentation is separate from semantic data.

Use `visualStyle`, `size`, positions, waypoints, and label positions for presentation. Do not put them in semantic JSON data.

- Card background color belongs to the card type.
- Connector slots are presentation mappings for existing semantic ports.
- Visual edit mode must not create, remove, or rename semantic ports.

### Ports and connections

Ports are semantic card-type interfaces. Do not create, delete, rename, or change their direction unless the task explicitly concerns port semantics.

Connections must remain attached to the same port keys during ordinary card movement and visual editing.

Manual connector invariants:

- moving both endpoint cards together moves all waypoints and the label by the same delta;
- automatic routes stay automatic after group movement;
- moving a connector label may adjust label position but must not mutate card positions;
- connector endpoints touch the outside edge of port circles.

Do not copy or mutate connections unless explicitly requested. Board duplication is the existing exception: it copies connections whose endpoint cards are copied, but not files.

### Editor interaction invariants

- Single click selects cards and connections.
- Ctrl/Cmd+click toggles cards in multi-selection.
- Dragging empty canvas creates a selection rectangle.
- Double click opens card or connection editing.
- Double click on a connector segment adds a waypoint while editing.
- Double click on a waypoint removes that waypoint.
- Delete, clipboard, undo, and redo commands must not run inside inputs, textareas, selects, contenteditable elements, or dialogs.

### Database and migrations

- Add a V2 migration only when a task requires a schema change.
- Migrations are immutable after deployment; create a new numbered migration instead of editing an applied file.
- Migrations must be idempotent because CI applies them twice.
- Do not run destructive DB commands.
- Do not run the V1-to-V2 migration unless explicitly instructed.
- Preserve parameterized SQL and board/workspace ownership constraints.

### Security baseline

Preserve:

- server-side Supabase session verification;
- same-origin mutation checks;
- timing-safe internal API secret validation;
- CORS allowlist;
- API rate limits;
- multipart and body-size limits;
- security headers and CSP;
- private object storage;
- safe `Content-Disposition` filenames;
- Zod validation at API boundaries.

Avoid `dangerouslySetInnerHTML`, `eval`, dynamic script URLs, unvalidated redirects, and secrets in logs.

## Files to avoid unless required

Do not modify these without a direct task requirement:

- legacy UI, repository, and adapters;
- `.github/workflows/deploy.yml`;
- production auth/runtime configuration;
- existing applied migrations;
- shared schemas for a web-only visual change;
- backup and deployment scripts.

## Work style

- Read the affected implementation before choosing an approach.
- Keep changes task-scoped and preserve existing ownership boundaries.
- Prefer current helpers, schemas, and UI patterns over new abstractions.
- Do not add dependencies unless the change clearly requires one.
- Do not refactor unrelated code.
- Keep hardcoded UI copy concise.
- Preserve user-created and untracked files.
- Never revert changes you did not make.

## Git workflow

Start by checking current state:

```bash
git fetch origin main
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

Do not use `git reset --hard` in a dirty worktree. Do not discard untracked files or user changes.

If the worktree is clean and behind `origin/main`, fast-forward safely. If it is dirty, work with the existing changes or ask only when they make the task impossible.

Commit only task-related files. User planning files and unrelated changes must remain unstaged.

Pushing `main` starts the production workflow. After a production-intended push, wait for quality, deploy, and smoke jobs to finish. Do not claim deployment succeeded until the workflow is green.

## Testing policy

Run checks only for affected workspaces during development. The user performs detailed manual UI acceptance, so provide a short, concrete checklist instead of spending time on broad browser automation unless explicitly requested.

### Web-only changes

```bash
npm run typecheck --workspace @yadraw/web
npm run build --workspace @yadraw/web
git diff --check
```

### API changes

```bash
npm run typecheck --workspace @yadraw/api
npm run test --workspace @yadraw/api
npm run build --workspace @yadraw/api
git diff --check
```

### Shared changes

```bash
npm run typecheck --workspace @yadraw/shared
npm run test --workspace @yadraw/shared
git diff --check
```

### Database changes

Run PostgreSQL integration tests and apply migrations twice against a disposable/test database. Never test destructive migration behavior against production.

### Browser bundle secret scan

After a web production build:

```bash
grep -R -E "V2_USER_ID|DEV_USER_ID|x-yadraw-user-id|x-yadraw-internal-secret|INTERNAL_API_SECRET|S3_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY" apps/web/.next/static || true
```

Expected result: no matches.

## Manual verification checklist format

Keep manual checks focused on changed behavior. For editor work, include only relevant states such as:

- single and multi-selection;
- autosave followed by reload;
- automatic and manual connector movement;
- keyboard behavior inside and outside inputs;
- desktop and narrow viewport layout;
- authorized and unauthorized resource access when security is affected.

## Completion report

Report:

- commit hash when a commit was created;
- changed files or logical file groups;
- implemented behavior;
- automated checks and results;
- manual verification performed or delegated;
- deployment workflow result when pushed;
- relevant boundary confirmations:
  - legacy untouched;
  - `card.data` boundary preserved;
  - browser secrets not exposed;
  - attachment boundary preserved;
  - port and connection semantics preserved.

Be explicit about anything not tested or not verified. Never claim that a beta application has no bugs.
