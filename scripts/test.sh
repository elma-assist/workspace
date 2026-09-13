#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm run typecheck
npm run test:ui
npx pyright
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml exec -T api python -m pytest -q
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml exec -T agent-worker python -m unittest discover -s tests -v
npm run test:e2e
