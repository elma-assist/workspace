import logging
import time
from uuid import uuid4
from app.db import connect
from app.retrieval import embed, vector_literal
from app.settings import settings

log = logging.getLogger(__name__)


def split_text(text: str, size: int = 1800, overlap: int = 200) -> list[str]:
    return [
        text[i : i + size]
        for i in range(0, len(text), size - overlap)
        if text[i : i + size].strip()
    ]


def index_next() -> bool:
    with connect() as conn:
        doc = conn.execute(
            "SELECT * FROM documents WHERE status='uploaded' OR (status='indexing' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1"
        ).fetchone()
        if not doc:
            return False
        conn.execute(
            "UPDATE documents SET status='indexing',lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id=%s",
            (doc["id"],),
        )
    try:
        chunks = split_text(doc["body"])
        with connect() as conn:
            for start in range(0, len(chunks), 24):
                batch = chunks[start : start + 24]
                vectors = embed(conn, doc["org_id"], batch)
                for index, (body, vec) in enumerate(zip(batch, vectors)):
                    conn.execute(
                        "INSERT INTO chunks(id,org_id,document_id,position,body,embedding,model) VALUES (%s,%s,%s,%s,%s,%s::vector,%s)",
                        (
                            uuid4(),
                            doc["org_id"],
                            doc["id"],
                            start + index,
                            body,
                            vector_literal(vec),
                            settings.embedding_model,
                        ),
                    )
            conn.execute(
                "UPDATE documents SET status='ready',error=NULL,lease_until=NULL WHERE id=%s",
                (doc["id"],),
            )
    except Exception as exc:
        log.error("Indexing failed: %s", type(exc).__name__)
        with connect() as conn:
            conn.execute(
                "UPDATE documents SET status='failed',error=%s,lease_until=NULL WHERE id=%s",
                (
                    str(exc)[:200]
                    if isinstance(exc, RuntimeError)
                    else "Indexing failed; retry after checking provider connectivity",
                    doc["id"],
                ),
            )
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    while True:
        if not index_next():
            time.sleep(2)
