"""Real Postgres integration tests; isolated organizations, no paid model calls."""

from uuid import uuid4
import pytest
from app.db import connect
from app.billing import record


def account(client, name):
    client.cookies.clear()
    result = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": f"{uuid4().hex}@example.com",
            "password": "test-password-only-123",
        },
    )
    assert result.status_code == 200
    org = client.post("/api/organizations", json={"name": name}).json()
    return org["id"]


def test_org_isolation_and_employee_permissions(client):
    owner = client
    org = account(owner, "Boundary test")
    kb = owner.post(
        f"/api/organizations/{org}/knowledge", json={"name": "Private"}
    ).json()["id"]
    agent = owner.post(
        f"/api/organizations/{org}/agents",
        json={
            "name": "Assigned agent",
            "instruction": "Help.",
            "kb_ids": [kb],
        },
    ).json()["id"]
    hidden = owner.post(
        f"/api/organizations/{org}/agents",
        json={
            "name": "Unassigned agent",
            "instruction": "Help.",
        },
    ).json()["id"]
    invitation = (
        owner.post(
            f"/api/organizations/{org}/invitations",
            json={
                "name": "Employee",
                "email": f"{uuid4().hex}@example.com",
                "agent_ids": [agent],
            },
        )
        .json()["url"]
        .split("invite=")[1]
    )
    owner_cookies = dict(owner.cookies)
    owner.cookies.clear()
    assert (
        owner.post(
            "/api/auth/accept",
            json={"token": invitation, "password": "employee-password-123"},
        ).status_code
        == 200
    )
    assert [a["id"] for a in owner.get(f"/api/organizations/{org}/agents").json()] == [
        agent
    ]
    assert (
        owner.post(
            f"/api/organizations/{org}/agents/{hidden}/sessions", json={}
        ).status_code
        == 403
    )
    assert owner.get(f"/api/organizations/{org}/knowledge").status_code == 403
    assert owner.get(f"/api/organizations/{org}/conversations").status_code == 200
    assert owner.get(f"/api/organizations/{org}/usage").status_code == 403
    assert (
        owner.post(
            "/api/auth/accept",
            json={"token": invitation, "password": "employee-password-123"},
        ).status_code
        == 400
    )
    owner.cookies.clear()
    other = account(owner, "Other tenant")
    assert owner.get(f"/api/organizations/{org}/agents").status_code == 403
    assert (
        owner.post(
            f"/api/organizations/{other}/agents",
            json={
                "name": "Cross tenant",
                "instruction": "Help.",
                "kb_ids": [kb],
            },
        ).status_code
        == 400
    )
    owner.cookies.clear()
    owner.cookies.update(owner_cookies)
    pub = owner.put(
        f"/api/organizations/{org}/agents/{agent}/publication",
        json={
            "enabled": True,
            "origins": ["https://allowed.example.com"],
        },
    ).json()["id"]
    assert (
        owner.post(
            f"/api/public/{pub}/sessions",
            json={},
            headers={"origin": "https://wrong.example.com"},
        ).status_code
        == 403
    )
    assert owner.post(f"/api/public/{pub}/sessions", json={}).status_code == 403
    assert owner.get(f"/api/internal/conversations/{uuid4()}").status_code == 403
    assert (
        owner.post(
            "/api/organizations",
            json={"name": "CSRF"},
            headers={"origin": "https://wrong.example.com"},
        ).status_code
        == 403
    )


def test_billing_retries_are_idempotent_and_unknown_prices_visible(client):
    org = account(client, "Ledger test")
    with connect() as conn:
        for _ in range(2):
            record(
                conn,
                org,
                "mistral",
                "same-" + org,
                "llm",
                "mistral-small-latest",
                {"prompt_tokens": 1000},
                {},
            )
        record(
            conn,
            org,
            "mistral",
            "unknown-" + org,
            "llm",
            "unknown-model",
            {"prompt_tokens": 1000},
            {},
        )
    usage = client.get(f"/api/organizations/{org}/usage").json()
    assert usage["totals"]["calls"] == 2
    assert usage["totals"]["unpriced"] == 1
    assert float(usage["totals"]["price"]) > float(usage["totals"]["cost"]) > 0
    exported = client.get(f"/api/organizations/{org}/usage/export.csv")
    assert exported.status_code == 200
    assert "unknown-model" in exported.text
    assert len(exported.text.splitlines()) == 3
    empty = client.get(
        f"/api/organizations/{org}/usage?start=2100-01-01T00:00:00Z"
    ).json()
    assert empty["totals"]["calls"] == 0


def test_rag_filters_knowledge_and_tenant_before_ranking(client, monkeypatch):
    import hashlib
    from psycopg.types.json import Jsonb
    from app import retrieval
    from app.settings import settings
    from app.storage import put_text

    org = account(client, "RAG boundary")
    other = client.post("/api/organizations", json={"name": "Other RAG tenant"}).json()[
        "id"
    ]
    bases = []
    for owner, name in [
        (org, "Allowed"),
        (org, "Not attached"),
        (other, "Other tenant"),
    ]:
        bases.append(
            client.post(
                f"/api/organizations/{owner}/knowledge", json={"name": name}
            ).json()["id"]
        )
    agent = client.post(
        f"/api/organizations/{org}/agents",
        json={"name": "Scoped", "instruction": "Help", "kb_ids": [bases[0]]},
    ).json()["id"]
    cid = uuid4()
    vec = [1.0] + [0.0] * (settings.embedding_dimensions - 1)
    monkeypatch.setattr(retrieval, "embed", lambda *args, **kwargs: [vec])
    with connect() as conn:
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,config,room_name) VALUES (%s,%s,%s,%s,%s)",
            (cid, org, agent, Jsonb({"kb_ids": [bases[0]]}), "test-" + str(cid)),
        )
        for owner, kb, name in [
            (org, bases[0], "Allowed"),
            (org, bases[1], "Hidden"),
            (other, bases[2], "Foreign"),
        ]:
            doc = uuid4()
            body = name + " reference"
            key = f"{owner}/documents/{doc}.txt"
            put_text(key, body)
            conn.execute(
                "INSERT INTO documents(id,org_id,kb_id,name,object_key,body,checksum,status) VALUES (%s,%s,%s,%s,%s,%s,%s,'ready')",
                (
                    doc,
                    owner,
                    kb,
                    name,
                    key,
                    body,
                    hashlib.sha256(body.encode()).hexdigest(),
                ),
            )
            conn.execute(
                "INSERT INTO chunks VALUES (%s,%s,%s,0,%s,%s::vector,%s)",
                (
                    uuid4(),
                    owner,
                    doc,
                    body,
                    retrieval.vector_literal(vec),
                    settings.embedding_model,
                ),
            )
        result = retrieval.retrieve(
            conn,
            {
                "id": cid,
                "org_id": org,
                "agent_id": agent,
                "config": {"kb_ids": [bases[0]]},
            },
            "reference",
        )
        assert [item["name"] for item in result] == ["Allowed"]
