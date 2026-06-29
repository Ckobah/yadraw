# V2 Attachments

V2 attachments are stored outside `card.data`.

`files` stores object/file metadata owned by a workspace: bucket, path, filename,
mime type, size, checksum, processing status, and metadata.

`card_files` stores the relation between cards and files. A file can be linked to
a card with a role such as `attachment`, without embedding file references into
the card JSON payload.

Actual upload/download endpoints and S3/MinIO storage integration will be added
in PR 6.4b.

Inspector UI, file picker, and previews will be added in PR 6.4c.
