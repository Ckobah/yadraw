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
    npm ci
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

set -a
source .env
set +a

npm ci
bash scripts/backup-production.sh
npm run v2:migrations:apply --workspace @yadraw/api
npm run build

pm2 restart yadraw-api yadraw-web --update-env

api_port="${PORT:-4000}"
web_port="${WEB_PORT:-3000}"
for attempt in {1..20}; do
  if curl --fail --silent "http://127.0.0.1:${api_port}/health" >/dev/null && \
     curl --fail --silent "http://127.0.0.1:${web_port}/login" >/dev/null; then
    SMOKE_BASE_URL="https://yadraw.com" node scripts/smoke-production.mjs
    trap - ERR
    echo "Deployment healthy at $(git rev-parse --short HEAD)"
    pm2 list
    exit 0
  fi
  sleep 2
done

echo "Post-deploy health check failed" >&2
false
