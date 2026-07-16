# Yadraw V2: contextual board onboarding

Status: implemented locally; automated web checks complete, production and manual/prospect validation pending. This is the next deployable slice of first-customer-fit roadmap stage 1.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Observed customer problem and validation cohort

The first-customer cohort can open a populated blueprint but still needs to discover the first meaningful actions without documentation: create a card on a blank board, connect typed ports, open a card inspector, edit structured fields, and export the result. The guide must help process/data/solution architects and technical consultants without covering the canvas with a generic product tour.

## Current-code audit and ownership boundaries

- Blank-board creation already opens the card picker, but `V2BoardPage` keeps server-rendered counts after client-side card/connection creation. This can leave the empty state and header counts stale until reload.
- Card creation, connection creation, card data autosave, and inspector state are owned by `V2BoardCanvas`.
- Lossless JSON export already exists at the authenticated same-origin `/v2/actions/boards/:boardId/export` route. This slice only exposes that existing action inside the board.
- Board-wide search/filter is not implemented. A filter hint would point to no product surface and would mix roadmap stage 3A into stage 1, so it is deferred until the filter UI exists.
- Onboarding progress is presentation state. It must not enter `card.data`, board data, auth data, analytics, or server logs.

## API and persistence decision

No API, shared schema, database entity, or migration is added. The board reports current client-side card/connection counts and successful card-data saves to its page shell. A single browser-local onboarding component stores only boolean completion/dismissal flags in `localStorage`, guarded for unavailable or malformed storage. It does not include a board, workspace, or user identifier, so the guide does not repeat automatically on every board.

The guide never stores card titles, field values, relationship data, filenames, search terms, user IDs, or workspace IDs. Existing server authorization and same-origin export behavior remain unchanged.

## User-visible behavior, errors, and accessibility

- Header card/connection counts update immediately after successful client mutations.
- The blank-board chooser disappears after the first successful card creation without requiring reload.
- A compact `Getting started` checklist covers card creation, typed connection creation, structured field editing, and JSON export.
- Existing board content completes the card/connection steps automatically. A successful card-data autosave completes the field step; choosing export completes the export step.
- `Guide` reopens a dismissed/completed checklist. `Export JSON` remains directly available in the board header.
- The guide uses semantic buttons/list markup, visible focus, an accessible progress label, concise English copy, reduced-motion-safe styling, and a narrow-viewport layout.
- The guide is suspended while an inspector or manager is open so it does not obscure editing.

## Backward compatibility and rollback

- Existing boards and blueprints are not mutated.
- Card/connection creation and autosave handlers keep their current API inputs and rollback behavior.
- Ports, endpoint IDs, relationship types, waypoints, labels, attachments, and visual styles are untouched.
- Removing the onboarding component and callbacks is a code-only rollback; local boolean state becomes inert.

## Focused tests and checks

- Web typecheck and production build.
- Full production browser-bundle secret scan from `AGENTS.md`.
- `git diff --check` and `git log --check`.
- Production quality/deploy/smoke workflow before reporting release completion.

## Manual verification checklist

- Blank board: Start blank, place the first card, and verify the empty chooser disappears and the count becomes `1 card`.
- One-card board: guide explains typed port connection; creating a connection updates the count and advances the checklist.
- Populated blueprint: guide starts at structured field editing; opening a card hides the guide, autosave then advances it.
- Export: both guide action and header action download the existing metadata-only JSON export.
- Dismiss and reopen Guide; reload and verify only boolean progress persists in that browser.
- Desktop and narrow viewport; keyboard focus and screen-reader labels.

## Release, measurement, and validation gate

Release as one web-only PR. Measure whether prospects can find field editing and export without verbal directions. Do not add analytics payloads. Filter onboarding is released with stage 3A rather than advertised early.

Commit: `Add contextual V2 board onboarding`
