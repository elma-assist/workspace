import hashlib
import secrets
from uuid import UUID
from fastapi import Depends, HTTPException, Request
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from app.db import db
from app.settings import settings

hasher = PasswordHasher()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify(password: str, hashed: str) -> bool:
    try:
        return hasher.verify(hashed, password)
    except VerificationError:
        return False


def current_user(request: Request, conn=Depends(db)) -> dict:
    token = request.cookies.get("elma_session", "")
    user = conn.execute(
        "SELECT u.id,u.name,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id "
        "WHERE s.token_hash=%s AND s.expires_at>now()",
        (digest(token),),
    ).fetchone()
    if not user:
        raise HTTPException(401, "Please sign in")
    return user


def membership(conn, org_id: UUID, user: dict, admin: bool = False) -> dict:
    row = conn.execute(
        "SELECT * FROM memberships WHERE org_id=%s AND user_id=%s", (org_id, user["id"])
    ).fetchone()
    if not row or (admin and row["role"] not in {"owner", "admin"}):
        raise HTTPException(403, "Access not granted")
    return row


def agent_permission(conn, org_id: UUID, agent_id: UUID, user: dict) -> dict:
    member = membership(conn, org_id, user)
    agent = conn.execute(
        "SELECT * FROM agents WHERE org_id=%s AND id=%s", (org_id, agent_id)
    ).fetchone()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if (
        member["role"] == "employee"
        and not conn.execute(
            "SELECT 1 FROM agent_access WHERE org_id=%s AND agent_id=%s AND user_id=%s",
            (org_id, agent_id, user["id"]),
        ).fetchone()
    ):
        raise HTTPException(403, "This agent is not assigned to you")
    return agent


def internal(request: Request, conn=Depends(db)) -> None:
    if not secrets.compare_digest(
        request.headers.get("x-service-secret", ""), settings.service_secret
    ):
        raise HTTPException(403, "Service access required")

    run = request.headers.get("x-conversation-run")
    cid = request.path_params.get("cid")
    if (
        run
        and cid
        and not request.url.path.endswith(("/messages", "/metrics", "/close"))
    ):
        if not conn.execute(
            "SELECT 1 FROM conversations c WHERE c.id=%s AND c.run_id=%s "
            "AND (c.run_share_id IS NULL OR EXISTS(SELECT 1 FROM conversation_shares s "
            "JOIN publications p ON p.agent_id=c.agent_id AND p.org_id=c.org_id "
            "WHERE s.id=c.run_share_id AND NOT s.revoked AND p.enabled)) FOR NO KEY UPDATE",
            (UUID(str(cid)), UUID(run)),
        ).fetchone():
            raise HTTPException(
                409, "Conversation was reopened. This connection is no longer active."
            )
