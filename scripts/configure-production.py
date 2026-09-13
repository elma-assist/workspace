"""Initialize a fresh server's secrets once; never copy local application data."""

import json
import os
import secrets
from pathlib import Path

os.umask(0o077)
shared = Path(os.environ.get("ELMA_SHARED_DIR", "/opt/elma/shared"))
shared.mkdir(parents=True, exist_ok=True)
env = shared / "runtime.env"
if env.exists():
    raise SystemExit("Production configuration already exists; leaving it unchanged.")

password, service, s3, livekit = [secrets.token_hex(24) for _ in range(4)]
values = {
    "DATABASE_PASSWORD": password,
    "DATABASE_URL": f"postgresql://elma:{password}@postgres:5432/elma",
    "SERVICE_SECRET": service,
    "S3_ACCESS_KEY": "elma",
    "S3_SECRET_KEY": s3,
    "S3_PUBLIC_ENDPOINT": "https://files.elma-assist.de",
    "LIVEKIT_API_KEY": "elma",
    "LIVEKIT_API_SECRET": livekit,
    "LIVEKIT_URL": "http://livekit:7880",
    "LIVEKIT_PUBLIC_URL": "wss://rtc.elma-assist.de",
    "API_URL": "http://api:8000",
    "PUBLIC_URL": "https://elma-assist.de",
    "SECURE_COOKIES": "true",
    "SEED_PASSWORD": secrets.token_urlsafe(24),
}
env.write_text("\n".join(f"{k}={v}" for k, v in values.items()) + "\n")
(shared / "livekit.yaml").write_text(
    "port: 7880\nbind_addresses: ['0.0.0.0']\nrtc:\n"
    "  tcp_port: 7881\n  udp_port: 7882\n  use_external_ip: true\n"
    f"keys:\n  elma: {livekit}\n"
)
(shared / "s3.json").write_text(json.dumps({"identities": [{
    "name": "elma",
    "credentials": [{"accessKey": "elma", "secretKey": s3}],
    "actions": ["Admin", "Read", "Write", "List", "Tagging"],
}]}))
(shared / "access.md").write_text(
    "# Initial pilot access\n\nhttps://elma-assist.de/app/nordhaus\n\n"
    "Administrator: admin@example.com\nEmployee: member@example.com\n"
    f"Password: `{values['SEED_PASSWORD']}`\n"
)
print("Production configuration created. Credentials: shared/access.md")
