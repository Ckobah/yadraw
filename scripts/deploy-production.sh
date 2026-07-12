#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/yadraw
previous_commit="$(git rev-parse HEAD)"
deployment_started=0

rollback() {
  exit_code=$?
  trap - ERR
  echo "Deployment failed; restoring ${previous_commit}"
  git reset --hard "$previous_commit"
  if [[ "$deployment_started" == "1" ]]; then
    npm ci --include=dev
    set -a
    source .env
    set +a
    npm run build
    pm2 restart yadraw-api yadraw-web --update-env
  fi
  exit "$exit_code"
}
trap rollback ERR

git fetch origin main
git reset --hard origin/main
deployment_started=1

if ! grep -q '^INTERNAL_API_SECRET=' .env; then
  printf '\nINTERNAL_API_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
fi

if ! grep -q '^APP_ORIGIN=' .env; then
  printf '\nAPP_ORIGIN=https://yadraw.com\n' >> .env
fi

chmod 600 .env

set -a
source .env
set +a

if command -v docker >/dev/null 2>&1; then
  storage_containers="$(docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'minio|object.?storage' || true)"
  if [[ -n "$storage_containers" ]]; then
    echo "Detected object storage container:"
    echo "$storage_containers"
  fi
fi

check_secret() {
  name="$1"
  minimum_length="$2"
  value="${!name:-}"
  normalized_value="${value,,}"
  if [[ -z "$value" ]]; then
    echo "Required production secret is missing: ${name}" >&2
    return 1
  fi
  if (( ${#value} < minimum_length )); then
    echo "Production secret is too short: ${name}" >&2
    return 1
  fi
  if [[ "$normalized_value" =~ (replace|example|your-|placeholder|change[-_]?me|yadraw-secret) ]]; then
    echo "Production secret uses a placeholder or development default: ${name}" >&2
    return 1
  fi
}

check_secret INTERNAL_API_SECRET 32
check_secret S3_SECRET_ACCESS_KEY 16
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  check_secret SUPABASE_SERVICE_ROLE_KEY 32
else
  echo "Warning: SUPABASE_SERVICE_ROLE_KEY is not configured; account deletion is unavailable." >&2
fi
if [[ "${V2_DATABASE_URL:-}" == *"yadraw:yadraw@"* ]]; then
  echo "V2_DATABASE_URL uses development database credentials." >&2
  false
fi

npm ci --include=dev
bash scripts/backup-production.sh
npm run v2:migrations:apply --workspace @yadraw/api
npm run build

pm2 restart yadraw-api yadraw-web --update-env

api_ports=("${PORT:-}" 4004 4000)
web_ports=("${WEB_PORT:-}" 3004 3000)
healthy_api_port=""
healthy_web_port=""
for attempt in {1..20}; do
  for port in "${api_ports[@]}"; do
    if [[ -n "${port}" ]] && curl --fail --silent "http://127.0.0.1:${port}/health" >/dev/null; then
      healthy_api_port="${port}"
      break
    fi
  done
  for port in "${web_ports[@]}"; do
    if [[ -n "${port}" ]] && curl --fail --silent "http://127.0.0.1:${port}/login" >/dev/null; then
      healthy_web_port="${port}"
      break
    fi
  done
  if [[ -n "${healthy_api_port}" && -n "${healthy_web_port}" ]]; then
    SMOKE_BASE_URL="https://yadraw.com" node scripts/smoke-production.mjs
    trap - ERR
    echo "Deployment healthy at $(git rev-parse --short HEAD) (api:${healthy_api_port}, web:${healthy_web_port})"
    pm2 list
    exit 0
  fi
  sleep 2
done

echo "Post-deploy health check failed" >&2
for port in "${api_ports[@]}"; do
  [[ -n "${port}" ]] && curl --silent --show-error --include "http://127.0.0.1:${port}/health" || true
done
for port in "${web_ports[@]}"; do
  [[ -n "${port}" ]] && curl --silent --show-error --include "http://127.0.0.1:${port}/login" || true
done
pm2 logs yadraw-api yadraw-web --lines 40 --nostream || true
false
