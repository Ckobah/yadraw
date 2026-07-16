# Yadraw V2: multi-selection, lasso, and group movement

Status: complete.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Goal and ownership

Add card multi-selection, area selection, group movement, position persistence, and preservation of manual routes for connections internal to a moved group.

This task owns selection and movement. Task 08 owns Delete/Copy/Cut/Paste/Undo/Redo. Selection is session UI state and must never enter persistence, `card.data`, connection data, schemas, or linked fields.

## Pre-flight within stage 1

Inspect the current React Flow selection settings, selected-card/connection state, node construction, pane/drag handlers, visual-edit/slot/waypoint interactions, position save flow, and manual-route model. Reuse findings later in task 08.

Confirm:

- whether React Flow built-in multi-select and selection rectangle meet the required behavior;
- current node-drag persistence and error handling;
- actual `waypoints`, `labelPosition`, and `labelSegmentIndex` representation;
- conflicts with visual edit, ports, labels, connector editing, and form controls.

Continue into stage 1 unless the current state model cannot support a compatibility bridge.

## Stage 1: selection model, Ctrl/Cmd click, and lasso

Preferred state:

```ts
type V2BoardSelection = {
  cardIds: string[];
  connectionIds: string[];
  primaryCardId?: string;
  primaryConnectionId?: string;
};
```

Derive old single-selection values temporarily where existing inspectors require them.

Behavior:

- normal card click selects only that card and opens its inspector;
- `Ctrl/Cmd + click` toggles a card; the last added card becomes primary;
- normal connector click keeps single-connector selection for MVP;
- canvas click clears selection;
- selected cards share the existing selected visual treatment;
- one selected card shows the normal inspector; multiple cards show a concise count plus the primary card, without bulk editing;
- empty-canvas drag creates a selection rectangle and replaces selected cards with cards inside it;
- lasso must not start during visual edit, node/slot/waypoint/label/connector drag, or form interaction.

Prefer React Flow capabilities over a custom overlay when they satisfy these rules. Do not implement keyboard commands or group movement in this stage.

Tests: toggle/add/remove/primary behavior, canvas clear, lasso replacement, and interaction guards where the current test setup permits.

Commit: `Add V2 card multi-selection and lasso`

## Stage 2: group drag and persistence

- dragging a selected card in a multi-selection moves every selected card by the same delta;
- dragging an unselected card first replaces selection, then moves only it;
- connectors remain attached to their existing source/target handles;
- persist every moved position after drag stop through the existing same-origin update path;
- use an existing batch endpoint if present; otherwise reuse existing per-card updates in parallel and report that they are not atomic;
- retain local positions on a save error and show a non-destructive error with retry/reload guidance;
- do not add a new batch API solely as a performance optimization in this task.

Tests: equal group delta, single drag replacement, persistence payload, and unchanged `card.data`/connection identity.

Commit: `Add V2 group card movement`

## Stage 3: internal manual-route translation

For a group drag:

- auto routes: change no connection visual style;
- manual route with both endpoint cards moved: add the group delta to every waypoint;
- move an absolute connection label by the same delta; leave segment-relative labels unchanged;
- connection with only one moved endpoint: leave waypoints unchanged for MVP;
- preserve source/target card IDs, handles, connection data, and external connections;
- save changed connection visual style through the existing API.

If the pre-flight finds a different route representation, implement its equivalent and document it before editing.

Tests: internal manual routes translate once; auto and external routes remain unchanged; identity/handles are stable.

Commit: `Preserve V2 manual routes during group movement`

## Optional follow-up

Only fix observed lasso, pan, dense-selection, or save-performance defects. Do not create a generic polish PR.

## Acceptance and report additions

Manually verify modifier-click on Windows/macOS semantics, lasso, inspector behavior, group drag, reload persistence, and manual/auto/external connectors. Report the selection owner, persistence strategy, manual-route behavior, and any non-atomic save limitation.

## Completion record

- Selection stays in V2 canvas session state and is never persisted.
- Normal click selects one card; Ctrl/Cmd click toggles; empty-canvas drag replaces selection through React Flow lasso.
- Selection does not open the card inspector. Explicit Edit/double-click remains the editing entry point.
- Group drag saves card positions through existing per-card same-origin requests in parallel; these writes are not atomic.
- Internal manual waypoints and absolute labels translate by the exact group delta; auto routes and connections with one moved endpoint keep their visual style.
- Connector paths terminate on the outside boundary of each port; IDs, source/target cards, handle IDs, and connection data remain unchanged.
- Manual routes now translate live during group drag from an immutable drag-start snapshot; persistence applies the same final delta once.
- Connector selection mirrors card selection: single click selects without an inspector, double click opens editing, and dragging the label reroutes the connector while keeping its endpoints on the same ports.
- Top and bottom port labels are offset to the right of their port circles so they do not cover connector endpoints.
