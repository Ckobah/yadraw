# Task 05 completion record: safe card type deletion

Status: complete; do not rerun.

Implemented:

- `DELETE /v2/boards/:boardId/card-types/:cardTypeId` with same-origin Next proxy and browser helper;
- repository-level active-card count and transactional Postgres soft delete;
- used types return `409 Conflict` with the authoritative card count;
- missing/already deleted types return `404`;
- Card Type Manager shows a confirmed destructive action only for saved types;
- successful deletion removes the type from manager and card picker state without reload.

Cards, `card.data`, linked fields, files, attachments, connections, other type schemas, and type ports are not mutated.

Commit: `f53c29d`.
