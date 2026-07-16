# Yadraw V2: authentication, personal workspaces, and dashboard

Status: pending after task 08. The earlier auth audit is treated as completed pre-work; implementation starts with PR 2.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`. Execute one PR at a time. PR 4-7 are a rollout train: do not enable or deploy session-required board access in production until onboarding provides the signed-in user an accessible workspace/board.

## Goal and target flow

Replace the fixed demo identity with:

```text
browser session
-> Next server resolves verified auth user
-> same-origin /v2/actions proxy adds x-yadraw-user-id server-side
-> API authorizes workspace membership and role
-> personal dashboard and boards
```

MVP roles:

- owner/admin/editor: read and write;
- viewer: read only;
- service: API-only and outside UI scope.

Identity, permissions, workspace IDs, and auth metadata never enter `card.data` or client-provided identity headers.

## Product decisions required before PR 3

Confirm these once; later PRs must not reopen them:

1. provider: Supabase Auth (recommended) or Auth.js;
2. login methods: magic link, provider-hosted password, OAuth, or combination;
3. logged-out root: login (recommended) or separately scoped public demo;
4. first login: automatic demo copy (recommended) or explicit choice;
5. initial product: personal workspace only (recommended) or teams/invites now.

The remaining instructions assume the recommended choices. If any choice differs, update this file before PR 3. Never implement custom password storage.

## PR 2: database identity foundation

Add one additive V2 migration after inspecting the latest migration number and current seed.

Schema:

- `users`: UUID `id`, unique non-empty email, name, optional avatar URL, provider, provider subject, timestamps, soft delete, and unique `(auth_provider, auth_subject)`;
- `workspaces.owner_user_id`: FK to users; add nullable, backfill, then make non-null only when existing data permits;
- `workspace_members.user_id`: FK to users after every existing demo/member ID has a user row;
- defer `boards.created_by_user_id` unless an existing contract already needs it.

For the Supabase MVP, use the provider's UUID as `users.id`; this lets verified Next session code send the internal UUID without a browser round trip or direct web-to-DB mapping. A non-UUID provider subject requires an explicit server-side mapping design before PR 4.

Preserve current fixed-user runtime and `authorizeWorkspace`. Add only repository/shared user models required by subsequent work.

Tests:

- migration/backfill works on current seed IDs;
- membership FK is valid;
- owner/editor/viewer authorization remains correct;
- non-member is denied;
- old fixed-user runtime still works.

Likely scope: V2 DB migration/seed, shared V2 contracts if needed, API repository/service/tests. This PR explicitly authorizes the migration and no other schema work.

Commit: `Add V2 users and workspace ownership schema`

Report the migration number, backfill, nullability decision, and any deferred audit field.

## PR 3: provider integration without board cutover

After the product decision, integrate the provider only in Next.js. For Supabase, verify the current official SSR package/API before installing the minimum dependency.

Add:

- server and browser provider clients with strict server/client module boundaries;
- `/login`, auth callback, and logout;
- session retrieval helper;
- documented environment variables with server-only keys clearly separated;
- a protected placeholder or diagnostic server route sufficient to prove session resolution.

Do not yet replace board proxy identity or require session on existing board routes. The demo board must keep its current behavior until the rollout train is complete.

For Supabase, public URL/anon key may be client-visible by design; service-role and signing secrets must remain server-only. After web build, add a task-specific bundle scan for `SUPABASE_SERVICE_ROLE_KEY` (or equivalent provider secret) in addition to the shared scan.

Tests/checks:

- logged-out/login/callback/logout flow compiles and handles missing configuration safely;
- server helper resolves the authenticated provider user;
- browser code cannot import server client/helpers;
- current demo board still opens as before.

Commit: `Add Supabase auth integration` or the provider-equivalent message.

## PR 4: authenticated server user context

Replace `process.env.V2_USER_ID` in Next server-only board fetch/proxy paths with one helper:

```ts
const currentUser = await requireCurrentV2User();
```

For the assumed Supabase model:

- validate the provider session server-side;
- use its UUID as `users.id`;
- upsert allowed profile fields through an authoritative server/API path;
- Next adds `x-yadraw-user-id` only on the server-to-API request;
- action routes return JSON `401`; server pages redirect to `/login?next=...`;
- API continues to authorize membership/role and does not parse provider cookies.

Do not pass user ID in client props, accept it from request bodies/query parameters, import server auth helpers into client code, or bypass `authorizeWorkspace`.

Because a new user may not yet own a board, do not deploy this cutover alone. Land and test it as part of PR 4-7 rollout, or keep the previous production commit active until PR 7.

Tests:

- no session is 401/redirect as appropriate;
- member/non-member/viewer/editor behavior remains authoritative;
- profile upsert is idempotent;
- browser bundle contains neither fixed/user headers nor provider service secrets.

Commit: `Use authenticated session for V2 server user context`

Report every remaining `V2_USER_ID` use and justify any temporary server-only compatibility use.

## PR 5: dashboard APIs and same-origin proxies

Add only:

```http
GET  /v2/workspaces
GET  /v2/workspaces/:workspaceId/boards
POST /v2/workspaces/:workspaceId/boards
```

Behavior:

- list active memberships and include role;
- list active boards sorted by `updated_at desc`;
- create a named board for owner/editor, deny viewer/non-member;
- create the required default project only if current schema requires `project_id`;
- do not create cards or duplicate the demo here.

Add compact shared summaries/request/response schemas only when route validation needs them. Browser helpers call corresponding `/v2/actions/workspaces...` routes, which use PR 4's server session helper.

Tests cover workspace filtering, access levels, sorting, creation ownership/project requirements, and no leaked identity header.

Commit: `Add V2 dashboard workspace and board APIs`

## PR 6: personal dashboard UI

Add `/v2/dashboard` and change root behavior only after PR 4/5 are available.

- authenticated root -> dashboard;
- unauthenticated root -> login, unless the product decision explicitly retained public demo;
- dashboard shows user summary, workspace selector, boards, empty state, and New board;
- board rows show only fields returned by the summary API;
- New board collects a name, creates it through the same-origin proxy, and opens `/v2/boards/:id`;
- use English product labels and existing visual tokens;
- no invites, folders, templates, team management, or board-editor refactor.

A user with no workspace must see a stable onboarding/loading state that PR 7 can resolve, not an error loop.

Tests/checks cover redirects, empty/list states, workspace switching, create error/success, and bundle secrets.

Commit: `Add V2 personal dashboard UI`

## PR 7: idempotent first-login bootstrap

For a verified user with no active workspace membership, create a personal workspace, owner membership, and a private copy of demo board `33333333-3333-4333-8333-333333333333`.

Run the check/copy in an API service/repository transaction. Lock the user row (or use an equivalent existing uniqueness guard), recheck membership inside the transaction, and return the existing result on repeated/concurrent calls.

Copy and remap:

- required project and board;
- card types and type ports;
- cards with semantic data, position, size, visual style, status, and mapped type;
- connections with mapped card IDs and existing handle IDs;
- linked field bindings only when the demo actually uses them and their remap is verified.

Do not copy IDs, timestamps/deletion state, workspace members, physical files, file metadata, or `card_files`. Keep the original demo unchanged and non-editable unless separately authorized.

After success, dashboard may redirect to the copied board. On failure, show retryable onboarding state; never create a second partial copy.

Tests:

- first call creates owner workspace and accessible board;
- cards/types/ports/connections and any verified bindings remap correctly;
- attachment relations/files are absent;
- original demo is unchanged;
- repeated and concurrent calls are idempotent;
- transaction rollback leaves no partial workspace/board.

Commit: `Copy demo board into personal workspace on first login`

## Rollout and final acceptance

Keep the DB migration additive so old fixed-user code can run during rollback. Production backup, environment setup, migration execution, and process restart belong to a separate deployment runbook/approval, not an implementation PR.

Before enabling the rollout:

- provider production redirect URLs and secrets are configured server-side;
- PR 2 migration is backed up and applied;
- PR 3-7 checks pass together;
- logged-out actions return 401;
- own member access works; foreign workspace is 403; viewer writes are 403;
- first login creates exactly one personal workspace/demo copy;
- dashboard creates and opens a blank board;
- logout blocks subsequent board actions;
- foreign attachment download remains denied;
- browser bundle and network expose no server identity header, DB/S3 secret, service-role key, storage path, or direct object-store URL.

Report for each PR only task-specific behavior plus the shared report baseline. Do not repeat the complete architecture in every report.
