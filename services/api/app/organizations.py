from app.responses import Organization
import secrets
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from app.db import db
from app.schemas import Named, Invitation, AccessInput
from app.security import current_user, membership, digest
from app.settings import settings

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@router.get("", response_model=list[Organization])
def organizations(user=Depends(current_user), conn=Depends(db)):
    return conn.execute(
        "SELECT o.*,m.role FROM organizations o JOIN memberships m ON o.id=m.org_id WHERE m.user_id=%s ORDER BY o.created_at",
        (user["id"],),
    ).fetchall()


@router.post("", response_model=Organization)
def create(data: Named, user=Depends(current_user), conn=Depends(db)):
    org_id = uuid4()
    row = conn.execute(
        "INSERT INTO organizations(id,name) VALUES (%s,%s) RETURNING slug",
        (org_id, data.name),
    ).fetchone()
    conn.execute("INSERT INTO memberships VALUES (%s,%s,'owner')", (org_id, user["id"]))
    return {"id": org_id, "name": data.name, "slug": row["slug"], "role": "owner"}


@router.get("/{org_id}/members")
def members(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    return conn.execute(
        "SELECT u.id,u.name,u.email,m.role, ARRAY(SELECT agent_id FROM agent_access a WHERE a.org_id=m.org_id AND a.user_id=u.id) AS agent_ids FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=%s ORDER BY u.name",
        (org_id,),
    ).fetchall()


def validate_agents(conn, org_id: UUID, ids: list[UUID]) -> None:
    count = conn.execute(
        "SELECT count(*) AS n FROM agents WHERE org_id=%s AND id=ANY(%s)", (org_id, ids)
    ).fetchone()["n"]
    if count != len(set(ids)):
        raise HTTPException(400, "Unknown agent in this organization")


@router.post("/{org_id}/invitations")
def invite(
    org_id: UUID, data: Invitation, user=Depends(current_user), conn=Depends(db)
):
    membership(conn, org_id, user, True)
    validate_agents(conn, org_id, data.agent_ids)
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO invitations(id,org_id,email,name,token_hash,agent_ids,expires_at) VALUES (%s,%s,%s,%s,%s,%s,now()+interval '7 days')",
        (
            uuid4(),
            org_id,
            str(data.email).lower(),
            data.name,
            digest(token),
            data.agent_ids,
        ),
    )
    return {
        "url": f"{settings.public_url}/app?invite={token}",
        "delivery": "manual",
        "expires_in_days": 7,
    }


@router.put("/{org_id}/members/{user_id}/access")
def access(
    org_id: UUID,
    user_id: UUID,
    data: AccessInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    validate_agents(conn, org_id, data.agent_ids)
    if not conn.execute(
        "SELECT 1 FROM memberships WHERE org_id=%s AND user_id=%s", (org_id, user_id)
    ).fetchone():
        raise HTTPException(404, "Member not found")
    conn.execute(
        "DELETE FROM agent_access WHERE org_id=%s AND user_id=%s", (org_id, user_id)
    )
    for agent_id in set(data.agent_ids):
        conn.execute(
            "INSERT INTO agent_access VALUES (%s,%s,%s)", (org_id, agent_id, user_id)
        )
    return {"ok": True}
