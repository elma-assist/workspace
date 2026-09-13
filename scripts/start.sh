#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 scripts/configure.py
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml up -d --build --wait --wait-timeout 180

printf "Elma: http://localhost:8180\nWorkspace: http://localhost:8180/app\n"
