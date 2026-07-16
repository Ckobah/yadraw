# Yadraw V2: attachment indicator, file popover, and preview

Status: pending after task 09. This plan consumes the authenticated same-origin file routes from task 09 and must not change the auth/session model.

Use `docs/plan/00_SHARED_EXECUTION_RULES.md`.

## Goal and final behavior

- no files: no attachment control;
- one file: attachment icon;
- multiple files: icon with count;
- hover/focus/click opens a file-list popover;
- selecting a file opens a board-level preview;
- preview supports image, PDF, video, bounded text when safe, and a download fallback;
- multiple files navigate by buttons and arrow keys;
- inspector upload/detach updates icon, count, cache, and open preview without reload.

All file list/preview/download requests use same-origin `/v2/actions/...`. Browser code receives attachment metadata required for display, never object-store URLs, bucket/path, credentials, or server identity headers.

## Architecture fixed for all stages

```text
V2BoardDetail.cardAttachmentCounts
  -> V2BoardCanvas owns counts + lazy attachment cache + preview state
  -> V2CardNode receives count and callbacks
  -> V2CardAttachmentIndicator renders icon/popover
  -> V2DocumentPreview renders board-level modal
  -> inspector reports successful attachment changes back to canvas
```

Do not put counts, file metadata, cache, popover state, preview state, URLs, or storage metadata in `card.data`, visual style, schema/default data, connections, or linked fields.

Task 08 owns global shortcuts. While preview is open, its Escape/Arrow handlers own those keys, mark handled events, and the global editor command layer must ignore them.

The original seven implementation PRs are collapsed into four: indicator+popover and preview+navigation are each built as complete slices; final polish is conditional. This avoids dead buttons, temporary component APIs, and repeated state migration.

## Stage 1: board attachment-count foundation

Preferred contract:

```ts
type V2BoardDetail = {
  // existing fields
  cardAttachmentCounts: Record<string, number>;
};
```

Repository/service behavior:

- one grouped query, never N+1;
- count active `card_files` and active files for active cards in the requested board;
- return only `cardId -> positive integer`; absent means zero;
- return no filename, file ID, bucket, or path in this map;
- preserve existing board authorization before fetching data.

Add the field to the shared board-detail schema and every real/test implementation. Prefer explicit `{}` over silently defaulting malformed responses.

Web:

- initialize `attachmentCountsByCardId` in `V2BoardCanvas`;
- pass `attachmentCount: counts[card.id] ?? 0` in node data;
- render no icon yet.

Likely scope: shared V2 schema/tests, API repository/service/tests, board server data pass-through, canvas/node types. No migration.

Tests:

- empty, one, multiple, soft-deleted relation/file, deleted card, and inaccessible board;
- shared schema rejects negative/non-integer counts;
- node data receives zero/positive count.

Commit: `Add V2 board attachment counts`

## Stage 2: attachment indicator and lazy file-list popover

Create `v2-card-attachment-indicator.tsx` and place it in the existing card header before the three-dot menu without shifting ports, resize handles, type icon, or selection outline.

Behavior:

- count zero renders nothing;
- count one renders a small icon; count above one adds a readable badge;
- use a real English-labelled button, existing icon library/theme tokens, and `nodrag nopan` plus event isolation required by React Flow;
- hover, focus, or click opens the same popover; pointer transition from trigger to popover must not flicker;
- Escape/outside click closes; use a short close delay only for pointer movement;
- rows are buttons and show filename plus available MIME/size metadata;
- loading, retryable error, and empty-result mismatch states are explicit;
- add the final reduced-motion-safe opacity/transform transition now, not in a later rewrite.

Data:

- reuse the existing `listV2CardAttachments(cardId)`;
- canvas owns `attachmentsByCardId: Record<string, V2CardAttachment[] | undefined>` and in-flight/error state or an equivalent deduplicated loader;
- first open loads once; later opens reuse cache;
- expose a stable `onSelectAttachment(cardId, attachmentId)` callback for stage 3;
- until stage 3, selection may use the existing same-origin download/open action; keep that action as the eventual fallback, so it is not throwaway code.

If a local popover is clipped by card overflow, use an existing portal/popover pattern now. Do not postpone a known clipping defect.

Tests: visibility/count/ARIA, lazy-load deduplication, loading/error/list states, close behavior, and no node drag/pan from controls.

Commit: `Add V2 card attachment popover`

## Stage 3: preview overlay with multi-file navigation

Create a board-level `v2-document-preview.tsx`; do not render it inside a node.

Preview state is owned by canvas and identifies card, attachment list, and active attachment/index. Clicking the indicator opens the first file; selecting a popover row opens that exact file.

Rendering:

- `image/*`: responsive `img`;
- `application/pdf`: browser inline frame/object;
- `video/*`: controls-enabled video;
- `text/*`: only fetch/render with an enforced size cap; otherwise fallback;
- unsupported formats: filename, MIME, size, and same-origin Download/Open action.

URL decision is part of pre-flight for this stage:

1. inspect the current download proxy and `Content-Disposition`;
2. reuse it if inline rendering works safely;
3. otherwise add a backward-compatible same-origin inline option such as `?disposition=inline`;
4. keep default download disposition unchanged;
5. preserve authorization and Unicode filenames;
6. touch API/storage only if the proxy cannot request inline content through the existing backend contract.

Never expose a signed/direct S3/MinIO URL or storage location.

Modal and navigation are complete in this stage:

- close button, Escape, and backdrop click; panel click does not close;
- Previous/Next, `1 / N`, ArrowLeft/ArrowRight, bounded at ends;
- hide/disable navigation for one file;
- `role="dialog"`, `aria-modal="true"`, labelled controls, initial focus inside, and focus return when practical;
- overlay blocks React Flow pan/zoom/selection and appears above inspector, minimap, controls, ports, and connectors;
- basic open/close transition respects reduced motion.

Tests cover MIME renderer choice, exact selected index, boundaries/keyboard, close behavior, unsupported fallback, and access/default-disposition regression if proxy/API changed.

Commit: `Add V2 attachment preview and navigation`

## Stage 4: inspector synchronization

Thread one callback from the existing attachment section through inspector to canvas:

```ts
onAttachmentsChanged(cardId, attachments)
```

Invoke it only after successful upload/detach. Canvas atomically updates:

- cached list for the card;
- count (remove key or set zero consistently with stage 1);
- node data through its existing memoized mapping;
- preview state.

If the active preview file was detached, close preview; if another file changed, keep the current active attachment by ID. Failed mutations must not alter canvas cache/count.

Tests:

- upload 0 -> 1 shows icon;
- second upload changes badge;
- detach updates cached popover list;
- detach last file hides control;
- active-file detach closes preview;
- reload agrees with server count.

Commit: `Sync V2 attachment UI with inspector changes`

## Conditional QA follow-up

Do not schedule a standalone polish PR by default. Create one only for observed defects in popover clipping/flicker, focus return, reduced motion, stacking, or responsive preview sizing. Do not introduce a new animation or color system.

## Final acceptance and report additions

Manually verify no/one/many files, lazy list, exact-file preview, image/PDF/video/fallback, keyboard/focus, upload/detach without reload, reload persistence, card drag/selection/visual edit, and connector/port behavior.

For each stage report only:

- attachment contract/state changes;
- API/proxy changes and authorization behavior;
- rendered behavior and known browser MIME limitations;
- tests plus shared checks/bundle scan;
- confirmation that files were not copied, attachment relations stayed authoritative, `card.data` stayed clean, and no storage path/direct object URL/server secret reached the browser.
