"""Public agent pages and revocable links to a specific conversation."""

import secrets
from typing import Literal
from uuid import UUID, uuid4

from anyio import from_thread
from fastapi import APIRouter, Depends, HTTPException, Request
from livekit import api
from pydantic import Field

from app.conversations import open_session
from app.db import db
from app.request_domain import browser_conversation
from app.responses import PublicAgent, Session, SharedConversation, ShareLink
from app.schemas import Contract
from app.security import digest
from app.settings import settings
from app.share_access import lookup_share

router = APIRouter(tags=["Sharing"])


class ShareInput(Contract):
    token: str = Field(min_length=32, max_length=128)


class SharedSessionInput(ShareInput):
    mode: Literal["text", "voice"] = "text"


@router.get("/api/public/widgets/{pid}", response_model=PublicAgent)
def public_widget(pid: UUID, conn=Depends(db)):
    row = conn.execute(
        "SELECT a.name,a.description,p.id AS publication_id FROM publications p JOIN agents a ON a.id=p.agent_id AND a.org_id=p.org_id WHERE p.id=%s AND p.enabled",
        (pid,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "This agent is not published")
    return row


@router.get("/api/public/agents/{org_slug}/{agent_slug}", response_model=PublicAgent)
def public_agent_by_slug(org_slug: str, agent_slug: str, conn=Depends(db)):
    row = conn.execute(
        "SELECT a.name,a.description,p.id AS publication_id FROM agents a JOIN organizations o ON o.id=a.org_id JOIN publications p ON p.org_id=a.org_id AND p.agent_id=a.id WHERE o.slug=%s AND a.slug=%s AND p.enabled",
        (org_slug, agent_slug),
    ).fetchone()
    if not row:
        raise HTTPException(404, "This agent is not published")
    return row


@router.post("/api/public/conversations/{cid}/share", response_model=ShareLink)
def create_share(cid: UUID, request: Request, conn=Depends(db)):
    conv = browser_conversation(conn, cid, request)
    if not conn.execute(
        "SELECT 1 FROM publications WHERE org_id=%s AND agent_id=%s AND enabled",
        (conv["org_id"], conv["agent_id"]),
    ).fetchone():
        raise HTTPException(403, "Publish this agent before sharing conversations")
    if conv.get("shared_access"):
        token = request.headers["x-guest-token"]
    else:
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO conversation_shares(id,conversation_id,token_hash) VALUES (%s,%s,%s)",
            (uuid4(), cid, digest(token)),
        )
        conn.commit()
    return {"url": f"{settings.public_url}/s#{token}"}


async def disconnect_shared_room(room: str) -> None:
    async with api.LiveKitAPI(
        settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret
    ) as lk:
        try:
            await lk.room.delete_room(api.DeleteRoomRequest(room=room))
        except api.TwirpError as exc:
            if exc.code != "not_found":
                raise HTTPException(
                    503,
                    "Links revoked; disconnecting the previous connection failed",
                )


@router.delete("/api/public/conversations/{cid}/share")
def revoke_shares(cid: UUID, request: Request, conn=Depends(db)):
    conv = browser_conversation(conn, cid, request)
    if conv.get("shared_access"):
        raise HTTPException(403, "Only the conversation owner can revoke links")
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id=%s FOR UPDATE", (cid,)
    ).fetchone()
    conn.execute(
        "UPDATE conversation_shares SET revoked=true WHERE conversation_id=%s", (cid,)
    )
    if conv["run_share_id"]:
        conn.execute(
            "UPDATE conversations SET run_id=%s,status='completed' WHERE id=%s",
            (uuid4(), cid),
        )
    conn.commit()
    if conv["run_share_id"]:
        from_thread.run(disconnect_shared_room, conv["room_name"])
    return {"ok": True}


@router.post("/api/public/shared/info", response_model=SharedConversation)
def shared_info(data: ShareInput, conn=Depends(db)):
    share = lookup_share(conn, data.token)
    return conn.execute(
        "SELECT c.title,a.name AS agent_name FROM conversations c JOIN agents a ON a.id=c.agent_id WHERE c.id=%s",
        (share["conversation_id"],),
    ).fetchone()


@router.post("/api/public/shared/sessions", response_model=Session)
def shared_session(data: SharedSessionInput, request: Request, conn=Depends(db)):
    if request.headers.get("origin") not in (None, settings.public_url):
        raise HTTPException(403, "Open this conversation on its original website")
    share = lookup_share(conn, data.token)
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id=%s FOR UPDATE",
        (share["conversation_id"],),
    ).fetchone()
    share = lookup_share(conn, data.token)
    agent = conn.execute(
        "SELECT * FROM agents WHERE id=%s AND org_id=%s",
        (conv["agent_id"], conv["org_id"]),
    ).fetchone()
    result = open_session(
        conn,
        agent,
        conv["user_id"],
        data.mode,
        conv["visitor_id"],
        existing=conv,
        share_id=share["id"],
    )
    result["guest_token"] = data.token
    result["shared_access"] = True
    return result
