#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
target="infra/local/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$target"
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml exec -T postgres pg_dump -U elma -d elma -Fc > "$target/database.dump"
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml exec -T api python -m app.backup > "$target/documents.zip"
printf 'Backup created: %s\n' "$target"
