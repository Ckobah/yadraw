# V2 Attachments

V2 attachments are stored outside `card.data`.

`files` stores object/file metadata owned by a workspace: bucket, path, filename,
mime type, size, checksum, processing status, and metadata.

`card_files` stores the relation between cards and files. A file can be linked to
a card with a role such as `attachment`, without embedding file references into
the card JSON payload.

PR 6.4b adds backend-only API and storage support:

- `GET /v2/cards/:cardId/attachments`
- `POST /v2/cards/:cardId/attachments`
- `GET /v2/files/:fileId/download`
- `DELETE /v2/cards/:cardId/attachments/:attachmentId`

Binary content is stored in S3/MinIO. Metadata stays in `files`, and card links
stay in `card_files`.

Inspector UI, file picker, and previews will be added in PR 6.4c.
