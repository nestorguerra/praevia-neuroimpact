#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Deploy PraevIA NeuroImpact to a remote Docker Compose host.

Required env:
  DEPLOY_ENV=staging|production
  DEPLOY_HOST=host.example.com
  IMAGE_TAG=staging-<sha>|production-<sha>
  ENV_FILE_SOURCE=/path/to/.env.staging|.env.production

Optional env:
  DEPLOY_USER=deploy
  DEPLOY_PORT=22
  DEPLOY_ROOT=/opt/praevia-neuroimpact/$DEPLOY_ENV
  GHCR_USERNAME=<user>
  GHCR_PAT=<token>
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${DEPLOY_ENV:?DEPLOY_ENV required}"
: "${DEPLOY_HOST:?DEPLOY_HOST required}"
: "${IMAGE_TAG:?IMAGE_TAG required}"
: "${ENV_FILE_SOURCE:?ENV_FILE_SOURCE required}"

if [[ "$DEPLOY_ENV" != "staging" && "$DEPLOY_ENV" != "production" ]]; then
  echo "DEPLOY_ENV must be staging or production" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE_SOURCE" ]]; then
  echo "ENV_FILE_SOURCE does not exist: $ENV_FILE_SOURCE" >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/praevia-neuroimpact/$DEPLOY_ENV}"
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
RELEASE_ID="$IMAGE_TAG"
REMOTE_RELEASE="$DEPLOY_ROOT/releases/$RELEASE_ID"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/release"
cp -R infra "$TMP_DIR/release/infra"
cp "$ENV_FILE_SOURCE" "$TMP_DIR/release/.env.$DEPLOY_ENV"
tar -C "$TMP_DIR/release" -czf "$TMP_DIR/release.tgz" .

ssh -p "$DEPLOY_PORT" "$REMOTE" "mkdir -p '$REMOTE_RELEASE' '$DEPLOY_ROOT/shared'"
scp -P "$DEPLOY_PORT" "$TMP_DIR/release.tgz" "$REMOTE:$DEPLOY_ROOT/shared/release-$RELEASE_ID.tgz"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_PAT:-}" ]]; then
  printf '%s' "$GHCR_PAT" | ssh -p "$DEPLOY_PORT" "$REMOTE" "docker login ghcr.io -u '$GHCR_USERNAME' --password-stdin"
fi

ssh -p "$DEPLOY_PORT" "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
cd "$DEPLOY_ROOT"
rm -rf "$REMOTE_RELEASE"
mkdir -p "$REMOTE_RELEASE"
tar -C "$REMOTE_RELEASE" -xzf "$DEPLOY_ROOT/shared/release-$RELEASE_ID.tgz"
ln -sfn "$REMOTE_RELEASE" "$DEPLOY_ROOT/current"
cd "$DEPLOY_ROOT/current"
set -a
. ".env.$DEPLOY_ENV"
set +a
export IMAGE_TAG="$IMAGE_TAG"
docker compose -f "infra/docker-compose.$DEPLOY_ENV.yml" --env-file ".env.$DEPLOY_ENV" pull
docker compose -f "infra/docker-compose.$DEPLOY_ENV.yml" --env-file ".env.$DEPLOY_ENV" up -d --remove-orphans
docker compose -f "infra/docker-compose.$DEPLOY_ENV.yml" --env-file ".env.$DEPLOY_ENV" ps
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

echo "Deployed $DEPLOY_ENV release $RELEASE_ID to $DEPLOY_HOST"
