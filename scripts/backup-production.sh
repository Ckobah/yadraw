#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/yadraw
set -a
source .env
set +a

: "${V2_DATABASE_URL:?V2_DATABASE_URL is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

backup_root="${BACKUP_DIR:-/opt/yadraw/.backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot="${backup_root}/${timestamp}"
mkdir -p "${snapshot}/objects"

if command -v docker >/dev/null 2>&1; then
  docker run --rm --network host -e V2_DATABASE_URL \
    -v "${snapshot}:/backup" pgvector/pgvector:pg17 \
    pg_dump "${V2_DATABASE_URL}" --format=custom --no-owner --file=/backup/database.dump
elif command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${V2_DATABASE_URL}" --format=custom --no-owner --file="${snapshot}/database.dump"
else
  echo "Neither docker nor pg_dump is available for database backup" >&2
  exit 1
fi

mirror_objects() {
  if command -v mc >/dev/null 2>&1; then
    MC_CONFIG_DIR="${snapshot}/.mc" mc alias set yadraw-backup "${S3_ENDPOINT}" \
      "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" >/dev/null
    MC_CONFIG_DIR="${snapshot}/.mc" mc mirror --overwrite \
      "yadraw-backup/${S3_BUCKET}" "${snapshot}/objects"
    rm -rf -- "${snapshot}/.mc"
    return
  fi

  command -v docker >/dev/null 2>&1 || {
    echo "Neither mc nor docker is available for object storage backup" >&2
    return 1
  }
  docker run --rm --network host \
    -e S3_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e S3_BUCKET \
    -v "${snapshot}:/backup" --entrypoint /bin/sh minio/mc -c '
      mc alias set yadraw-backup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc mirror --overwrite "yadraw-backup/$S3_BUCKET" /backup/objects
    '
}

mirror_objects
(
  cd "${snapshot}"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 -r sha256sum > SHA256SUMS
)

if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  command -v rclone >/dev/null 2>&1 || {
    echo "BACKUP_RCLONE_REMOTE is configured but rclone is unavailable" >&2
    exit 1
  }
  rclone copy "${snapshot}" "${BACKUP_RCLONE_REMOTE%/}/yadraw/${timestamp}"
else
  echo "Warning: BACKUP_RCLONE_REMOTE is not configured; snapshot is local only" >&2
fi

find "${backup_root}" -mindepth 1 -maxdepth 1 -type d \
  -name '????????T??????Z' -mtime "+${retention_days}" -print -exec rm -rf -- {} +
echo "Backup complete: ${snapshot}"
