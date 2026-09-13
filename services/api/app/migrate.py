from typing import cast, LiteralString
from psycopg.sql import SQL
from pathlib import Path
from app.db import connect


def migrate() -> None:
    with connect() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(61724)")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)"
        )
        for path in sorted(Path("migrations").glob("*.sql")):
            if not conn.execute(
                "SELECT 1 FROM schema_migrations WHERE name=%s", (path.name,)
            ).fetchone():
                conn.execute(SQL(cast(LiteralString, path.read_text())))
                conn.execute("INSERT INTO schema_migrations VALUES (%s)", (path.name,))


if __name__ == "__main__":
    migrate()
