# Yadraw V2 Foundation

## Purpose

Yadraw v2 starts as a small, reliable visual workspace for structured cards and typed connections.

The goal is not to rebuild every idea from the current prototype. The goal is to create a professional product foundation where the domain model, persistence, API, and UI can evolve without demo-specific shortcuts.

## Product Scope

The first version of v2 supports one complete workflow:

1. Open a workspace.
2. Open a project.
3. Open a board.
4. Create a card from a card type.
5. Edit the card title, description, position, and structured JSON data.
6. Create and delete typed connections between cards.
7. Persist all changes in PostgreSQL.
8. Reload the app and recover the same board state.

This is the minimum useful product surface. Anything outside this workflow is deferred unless it is required to make the workflow reliable.

## Core Entities

### Workspace

A workspace is the top-level ownership and access boundary.

Required fields:

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

### Project

A project groups related boards inside a workspace.

Required fields:

- `id`
- `workspace_id`
- `name`
- `created_at`
- `updated_at`

### Board

A board is a visual workspace containing cards and connections.

Required fields:

- `id`
- `workspace_id`
- `project_id`
- `name`
- `viewport`
- `created_at`
- `updated_at`

### Card Type

A card type defines what kind of card can be created.

Required fields:

- `id`
- `workspace_id`
- `key`
- `name`
- `description`
- `default_data`
- `default_size`
- `ports`
- `created_at`
- `updated_at`

### Card

A card is a board object with visual placement and structured data.

Required fields:

- `id`
- `workspace_id`
- `board_id`
- `card_type_id`
- `title`
- `description`
- `data`
- `position`
- `size`
- `status`
- `created_at`
- `updated_at`

Card data must remain user/domain data. Internal app metadata must not be hidden inside `card.data`.

### Connection

A connection links two cards through typed source and target ports.

Required fields:

- `id`
- `workspace_id`
- `board_id`
- `source_card_id`
- `target_card_id`
- `source_port_key`
- `target_port_key`
- `type`
- `label`
- `created_at`
- `updated_at`

## Technical Scope

### Backend

The v2 backend should provide:

- explicit domain schemas
- request and response validation
- PostgreSQL persistence
- repository/service separation
- deterministic seed data for local development
- focused tests for the core workflow

The API should expose only the operations required by the first vertical slice.

### Frontend

The v2 frontend should provide:

- board loading and error states
- a usable canvas
- card creation from a type
- card selection
- a focused inspector for card fields and JSON data
- connection creation and deletion
- save feedback for persisted changes

UI structure should be split by responsibility. The board surface, inspector, API client, state management, and dialogs must not live in one large component.

### Data Model

The database is the source of truth. React state should mirror persisted domain entities, not define them.

Allowed JSON fields:

- user-owned card `data`
- board `viewport`
- type-level `default_data`
- type-level `ports` if the structure remains validated

Disallowed v2 pattern:

- storing app-owned metadata in `card.data._yadraw`

## Non-Goals

The following are intentionally out of scope for the first v2 foundation:

- AI assistant
- embeddings
- semantic search
- file upload and object storage
- notifications
- sharing UI
- real-time collaboration
- Yjs or multiplayer editing
- workflow execution engine
- automations
- audit/activity timeline
- advanced permissions UI
- public landing page
- dashboards
- templates marketplace
- import/export
- mobile editing experience
- highly polished visual theme

These features may return later, but only after the core board/card/connection workflow is stable.

## Quality Bar

The v2 foundation is acceptable when:

- the core workflow works against PostgreSQL
- a page reload preserves board state
- card and connection operations have tests
- invalid API payloads fail predictably
- the frontend has clear loading, empty, and error states
- the code is split into small modules with obvious ownership
- demo data is isolated from reusable domain code
- no production behavior depends on hardcoded demo IDs

## First Milestone

Milestone 1 is complete when a developer can run the app locally, open one seeded board, create two cards, connect them, edit one card's JSON data, reload the browser, and see the same result persisted from PostgreSQL.

