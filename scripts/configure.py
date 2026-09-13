"""Create installation secrets once. Never print provider credentials."""

import json
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
local = root / "infra/local"
local.mkdir(parents=True, exist_ok=True)
env = local / "runtime.env"
if not env.exists():
    password, service, s3, livekit = [secrets.token_hex(24) for _ in range(4)]
    values = {
        "DATABASE_PASSWORD": password,
        "DATABASE_URL": f"postgresql://elma:{password}@postgres:5432/elma",
        "SERVICE_SECRET": service,
        "S3_ACCESS_KEY": "elma",
        "S3_SECRET_KEY": s3,
        "LIVEKIT_API_KEY": "elma",
        "LIVEKIT_API_SECRET": livekit,
        "LIVEKIT_URL": "http://livekit:7880",
        "LIVEKIT_PUBLIC_URL": "ws://localhost:8180",
        "API_URL": "http://api:8000",
        "SEED_PASSWORD": secrets.token_urlsafe(18),
    }
    env.write_text("\n".join(f"{k}={v}" for k, v in values.items()) + "\n")
    (local / "livekit.yaml").write_text(
        f"port: 7880\nbind_addresses: ['0.0.0.0']\nrtc:\n  tcp_port: 7881\n"
        f"  udp_port: 7882\n  use_external_ip: false\n  enable_loopback_candidate: true\n"
        f"keys:\n  elma: {livekit}\n"
    )
    (local / "s3.json").write_text(
        json.dumps(
            {
                "identities": [
                    {
                        "name": "elma",
                        "credentials": [{"accessKey": "elma", "secretKey": s3}],
                        "actions": ["Admin", "Read", "Write", "List", "Tagging"],
                    }
                ]
            }
        )
    )
for path in local.iterdir():
    if path.is_file():
        os.chmod(path, 0o600)
values = dict(
    line.split("=", 1) for line in env.read_text().splitlines() if "=" in line
)
access = local / "demo-access.md"
access.write_text(
    "# Local demo access\n\nOpen http://localhost:8180/app/nordhaus\n\n- Administrator: admin@example.com\n- Employee: member@example.com\n- Demo password for both: `"
    + values["SEED_PASSWORD"]
    + "`\n\nThese are local test accounts. Provider API keys remain in .env.local.\n"
)
os.chmod(access, 0o600)
print("Local configuration ready. Demo login: infra/local/demo-access.md")
