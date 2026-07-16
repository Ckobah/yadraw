# Yadraw V2: transactional CSV library import

Status: in progress. This is the first independently releasable data-ingress slice of the first-customer-fit roadmap.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Observed customer problem and validation cohort

The immediate customer job is fast population of reusable card libraries from an existing spreadsheet. Process/data/solution architects and consultants should import canonical records once, then place linked cards without recreating business data on every board. The validation gate is one prospect importing a real or safely anonymized table into a useful library.

## Current-code audit and ownership boundaries

- `V2CardLibraryManager` already provides schema-backed reusable records with autosave, versioning, archive state, usage counts, and live-linked cards.
- Library reads and writes use same-origin `/v2/actions/...`; Fastify service methods enforce workspace access and card-type ownership.
- Existing field validation supports text, number, boolean, select, date, and JSON.
- Current repository methods mutate one library entry at a time; CSV needs a bounded atomic batch contract.
- Import must not create board cards, connections, attachments, card types, saved views, or import metadata in semantic data.

## API and persistence decision

Add stateless preview and commit endpoints scoped to one existing card type:

```text
POST /v2/workspaces/:workspaceId/card-types/:cardTypeId/library-entries/imports/csv/preview
POST /v2/workspaces/:workspaceId/card-types/:cardTypeId/library-entries/imports/csv/commit
```

Both accept CSV text, explicit column mapping, and duplicate policy. Commit reparses and revalidates the payload and never trusts client counts. Limits: 1 MiB UTF-8, 500 data rows, 50 columns, 120 characters per header, and 10,000 characters per cell.

The parser supports BOM, CRLF/LF, RFC 4180 quoting, escaped quotes, quoted newlines, and deterministic comma/semicolon delimiter detection. Empty trailing rows are ignored. A repository transaction creates and/or updates every entry; any invalid row, ambiguous match, concurrency conflict, or changed preview rolls back the batch. No migration or persistent import entity is added.

Duplicate policy is explicit:

- `create_new`: create every valid row;
- `skip_existing`: skip matching title or mapped schema-field values;
- `update_existing`: update one matched canonical entry and create rows with no match.

For update mode, multiple existing matches or duplicate keys inside the CSV are invalid instead of applying hidden last-write-wins behavior. Updating an in-use entry intentionally live-updates linked cards and is clearly disclosed in preview UI.
Only explicitly mapped columns are changed in update mode. Unmapped description and schema fields are preserved; an empty mapped optional field deliberately clears that field.

## User-visible behavior, errors, and accessibility

- Library Manager exposes `Import CSV` for the selected card type.
- File selection opens a focused import dialog with explicit title/description/schema-field mapping and duplicate policy.
- Preview shows headers, sample values, exact create/update/skip/invalid counts, and row issues before mutation.
- Commit stays disabled until the current mapping has a clean preview with zero invalid rows.
- Pending state prevents duplicate submission. Success refreshes the selected library and reports exact counts.
- The dialog traps focus, closes with Escape, uses semantic labels/table/status regions, and fits narrow viewports.

## Validation and conversion rules

- Title is required and limited to 240 characters; description is limited to 10,000 characters.
- Numbers must be finite; booleans accept case-insensitive true/false, yes/no, and 1/0; dates require real `YYYY-MM-DD`; JSON must parse; select values must match configured values or labels.
- Required schema fields must be mapped and non-empty in every committed row.
- Unknown fields, duplicate targets, ambiguous headers/matches, and extra request keys are rejected.
- JSON fields cannot be duplicate keys in the first version because object equality is not a safe user-facing merge contract.

## Backward compatibility and rollback

- Existing single-entry API, library rows, live links, versions, archive state, and card records remain compatible.
- Imported entry `data` contains only mapped business fields; CSV text, filename, mapping, and import state are not persisted.
- Attachments, boards, cards, connections, ports, and presentation data are untouched.
- Removing the endpoints/dialog is a code-only rollback; imported entries remain ordinary library records.

## Focused tests and checks

- Shared strict request/response schemas and API contracts.
- Parser tests for quoting, Unicode/BOM, limits, supported type coercion, and malformed rows.
- Service/route tests for write authorization, workspace/card-type isolation, preview/commit parity, create/skip/update behavior, and no mutation on invalid input.
- PostgreSQL integration test for transactional batch persistence, versions, and rollback on preview/concurrency mismatch.
- Run shared/API/web checks, production builds, diff checks, and browser bundle secret scan from `AGENTS.md`.

## Manual verification checklist

- Import quoted Unicode CSV into a library containing every supported field type; reload and inspect values.
- Re-import with skip-by-title; verify exact skipped count and no duplicates.
- Re-import with update-by-title; verify existing entries update, missing entries are created, and linked cards show canonical changes.
- Invalid number/date/JSON/select, missing required field/title, ambiguous match: preview explains the row and commit stays disabled.
- Empty/file-too-large/too-many-rows, pending/error/retry, keyboard/Escape, desktop and narrow viewport.

## Release, measurement, and validation gate

Release as one shared/API/web PR. Do not log or analyze CSV contents, filenames, mapped values, or library data. Continue to export after production verification; product validation requires one prospect to populate a real library and reuse at least one imported entry on a board.

Commit: `Add transactional V2 CSV library import`
