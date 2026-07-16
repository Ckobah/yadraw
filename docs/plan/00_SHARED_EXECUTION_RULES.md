# Yadraw V2 shared execution rules for plan tasks

Use this file with every numbered task in this folder. Numbered task files should contain only task-specific scope, behavior, files, tests, and report additions.

## Queue and status

Execute numbered tasks in order unless the user explicitly changes the order.

| Task | Status | Next action |
| --- | --- | --- |
| 01-07 | Complete | Do not rerun; inspect their implementation only when a later task depends on it. |
| 08-10 | Pending | Start with 08. Within a task, execute one implementation stage/PR at a time unless the user explicitly requests several. |

An audit listed inside a task is pre-flight for its first implementation stage, not a separate Codex run, commit, or PR. Stop after the audit only when it reveals a schema migration, unresolved product decision, or unsafe architectural mismatch.

## Start state

Follow `AGENTS.md`, with this safety clarification:

- Start from latest `origin/main` in a clean/disposable worktree.
- Before destructive cleanup, run `git status -sb`.
- Do not run `git reset --hard` if there are user/local changes that would be lost. Stop and report the dirty state instead.
- Leave unrelated untracked files untouched.

Recommended pre-flight:

```bash
git fetch origin main
git status -sb
git rev-parse HEAD
```

If the worktree is confirmed disposable/clean:

```bash
git reset --hard origin/main
git status -sb
git rev-parse HEAD
```

## Global boundaries

Work on strict V2 only unless a task explicitly says otherwise.

Do not touch:

- legacy BoardEditor, legacy adapter, or V1 runtime;
- DB migrations unless the task explicitly asks for schema changes;
- production deploy workflows;
- unrelated shared schemas, auth/runtime config, files/attachments, linked fields, or dry-run/AI behavior.

Browser/client code must not expose:

- `V2_USER_ID`;
- `x-yadraw-user-id`;
- database URLs;
- S3/MinIO credentials;
- `OPENAI_API_KEY` or provider keys.

Browser code must call same-origin Next proxy routes under `/v2/actions/...`.

Do not store editor/system metadata in `card.data`. Keep `card.data` for user/business JSON only.

Do not mutate ports, connector semantics, connection source/target IDs, or handle IDs unless the task explicitly requires it.

Cross-task ownership:

- `06` owns port labels but never technical handle IDs;
- `07` owns board selection and group movement;
- `08` owns editor commands, clipboard, history, and global shortcut guards;
- `09` owns identity, sessions, workspaces, dashboard, and onboarding;
- `10` owns attachment counts, attachment UI/cache, and document preview;
- modal shortcuts from `10` take precedence while its preview dialog is open; `08` must ignore handled events and editable/dialog-owned interactions;
- `09` must preserve attachment authorization routes; `10` must consume the authenticated same-origin routes produced by `09`, not modify the auth model.

Use English for hardcoded product UI labels, messages, placeholders, warnings, and section titles.

## Checks

Run only checks for touched workspaces.

Web:

```bash
npm run typecheck --workspace @yadraw/web
npm run build --workspace @yadraw/web
git diff --check
git diff --cached --check
```

API:

```bash
npm run typecheck --workspace @yadraw/api
npm run test --workspace @yadraw/api
npm run build --workspace @yadraw/api
git diff --check
git diff --cached --check
```

Shared:

```bash
npm run typecheck --workspace @yadraw/shared
npm run test --workspace @yadraw/shared
git diff --check
git diff --cached --check
```

After any web build, run browser-secret grep:

```bash
grep -R "V2_USER_ID" apps/web/.next/static || true
grep -R "x-yadraw-user-id" apps/web/.next/static || true
grep -R "S3_SECRET_ACCESS_KEY" apps/web/.next/static || true
grep -R "OPENAI_API_KEY" apps/web/.next/static || true
```

Expected result: no matches.

## Commit and push

Audit-only tasks:

- do not code;
- do not commit;
- do not push.

Implementation tasks:

- commit only task-scoped changes;
- push only after requested checks pass;
- use the task file commit message unless the actual change makes a clearer message necessary.

Do not create a separate commit for an audit, scaffolding that has no user-visible or architectural value, or an optional polish stage with no observed defect.

## Final report baseline

Report:

1. Commit hash or audited HEAD.
2. Push status, if applicable.
3. Changed files or inspected files.
4. What was implemented or audited.
5. Checks run and results.
6. Bundle grep results, if web build ran.
7. Known blockers.
8. Manual verification status. Default: manual UI verification not performed by agent; ready for user server-side verification after push.
9. Boundary confirmations:
   - legacy untouched;
   - V1 untouched;
   - no DB schema changes or migrations unless explicitly required;
   - `card.data` untouched unless the task explicitly edits user/business fields;
   - linked fields untouched unless explicitly in scope;
   - files/attachments untouched unless explicitly in scope;
   - connections/ports semantics unchanged unless explicitly in scope;
   - browser secrets not exposed.
