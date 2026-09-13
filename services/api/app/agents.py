from app.responses import Agent, Publication
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from app.db import db
from app.schemas import AgentInput, PublicationInput
from app.security import current_user, membership
from app.settings import settings

router = APIRouter(prefix="/api/organizations/{org_id}/agents", tags=["Agents"])


@router.get("", response_model=list[Agent])
def listing(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    member = membership(conn, org_id, user)
    return conn.execute(
        "SELECT a.*,p.id AS publication_id,p.enabled AS published FROM agents a LEFT JOIN publications p ON p.agent_id=a.id AND p.org_id=a.org_id WHERE a.org_id=%s AND (%s OR EXISTS(SELECT 1 FROM agent_access x WHERE x.org_id=a.org_id AND x.agent_id=a.id AND x.user_id=%s)) ORDER BY a.created_at",
        (org_id, member["role"] != "employee", user["id"]),
    ).fetchall()


def validate_bases(conn, org_id: UUID, ids: list[UUID]) -> None:
    n = conn.execute(
        "SELECT count(*) AS n FROM knowledge_bases WHERE org_id=%s AND id=ANY(%s)",
        (org_id, ids),
    ).fetchone()["n"]
    if n != len(set(ids)):
        raise HTTPException(400, "Unknown knowledge base")


@router.post("")
def create(
    org_id: UUID, data: AgentInput, user=Depends(current_user), conn=Depends(db)
):
    membership(conn, org_id, user, True)
    validate_bases(conn, org_id, data.kb_ids)
    validate_forms(conn, org_id, data.form_ids)
    agent_id = uuid4()
    conn.execute(
        "INSERT INTO agents(id,org_id,name,instruction,kb_ids,config,form_ids,description) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (
            agent_id,
            org_id,
            data.name,
            data.instruction,
            data.kb_ids,
            Jsonb(data.config.model_dump()),
            data.form_ids,
            data.description,
        ),
    )
    return {"id": agent_id}


@router.put("/{agent_id}")
def update(
    org_id: UUID,
    agent_id: UUID,
    data: AgentInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    validate_bases(conn, org_id, data.kb_ids)
    validate_forms(conn, org_id, data.form_ids)
    row = conn.execute(
        "UPDATE agents SET name=%s,instruction=%s,kb_ids=%s,config=%s,form_ids=%s,description=%s,version=version+1 WHERE org_id=%s AND id=%s RETURNING id",
        (
            data.name,
            data.instruction,
            data.kb_ids,
            Jsonb(data.config.model_dump()),
            data.form_ids,
            data.description,
            org_id,
            agent_id,
        ),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Agent not found")
    return row


@router.get("/{agent_id}/publication", response_model=Publication | None)
def publication(
    org_id: UUID, agent_id: UUID, user=Depends(current_user), conn=Depends(db)
):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "SELECT * FROM publications WHERE org_id=%s AND agent_id=%s", (org_id, agent_id)
    ).fetchone()
    return publication_result(conn, row) if row else None


@router.put("/{agent_id}/publication", response_model=Publication)
def publish(
    org_id: UUID,
    agent_id: UUID,
    data: PublicationInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    if not conn.execute(
        "SELECT 1 FROM agents WHERE org_id=%s AND id=%s", (org_id, agent_id)
    ).fetchone():
        raise HTTPException(404, "Agent not found")
    row = conn.execute(
        "INSERT INTO publications(id,org_id,agent_id,enabled,origins) VALUES (%s,%s,%s,%s,%s) ON CONFLICT(org_id,agent_id) DO UPDATE SET enabled=excluded.enabled,origins=excluded.origins RETURNING *",
        (uuid4(), org_id, agent_id, data.enabled, data.origins),
    ).fetchone()
    return publication_result(conn, row)


def publication_result(conn, row):
    slugs = conn.execute(
        "SELECT o.slug AS organization,a.slug AS agent FROM agents a JOIN organizations o ON o.id=a.org_id WHERE a.org_id=%s AND a.id=%s",
        (row["org_id"], row["agent_id"]),
    ).fetchone()
    return {
        **row,
        "embed": f'<script src="{settings.public_url}/widget.js" data-agent="{row["id"]}" defer></script>',
        "url": f"{settings.public_url}/a/{slugs['organization']}/{slugs['agent']}",
    }


def validate_forms(conn, org_id, ids):
    n = conn.execute(
        "SELECT count(*) AS n FROM form_templates WHERE org_id=%s AND id=ANY(%s)",
        (org_id, ids),
    ).fetchone()["n"]
    if n != len(set(ids)):
        raise HTTPException(400, "Unknown form")
