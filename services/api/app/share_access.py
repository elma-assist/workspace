"""Conversation-scoped capabilities, separate from a visitor's other conversations."""

from fastapi import HTTPException
from app.security import digest


def lookup_share(conn, token):
    row = (
        conn.execute(
            "SELECT s.* FROM conversation_shares s JOIN conversations c ON c.id=s.conversation_id "
            "JOIN publications p ON p.agent_id=c.agent_id AND p.org_id=c.org_id "
            "WHERE s.token_hash=%s AND NOT s.revoked AND p.enabled",
            (digest(token),),
        ).fetchone()
        if token
        else None
    )
    if not row:
        raise HTTPException(
            403, "This conversation link is invalid, revoked or no longer published"
        )
    return row
