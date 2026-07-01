# V2 Attachments

V2 attachments are stored outside `card.data` and `connection.data`.

`files` stores object/file metadata owned by a workspace: bucket, path, filename,
mime type, size, checksum, processing status, and metadata.

`card_files` stores the relation between cards and files. A file can be linked to
a card with a role such as `attachment`, without embedding file references into
the card JSON payload.

`connection_files` stores the relation between connectors/connections and files.
Connector files are separate from card files and must not be attached through
`card_files`.

PR 6.4b adds backend-only API and storage support:

- `GET /v2/cards/:cardId/attachments`
- `POST /v2/cards/:cardId/attachments`
- `GET /v2/files/:fileId/download`
- `DELETE /v2/cards/:cardId/attachments/:attachmentId`

PR 8.4a adds backend-only connector attachment support:

- `GET /v2/connections/:connectionId/attachments`
- `POST /v2/connections/:connectionId/attachments`
- `DELETE /v2/connections/:connectionId/attachments/:attachmentId`

Binary content is stored in S3/MinIO. Metadata stays in `files`, card links stay
in `card_files`, and connector links stay in `connection_files`.

Detaching an attachment soft-deletes only the relation row. Physical objects and
`files` rows are not deleted by detach.

Inspector UI, file picker, and previews will be added in PR 6.4c.
