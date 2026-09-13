"""Restore the newest backup into isolated temporary resources, verify, then clean up."""

import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = [
    "docker",
    "compose",
    "--env-file",
    "infra/local/runtime.env",
    "-f",
    "infra/compose.yaml",
]


def run(args, **kwargs):
    return subprocess.run(COMPOSE + args, cwd=ROOT, check=True, **kwargs)


def main():
    backup = sorted((ROOT / "infra/local/backups").iterdir())[-1]
    name = "elma_restore_" + str(int(time.time()))
    run(["exec", "-T", "postgres", "createdb", "-U", "elma", name])
    try:
        with (backup / "database.dump").open("rb") as source:
            run(
                [
                    "exec",
                    "-T",
                    "postgres",
                    "pg_restore",
                    "-U",
                    "elma",
                    "-d",
                    name,
                    "--no-owner",
                    "--exit-on-error",
                ],
                stdin=source,
            )
        code = """
import hashlib,io,json,sys,zipfile
from psycopg import connect
from psycopg.rows import dict_row
from app.settings import settings
from app.storage import client
database=sys.argv[1]
with connect(settings.database_url.rsplit('/',1)[0]+'/'+database,row_factory=dict_row) as conn:
    docs=conn.execute('SELECT object_key,checksum FROM documents').fetchall()
    count=conn.execute('SELECT count(*) AS n FROM organizations').fetchone()['n']
s3=client();bucket=database.replace('_','-');keys=[]
archive=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
s3.create_bucket(Bucket=bucket)
try:
    for doc in docs:
        body=archive.read(doc['object_key'])
        assert hashlib.sha256(body).hexdigest()==doc['checksum']
        s3.put_object(Bucket=bucket,Key=doc['object_key'],Body=body)
        keys.append(doc['object_key'])
        restored=s3.get_object(Bucket=bucket,Key=doc['object_key'])['Body'].read()
        assert hashlib.sha256(restored).hexdigest()==doc['checksum']
    print(json.dumps({'restored_organizations':count,'restored_documents':len(docs),'checksums':'verified'}))
finally:
    for key in keys:s3.delete_object(Bucket=bucket,Key=key)
    s3.delete_bucket(Bucket=bucket)
"""
        with (backup / "documents.zip").open("rb") as source:
            run(["exec", "-T", "api", "python", "-c", code, name], stdin=source)
    finally:
        run(["exec", "-T", "postgres", "dropdb", "-U", "elma", name])


if __name__ == "__main__":
    main()
