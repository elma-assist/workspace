#!/usr/bin/env bash
# Runs as the deployment user. GHCR's short-lived read token arrives on stdin.
set -Eeuo pipefail
umask 077
sha=${1:?Commit SHA required}
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
root=/opt/elma
release="$root/releases/$sha"
export IMAGE_TAG="$sha"
export ELMA_SHARED_DIR="$root/shared"
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
docker login ghcr.io -u elma-assist --password-stdin
compose=(docker compose --env-file "$ELMA_SHARED_DIR/runtime.env" -f "$release/infra/compose.production.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" pull

if [[ -L "$root/current" ]]; then
  "$root/current/scripts/backup-production.sh"
fi
"${compose[@]}" up -d --wait --wait-timeout 240 --remove-orphans
for url in https://elma-assist.de/api/health https://elma-assist.de/app https://elma-assist.de/; do
  curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 "$url" -o /dev/null
done
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 https://rtc.elma-assist.de/ -o /dev/null
printf '%s\n' "$sha" > "$release/IMAGE_TAG"
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
printf 'Deployed %s\n' "$sha"
# Keep tagged releases for explicit rollback. Remove only disposable build cache.
docker builder prune -f --filter until=168h
