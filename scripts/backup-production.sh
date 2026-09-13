#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=/opt/elma
release=$(readlink -f "$root/current")
export IMAGE_TAG
IMAGE_TAG=$(cat "$release/IMAGE_TAG")
export ELMA_SHARED_DIR="$root/shared"
target="$root/backups/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$target"
compose=(docker compose --env-file "$ELMA_SHARED_DIR/runtime.env" -f "$release/infra/compose.production.yaml")
"${compose[@]}" exec -T postgres pg_dump -U elma -d elma -Fc > "$target/database.dump.partial"
mv "$target/database.dump.partial" "$target/database.dump"
"${compose[@]}" exec -T api python -m app.backup > "$target/documents.zip.partial"
mv "$target/documents.zip.partial" "$target/documents.zip"
printf '%s\n' "$IMAGE_TAG" > "$target/IMAGE_TAG"
echo "Backup created: $target"
