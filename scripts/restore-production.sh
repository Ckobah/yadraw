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

backup_root="$(realpath "${BACKUP_DIR:-/opt/yadraw/.backups}")"
snapshot="$(realpath "${1:?Usage: RESTORE_CONFIRM=RESTORE_YADRAW $0 <snapshot-directory>}")"
[[ "${snapshot}" == "${backup_root}/"* ]] || {
  echo "Snapshot must be inside ${backup_root}" >&2
  exit 1
}
[[ "${RESTORE_CONFIRM:-}" == "RESTORE_YADRAW" ]] || {
  echo "Set RESTORE_CONFIRM=RESTORE_YADRAW to confirm destructive restore" >&2
  exit 1
}
[[ -f "${snapshot}/database.dump" && -f "${snapshot}/SHA256SUMS" ]] || {
  echo "Incomplete backup snapshot: ${snapshot}" >&2
  exit 1
}

(cd "${snapshot}" && sha256sum --check SHA256SUMS)
pm2 stop yadraw-api yadraw-web

restore_failed=1
finish() {
  pm2 restart yadraw-api yadraw-web --update-env || true
  exit "${restore_failed}"
}
trap finish EXIT

if command -v docker >/dev/null 2>&1; then
  docker run --rm --network host -e V2_DATABASE_URL \
    -v "${snapshot}:/backup:ro" pgvector/pgvector:pg17 \
    pg_restore --clean --if-exists --no-owner --dbname="${V2_DATABASE_URL}" \
      /backup/database.dump
elif command -v pg_restore >/dev/null 2>&1; then
  pg_restore --clean --if-exists --no-owner --dbname="${V2_DATABASE_URL}" \
    "${snapshot}/database.dump"
else
  echo "Neither docker nor pg_restore is available for database restore" >&2
  exit 1
fi

if command -v mc >/dev/null 2>&1; then
  temporary_config="$(mktemp -d)"
  MC_CONFIG_DIR="${temporary_config}" mc alias set yadraw-restore "${S3_ENDPOINT}" \
    "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" >/dev/null
  MC_CONFIG_DIR="${temporary_config}" mc mirror --overwrite --remove \
    "${snapshot}/objects" "yadraw-restore/${S3_BUCKET}"
  rm -rf -- "${temporary_config}"
else
  docker run --rm --network host \
    -e S3_ENDPOINT -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e S3_BUCKET \
    -v "${snapshot}:/backup:ro" --entrypoint /bin/sh minio/mc -c '
      mc alias set yadraw-restore "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
      mc mirror --overwrite --remove /backup/objects "yadraw-restore/$S3_BUCKET"
    '
fi

restore_failed=0
echo "Restore complete: ${snapshot}"
