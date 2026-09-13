# Application releases

Production infrastructure lives in
[`elma-assist/deploy`](https://github.com/elma-assist/deploy). This repository
contains application source, tests and Dockerfiles only.

Pushes and pull requests run secret scanning, TypeScript and Python checks, API
integration tests, contract drift detection, backup restoration and browser smoke
tests. A semantic-version tag such as `v0.1.0` runs the same checks and publishes
four linux/amd64 images to GHCR with both the immutable commit SHA and version tag:

- `ghcr.io/elma-assist/workspace-api`;
- `ghcr.io/elma-assist/workspace-agent-worker`;
- `ghcr.io/elma-assist/workspace-web`;
- `ghcr.io/elma-assist/workspace-landing`.

After those images finish publishing, set that exact version in the deployment
repository's `release.env`, commit the deployment configuration and publish its
stable GitHub Release. The deployment repository then updates production.

Do not use the mutable `latest` image tag. Protect release tags matching `v*`
against update and deletion with GitHub Rulesets.

The paid synthetic voice check remains a trusted-workstation operation:

```sh
ELMA_TEST_URL=https://elma-assist.de .venv/bin/python scripts/test_voice.py
```

It stores results under `artifacts/production-voice/`. Production provider keys,
server operations, Compose, routes and backup configuration are documented in the
deployment repository.
