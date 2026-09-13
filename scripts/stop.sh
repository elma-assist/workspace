#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml stop
