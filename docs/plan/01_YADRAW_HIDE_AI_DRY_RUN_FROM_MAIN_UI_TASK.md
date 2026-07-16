# Task 01 completion record: hide AI and Dry-run

Status: complete; do not rerun.

Implemented:

- AI Assistant and Run dry-run are hidden from the main V2 board UI behind a local disabled experimental flag;
- panels, APIs, backend behavior, and data contracts were retained;
- no auth, `card.data`, attachment, port, or connection semantics changed.

Primary commit: `18090a114b09c8b18eba412eaca20b8c1c9a7553`.

Later tasks must keep these controls hidden unless a new task explicitly restores them.
