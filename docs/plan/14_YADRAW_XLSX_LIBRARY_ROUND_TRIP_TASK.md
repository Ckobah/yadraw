# Yadraw V2: safe XLSX library round trip

Status: implemented; pending production release and manual acceptance. This is the spreadsheet-first follow-up to the released transactional CSV import.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Customer job and release unit

Users should be able to populate and maintain a card library in the spreadsheet format they already use:

1. Download an `.xlsx` workbook containing the current library.
2. Edit existing rows, add rows, and add explicitly confirmed field columns in Excel or a compatible editor.
3. Preview the exact schema and record changes in Yadraw.
4. Commit the whole batch atomically.
5. Receive a synchronized workbook containing server-assigned IDs and current versions.

This is one independently deployable shared/API/web slice. CSV import remains available for generic tables.

## Workbook contract

- `Library` is the editable sheet. Row 1 contains human-readable headers and data starts on row 2. Stable column identity is carried by workbook-defined names, so filters and sorting never include a hidden technical row.
- Existing schema fields, `Name`, `Description`, and `Archived` are visible. `_Yadraw Entry ID` and `_Yadraw Version` are hidden technical columns.
- `_Yadraw` is a very-hidden metadata sheet containing format version, workspace ID, card-type ID, export time, and schema fingerprint.
- `Instructions` is visible and explains the safe round-trip rules, supported types, limits, and non-deletion behavior.
- Existing rows carry entry ID and optimistic version. A row with a blank ID creates a new library entry; the user never invents an ID.
- Removing a row does not delete or archive a library entry. Removing a schema-field column does not delete that field.
- New columns have no stable token. They become proposed optional fields and require explicit type confirmation before commit.
- Existing named columns survive header edits and normal spreadsheet column insertion/reordering. Renaming a header does not silently rename an existing schema field.
- Formula cells, macros, external links, duplicate/unknown IDs, duplicate technical tokens, and workbooks exported from another workspace or card type are rejected.

## Supported field behavior

- Existing fields preserve their stable keys and configured types.
- New fields default to optional and are appended in workbook order.
- The UI offers text, number, boolean, date, select, and JSON for each new column. Select options are derived from the workbook's distinct values and bounded by the server.
- Title is required. Empty optional cells clear the corresponding included field. Required fields must remain valid.
- Missing existing field columns preserve their current values during row updates.
- `Archived` accepts yes/no, true/false, and 1/0. Clearing it preserves the existing state; new rows default to active.
- Editing an existing library entry intentionally updates every linked card that resolves from that entry.

## API and atomicity

Add stateless endpoints scoped to one existing non-container card type. Export requires read access; preview and commit require write access:

```text
POST /v2/workspaces/:workspaceId/card-types/:cardTypeId/library-entries/workbook/export
POST /v2/workspaces/:workspaceId/card-types/:cardTypeId/library-entries/imports/xlsx/preview
POST /v2/workspaces/:workspaceId/card-types/:cardTypeId/library-entries/imports/xlsx/commit
```

The browser uses the existing same-origin library action route. Workbook bytes travel as bounded base64 JSON so authentication and error handling stay inside the established proxy boundary.

Preview reparses the workbook, validates ownership, resolves IDs and versions, proposes new fields, and returns create/update/unchanged/invalid counts plus a fingerprint. Commit repeats every check and, under one repository transaction and card-type lock, adds confirmed schema fields and creates/updates entries. Any invalid row, schema drift, entry version conflict, or preview mismatch rolls back the entire batch.

After commit the server exports the current library again. The response includes this synchronized workbook, ensuring newly created rows now have durable IDs and versions before another import.

## Limits and security

- Maximum uploaded workbook: 5 MiB compressed, 25 MiB declared uncompressed, 1,000 non-empty data rows, 50 editable columns, and 20 newly proposed fields.
- Preflight the ZIP central directory before parsing to reject encrypted entries, path traversal, unsupported compression, excessive expansion, VBA content, and external workbook links.
- Do not evaluate formulas or persist workbook metadata/content outside ordinary business fields.
- Do not log filenames, cell values, IDs, descriptions, or workbook bytes.
- Export uses no formulas, macros, scripts, external links, or active content.
- The import creates library records only. It does not create board cards, attachments, connections, ports, or presentation data.

## UI behavior

- Add `Edit in Excel` beside `Import CSV` in the Library Manager.
- The focused dialog leads with `Download current library`, then accepts one `.xlsx` file.
- Preview clearly distinguishes record creates, updates, unchanged rows, and new schema fields.
- Every new column shows its proposed field key and requires an explicit type choice/confirmation. The UI warns that a new field changes this card type across the workspace.
- Commit remains disabled until preview is current and clean.
- Success refreshes the library, automatically downloads the synchronized workbook, and keeps a manual download button available.
- Pending state prevents duplicate submissions; focus trap, Escape, labels, status regions, and narrow layouts match the existing CSV dialog.

## Focused verification

- Shared strict schemas and API contracts for export, preview, field confirmation, commit, and synchronized workbook response.
- Workbook unit tests for hidden metadata, stable tokens, typed values, new-field inference, formula/foreign-workbook rejection, duplicate/unknown IDs, row and ZIP limits.
- Memory service tests for authorization, create/update/unchanged behavior, schema additions, linked-record semantics, preview conflicts, and all-or-nothing failure.
- PostgreSQL integration test for one-transaction schema plus entry updates and optimistic-version rollback.
- Shared/API/web typechecks, tests, production builds, diff checks, and browser-bundle secret scan.

## Manual production checklist

- Download a library containing text, number, boolean, date, select, JSON, active, and archived records; verify layout in Excel and LibreOffice.
- Edit an existing row, add a row, add one field column, preview, commit, reload, and verify linked cards reflect canonical changes.
- Re-upload the synchronized workbook and verify no duplicate records are created.
- Delete a workbook row and a field column; verify neither server record nor schema field is deleted.
- Try copied duplicate IDs, stale versions, a workbook from another type, invalid typed values, formulas, oversized input, and commit after a concurrent edit.
- Verify keyboard/Escape, retry, desktop, and narrow viewport behavior.

## Boundaries and rollback

No DB migration is required. Existing library entries, cards, CSV import, attachments, connections, ports, visual state, and legacy code remain compatible. Code rollback removes the XLSX endpoints/dialog; imported rows and added schema fields remain ordinary V2 data.

Commit: `Add safe V2 XLSX library round trip`
