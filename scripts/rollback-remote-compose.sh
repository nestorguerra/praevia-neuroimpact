#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Rollback PraevIA NeuroImpact on a remote Docker Compose host.

Required env:
  DEPLOY_ENV=staging|production
  DEPLOY_HOST=host.example.com
  ROLLBACK_TO=<existing-release-id>

Optional env:
  DEPLOY_USER=deploy
  DEPLOY_PORT=22
  DEPLOY_ROOT=/opt/praevia-neuroimpact/$DEPLOY_ENV
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${DEPLOY_ENV:?DEPLOY_ENV required}"
: "${DEPLOY_HOST:?DEPLOY_HOST required}"
: "${ROLLBACK_TO:?ROLLBACK_TO required}"

if [[ "$DEPLOY_ENV" != "staging" && "$DEPLOY_ENV" != "production" ]]; then
  echo "DEPLOY_ENV must be staging or production" >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/praevia-neuroimpact/$DEPLOY_ENV}"
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
REMOTE_RELEASE="$DEPLOY_ROOT/releases/$ROLLBACK_TO"

ssh -p "$DEPLOY_PORT" "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
test -d "$REMOTE_RELEASE"
ln -sfn "$REMOTE_RELEASE" "$DEPLOY_ROOT/current"
cd "$DEPLOY_ROOT/current"
set -a
. ".env.$DEPLOY_ENV"
set +a
export IMAGE_TAG="$ROLLBACK_TO"
docker compose -f "infra/docker-compose.$DEPLOY_ENV.yml" --env-file ".env.$DEPLOY_ENV" up -d --remove-orphans
for i in \$(seq 1 30); do
  if [ -n "\${READINESS_TOKEN:-}" ]; then
    curl -fsS -H "X-Readiness-Token: \$READINESS_TOKEN" "\$API_PUBLIC_URL/ready/dependencies?strict=true" >/tmp/praevia-ready.json && ready_ok=1 || ready_ok=0
  else
    curl -fsS "\$API_PUBLIC_URL/ready/dependencies?strict=true" >/tmp/praevia-ready.json && ready_ok=1 || ready_ok=0
  fi
  if [ "\$ready_ok" = "1" ]; then
    cat /tmp/praevia-ready.json
    exit 0
  fi
  sleep 5
done
docker compose -f "infra/docker-compose.$DEPLOY_ENV.yml" --env-file ".env.$DEPLOY_ENV" logs --tail=200
exit 1
REMOTE_SCRIPT

echo "Rolled back $DEPLOY_ENV to $ROLLBACK_TO on $DEPLOY_HOST"
