# Yadraw V2: keyboard commands, clipboard, and history

Status: pending after task 07 stage 1; normally run after all of task 07.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Goal and ownership

Build one editor command layer for Delete, Copy/Paste/Cut, Undo/Redo, then extend it to selected subgraphs. Reuse task 07's selection model and audit; do not create a second selection state.

This task owns global canvas shortcuts. A command must not run from `input`, `textarea`, `select`, `contenteditable`, text-editing roles, inspector/manager forms, or a modal that owns the key. Reuse one helper such as `isEditableShortcutTarget`, ignore `event.defaultPrevented`, and call `preventDefault()` only after a command is actually accepted.

Clipboard/history/selection metadata stays in session memory, never in `card.data`, connection data, schemas, linked fields, or attachments.

## Pre-flight within stage 1

Using task 07 findings, inspect only remaining gaps: current delete/create/update routes, optimistic/error behavior, safe copy fields, ID remapping, restore feasibility, and shortcut listener placement. Continue into stage 1; stop only if deletion has no authoritative API path.

Define the command boundary now so later history does not require rewriting shortcuts:

```ts
type V2EditorCommand = {
  label: string;
  execute(): Promise<void>;
  undo?: () => Promise<void>;
};
```

Commands without a safe `undo` execute normally but are not added to history.

## Stage 1: guarded Delete

- selected card or connector + `Delete` uses its existing same-origin delete path;
- nothing selected or editable/dialog-owned target is a no-op;
- clear selection and close its inspector only after success;
- keep selection and show a non-destructive error on failure;
- support `Backspace` only when canvas focus makes browser-navigation prevention unambiguous;
- preserve existing backend cascade/restrict semantics; do not invent client-only deletion.

Tests: guard behavior, no selection, card/connector success, and failure state.

Commit: `Add guarded V2 delete command`

## Stage 2: card Copy/Paste/Cut

Copy selected cards into a versioned internal payload:

```ts
type V2ClipboardPayload = {
  type: "yadraw/v2-selection";
  version: 1;
  cards: Array<{
    localKey: string;
    cardTypeId: string;
    title: string;
    description: string | null;
    data: Record<string, unknown>;
    size: { width: number; height: number };
    visualStyle: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  connections: [];
};
```

Exclude persistent IDs, timestamps, attachments/files, linked bindings, and editor metadata.

- `Ctrl/Cmd+C`: copy selected cards to an in-memory ref/state; system clipboard JSON is optional enhancement only;
- `Ctrl/Cmd+V`: create cards through same-origin APIs, preserve relative layout, apply one consistent offset, then select pasted cards;
- `Ctrl/Cmd+X`: copy, then run the authoritative delete command; do not delete if copying fails;
- partial paste failure must report created/failed items and must not silently duplicate on retry.

Do not copy connections in this stage.

Tests: excluded fields, relative layout/offset, selection after paste, cut ordering, and partial errors.

Commit: `Add V2 card clipboard commands`

## Stage 3: session undo/redo

Add session-local undo/redo stacks around the command boundary:

- new successful undoable command clears redo;
- undo moves a command to redo only after successful reversal;
- redo re-executes and returns it to undo;
- `Ctrl/Cmd+Z` undoes; `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` redo;
- never fake server restoration from local state.

Initial safe coverage:

- paste: undo deletes the newly created cards; redo recreates them with newly tracked IDs;
- move/resize/update: include only where previous values and server update paths are already reliable;
- delete: include only if an authoritative restore/recreate operation preserves required semantics; otherwise deletion remains non-undoable and is reported.

A multi-card paste/delete is one compound history entry.

Tests: stack transitions, redo clearing, failed undo behavior, and guards in text inputs/modals.

Commit: `Add V2 editor undo redo history`

## Stage 4: selected subgraph clipboard

Extend the same payload with connections whose two endpoint cards are selected. Exclude external connections, files, and linked bindings.

Store local endpoint keys, source/target handles, title/description/data, visual style, and connection type. On paste:

1. create all cards;
2. map local keys to new card IDs;
3. validate copied handles on the new cards;
4. create valid internal connections;
5. warn and skip any connection with a missing handle;
6. select pasted cards and record one compound history command.

Never attach a skipped connection to a fallback handle.

Tests: internal-only filtering, ID remap, handle validation, and compound undo.

Commit: `Add V2 subgraph clipboard paste`

## Acceptance and report additions

Verify shortcuts on canvas and inside every editor form, multi-card layout, cut failure behavior, undo/redo boundaries, and subgraph handle remapping. Report supported and intentionally non-undoable operations, clipboard exclusions, partial-failure behavior, and shortcut ownership.
