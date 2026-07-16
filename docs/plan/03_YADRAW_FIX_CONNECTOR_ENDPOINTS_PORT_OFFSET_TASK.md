# Task 03 completion record: align connector endpoints with ports

Status: complete; do not rerun.

Implemented in `apps/web/features/v2-board/v2-connector-edge.tsx`:

- rendered source/target endpoints move from the React Flow handle center to the visible circular port boundary;
- offset is side-based and axis-aligned for top/right/bottom/left;
- current visible port radius is `8px`;
- auto and manual routes use the same visible endpoint geometry.

Connection IDs, source/target card IDs, handle IDs, stored waypoints, route mode, labels, and port semantics remain unchanged.

Final correction commit: `91fcc2d769653cbae94a537f55cfe45bb815a624`.
