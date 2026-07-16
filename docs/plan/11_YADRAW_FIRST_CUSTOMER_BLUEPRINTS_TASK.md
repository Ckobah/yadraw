# Yadraw V2: first-customer blueprints and useful empty states

Status: implemented locally; automated checks complete, manual/prospect validation pending. This is a deployable slice of first-customer-fit roadmap stage 1 and does not change the scope or status of tasks 08-10.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Observed customer problem and validation cohort

The First Customer Finder evidence points to individual process/data/solution architects, technical consultants, and knowledge modelers who need structured cards and meaningful relationships but cannot justify configuring a blank modeling system before seeing value. The validation cohort is the three evidence-backed prospects selected for problem interviews; the release gate remains two prospects explaining the difference between a Yadraw card and a whiteboard shape without prompting.

## Current-code audit and ownership boundaries

- The dashboard creates blank boards through the authenticated same-origin `/v2/actions/workspaces/:workspaceId/boards` proxy.
- Fastify authorizes workspace writes before repository board creation.
- PostgreSQL already uses transactions for board creation, duplication, and first-login demo copying.
- Card types and connection types are workspace-scoped; blueprint v1 types must be reusable without copying attachments, users, memberships, or persistent source IDs.
- The canvas empty state is presentation-only and may request a new blueprint board or open the existing card picker. It must not write onboarding state into `card.data`.
- Task 09 continues to own authentication/session boundaries; this task consumes them without changing identity or roles.

## API and persistence decision

Extend the existing create-board body with an optional versioned server-controlled blueprint key:

```ts
type V2BoardBlueprintKey = "process_map_v1" | "typed_knowledge_graph_v1";
type V2CreateBoardRequest = { name: string; blueprint?: V2BoardBlueprintKey };
```

The client sends only the key and board name. Blueprint definitions live in API code and contain card types, semantic ports, relationship types, example cards, connections, and layout. A repository transaction creates or reuses the versioned workspace types, ensures required ports, then creates the board graph. Any failure rolls back the board and newly inserted graph records. No migration or template database is added.

## User-visible behavior, errors, and accessibility

- Dashboard New board presents Process Map, Typed Knowledge Graph, and Blank choices with concise descriptions and an editable board name.
- A successful request opens the created board. Pending state disables duplicate submissions; server errors remain retryable and preserve the selected choice/name.
- The no-boards dashboard state shows the same creation choices instead of a dead-end message.
- An empty board offers both blueprint choices plus Start blank, which opens the existing card picker on that board.
- Choice controls use real buttons/radios, visible focus, English labels, status text, and a single live error region. Layout must work at narrow widths.

## Backward compatibility and rollback

- `{ name }` continues to create a blank board exactly as before.
- Existing card/connection types and records are not rewritten or deleted.
- Existing port keys, endpoint IDs, handles, waypoints, and label positions are untouched.
- Blueprint cards contain only declared business fields; no attachments, auth data, workspace IDs, or onboarding metadata enter `card.data`.
- Rollback is code-only: stop sending blueprint keys and remove the optional repository path. Already created boards remain ordinary V2 boards.

## Focused tests and checks

- Shared schema accepts both blueprint keys, rejects unknown/extra values, and preserves blank creation.
- Service authorizes the workspace before blueprint creation, rejects viewer/foreign writes, and never trusts client blueprint content.
- PostgreSQL integration test verifies a complete connected board, reusable types, reload persistence, zero attachment relations, and transaction-backed creation.
- Web typecheck/build covers dashboard and empty-board states.
- Run affected shared/API checks, web production build, `git diff --check`, and the browser-bundle secret scan from `AGENTS.md`.

## Manual verification checklist

- Dashboard: each blueprint and blank board, pending/error/retry, keyboard focus, narrow viewport.
- Board reload: example cards, typed relationships, fields, and layout persist.
- Empty board: Start blank opens card picker; blueprint choices create a separate populated board.
- Authorization: viewer creation rejected; foreign workspace not disclosed.
- Existing container cards, autosave, selection, and connection editing remain functional.

## Release, measurement, and validation gate

Release as a standalone stacked PR after the public landing slice. Do not add analytics content payloads. Measure time-to-useful-board manually with the validation cohort; continue contextual onboarding only after confirming that at least two prospects understand structured cards and typed relationships without prompting.

Commit: `Add V2 first-customer blueprints`
