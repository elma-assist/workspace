from uuid import uuid4
import httpx
from pydantic import BaseModel, Field
from app.settings import settings
from app.billing import record
from app.db import connect


class EmbeddingItem(BaseModel):
    index: int
    embedding: list[float]


class EmbeddingResponse(BaseModel):
    id: str | None = None
    data: list[EmbeddingItem]
    usage: dict = Field(default_factory=dict)


def embed(
    conn, org_id, texts: list[str], conversation_id=None, agent_id=None
) -> list[list[float]]:
    if not settings.openrouter_api_key:
        raise RuntimeError("OpenRouter API key is not configured")
    r = httpx.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
        json={"model": settings.embedding_model, "input": texts},
        timeout=60,
    )
    if not r.is_success:
        raise RuntimeError(f"Embedding provider returned HTTP {r.status_code}")
    result = EmbeddingResponse.model_validate(r.json())
    values = [item.embedding for item in sorted(result.data, key=lambda i: i.index)]
    if len(values) != len(texts) or any(
        len(v) != settings.embedding_dimensions for v in values
    ):
        raise RuntimeError("Unexpected embedding dimensions")
    # Provider usage survives a later document/index transaction rollback.
    with connect() as usage_conn:
        record(
            usage_conn,
            org_id,
            "openrouter",
            result.id or str(uuid4()),
            "embedding",
            settings.embedding_model,
            {
                "prompt_tokens": result.usage.get(
                    "prompt_tokens", result.usage.get("total_tokens", 0)
                )
            },
            result.usage,
            agent_id,
            conversation_id,
        )
    return values


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(str(x) for x in vector) + "]"


def retrieve(conn, conversation: dict, query: str) -> list[dict]:
    kb_ids = conversation["config"]["kb_ids"]
    if not kb_ids:
        return []
    vector = embed(
        conn,
        conversation["org_id"],
        [query],
        conversation["id"],
        conversation["agent_id"],
    )[0]
    matches = conn.execute(
        "SELECT d.id AS document_id,d.name,c.body AS excerpt,1-(c.embedding <=> %s::vector) AS score "
        "FROM chunks c JOIN documents d ON d.id=c.document_id AND d.org_id=c.org_id "
        "WHERE c.org_id=%s AND d.kb_id=ANY(%s::uuid[]) AND d.status='ready' AND c.model=%s "
        "ORDER BY c.embedding <=> %s::vector LIMIT 4",
        (
            vector_literal(vector),
            conversation["org_id"],
            kb_ids,
            settings.embedding_model,
            vector_literal(vector),
        ),
    ).fetchall()
    for item in matches:
        conn.execute(
            "INSERT INTO sources(id,conversation_id,query,document_id,name,excerpt,score) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (
                uuid4(),
                conversation["id"],
                query,
                item["document_id"],
                item["name"],
                item["excerpt"],
                item["score"],
            ),
        )
    return matches
