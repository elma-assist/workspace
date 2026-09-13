# GitHub deployment

Production: https://elma-assist.de. Server: `ssh elma` (78.46.193.204).

Pushes to `main` run `.github/workflows/checks.yml`: secret scan, TypeScript,
UI unit tests, Python types, prohibited-license check, API integration tests,
OpenAPI drift detection, worker unit tests, backup restoration and browser smoke
checks. PRs run checks only. Live AI/voice tests require provider credentials and
are run separately; CI never receives production provider keys.

After successful checks, four linux/amd64 images are published to GHCR with the
full commit SHA. The production job uploads that exact revision over SSH, pulls
images, backs up the previous installation, applies migrations and waits for
container health and public HTTPS checks. Only then is `/opt/elma/current`
advanced. Builds run on GitHub, not on the 8 GB production server.

## Server layout and secrets

- `/opt/elma/shared/runtime.env`: production settings and provider credentials.
- `/opt/elma/shared/livekit.yaml`, `s3.json`: generated installation secrets.
- `/opt/elma/shared/access.md`: random initial pilot account password.
- `/opt/elma/releases/<sha>`: source revisions and `IMAGE_TAG`.
- `/opt/elma/current`: last successfully verified release.
- `/opt/elma/backups`: database dump, document archive and source revision.
- Docker volumes `elma_postgres`, `elma_seaweed`, `elma_certificates`: persistent data.

GitHub's `production` environment uses `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`
secrets and `DEPLOY_HOST` variable. The dedicated `deploy` user has Docker access;
this is effectively privileged server access. Its key has forwarding disabled.
The server's host key is pinned from the existing trusted SSH connection. GHCR
uses the workflow's short-lived token and a temporary Docker configuration,
removed on exit. No personal access token is stored on the server.

Initialize a fresh server with `python3 scripts/configure-production.py`, then add
provider API keys to `runtime.env` (mode 0600). This does not transfer local users,
history or uploaded files. The pilot seed creates Nordhaus with a random password.

## DNS, HTTPS and voice

`elma-assist.de` points to the server through Cloudflare, SSL mode Full (strict).
`rtc.elma-assist.de` points directly to 78.46.193.204 with DNS only.
`files.elma-assist.de` points to this server; it can use Cloudflare proxying.
Traefik obtains and renews Let's Encrypt certificates using HTTP-01 on port 80.
Cloudflare must allow `/.well-known/acme-challenge/` without authentication or
challenge pages. Do not cache API or authenticated responses.

Public ports: 22/tcp (SSH), 80/tcp and 443/tcp (HTTP/HTTPS), 7881/tcp and
7882/udp (LiveKit media). PostgreSQL and internal service ports are not published.
LiveKit advertises its external IP. This installation does not yet provide
TURN/TLS fallback for networks that block both direct media transports.

## Operations

```sh
cd /opt/elma/current
export IMAGE_TAG=$(cat IMAGE_TAG)
docker compose --env-file /opt/elma/shared/runtime.env -f infra/compose.production.yaml ps
./scripts/backup-production.sh
```

Backups run before updates and nightly via a systemd timer. They stay on this
server; independent off-server backup storage must be configured separately.
Monitor disk space and copy backups off-server before pruning old ones.

Deployments are serialized. A failed update does not move `current`, but may have
already changed containers or the schema. There is no automatic schema downgrade:
inspect the failure, deploy a fix, or restore a matching backup and its recorded
release during a maintenance window. Single-server Compose updates can briefly
interrupt sessions; this setup is not high availability.
