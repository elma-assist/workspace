#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose --env-file infra/local/runtime.env -f infra/compose.yaml exec -T api python -c \
  'import json; from app.main import app; print(json.dumps(app.openapi(),indent=2))' > packages/contracts/openapi.json
npx openapi-typescript packages/contracts/openapi.json -o packages/contracts/api.d.ts
