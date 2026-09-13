import json
import secrets
from datetime import timedelta
from uuid import UUID, uuid4

from anyio import from_thread
from fastapi import APIRouter, Depends, HTTPException, Request
from livekit import api
from psycopg.types.json import Jsonb

from app.db import db
from app.responses import DeletedConversation, Detail, History, Session
from app.schemas import SessionInput
from app.security import agent_permission, current_user, digest, membership
from app.settings import settings
from app.storage import delete_objects

router = APIRouter(tags=["Conversations"])

# psycopg is synchronous. Session endpoints and their transactions run in FastAPI's
# worker threads so a row-lock wait cannot block other requests or dependency commits.
# Only LiveKit's asynchronous network calls are scheduled on the event loop.


async def dispatch_session(
    room: str, cid: UUID, run_id: UUID, existing: dict | None
) -> None:
    async with api.LiveKitAPI(
        settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret
    ) as lk:
        if existing:
            try:
                await lk.room.delete_room(
                    api.DeleteRoomRequest(room=existing["room_name"])
                )
            except api.TwirpError as exc:
                if exc.code != "not_found":
                    raise
        await lk.room.create_room(
            api.CreateRoomRequest(name=room, empty_timeout=120, max_participants=2)
        )
        await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                room=room,
                agent_name="elma-agent",
                metadata=json.dumps(
                    {"conversation_id": str(cid), "run_id": str(run_id)}
                ),
            )
        )


def open_session(
    conn,
    agent: dict,
    user_id,
    mode: str,
    visitor_id=None,
    visitor_token=None,
    existing=None,
    share_id=None,
) -> dict:
    cid = existing["id"] if existing else uuid4()
    run_id = uuid4()
    room = f"elma-{cid}-{run_id}"
    guest = secrets.token_urlsafe(32) if user_id is None else None
    config = {
        **agent["config"],
        "name": agent["name"],
        "instruction": agent["instruction"],
        "kb_ids": [str(i) for i in agent["kb_ids"]],
        "version": agent["version"],
        "mode": mode,
    }
    if existing:
        conn.execute(
            "UPDATE conversations SET room_name=%s,run_id=%s,guest_hash=%s,config=%s,status='connecting',run_share_id=%s WHERE id=%s",
            (
                room,
                run_id,
                digest(guest) if guest else None,
                Jsonb(config),
                share_id,
                cid,
            ),
        )
    else:
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,user_id,guest_hash,config,room_name,visitor_id,run_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                cid,
                agent["org_id"],
                agent["id"],
                user_id,
                digest(guest) if guest else None,
                Jsonb(config),
                room,
                visitor_id,
                run_id,
            ),
        )
    conn.commit()
    try:
        from_thread.run(dispatch_session, room, cid, run_id, existing)
    except Exception:
        conn.execute(
            "UPDATE conversations SET status='error' WHERE id=%s AND run_id=%s",
            (cid, run_id),
        )
        conn.commit()
        raise HTTPException(503, "Voice service unavailable. Please try again.")
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(f"user-{cid}")
        .with_name("Visitor" if guest else "Member")
        .with_ttl(timedelta(minutes=30))
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .to_jwt()
    )
    return {
        "id": cid,
        "token": token,
        "url": settings.livekit_public_url,
        "guest_token": guest,
        "visitor_token": visitor_token,
        "agent_name": agent["name"],
        "agent_description": agent["description"],
        "mode": mode,
        "resumed": bool(existing),
        "messages": read_conversation(conn, cid)["messages"],
    }


@router.post(
    "/api/organizations/{org_id}/agents/{agent_id}/sessions", response_model=Session
)
def create(
    org_id: UUID,
    agent_id: UUID,
    data: SessionInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    agent = agent_permission(conn, org_id, agent_id, user)
    existing = None
    if data.conversation_id:
        existing = conn.execute(
            "SELECT * FROM conversations WHERE id=%s AND org_id=%s AND agent_id=%s AND user_id=%s FOR UPDATE",
            (data.conversation_id, org_id, agent_id, user["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(403, "Conversation access denied")
    if not data.conversation_id:
        existing = conn.execute(
            "SELECT * FROM conversations WHERE org_id=%s AND agent_id=%s AND user_id=%s ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
            (org_id, agent_id, user["id"]),
        ).fetchone()
    return open_session(conn, agent, user["id"], data.mode, existing=existing)


@router.get("/api/organizations/{org_id}/conversations", response_model=list[History])
def listing(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user)
    return conn.execute(
        "SELECT c.id,c.title,c.status,c.created_at,a.name AS agent_name,u.name AS user_name FROM conversations c JOIN agents a ON a.id=c.agent_id LEFT JOIN users u ON u.id=c.user_id WHERE c.org_id=%s ORDER BY c.created_at DESC LIMIT 100",
        (org_id,),
    ).fetchall()


def read_conversation(conn, cid: UUID) -> dict:
    row = conn.execute(
        "SELECT id,title,status,org_id FROM conversations WHERE id=%s", (cid,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found")
    row["messages"] = conn.execute(
        "SELECT id,role,content,created_at FROM messages WHERE conversation_id=%s ORDER BY created_at,id",
        (cid,),
    ).fetchall()
    row["sources"] = conn.execute(
        "SELECT name,excerpt,score FROM sources WHERE conversation_id=%s ORDER BY created_at DESC LIMIT 8",
        (cid,),
    ).fetchall()
    return row


@router.get("/api/organizations/{org_id}/conversations/{cid}", response_model=Detail)
def detail(org_id: UUID, cid: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user)
    if not conn.execute(
        "SELECT 1 FROM conversations WHERE org_id=%s AND id=%s", (org_id, cid)
    ).fetchone():
        raise HTTPException(404, "Conversation not found")
    return read_conversation(conn, cid)


@router.delete(
    "/api/organizations/{org_id}/conversations/{cid}",
    response_model=DeletedConversation,
)
def delete_conversation(
    org_id: UUID,
    cid: UUID,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "SELECT id FROM conversations WHERE org_id=%s AND id=%s FOR UPDATE",
        (org_id, cid),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found")
    file_rows = conn.execute(
        "SELECT rf.object_key FROM request_files rf JOIN requests r ON r.id=rf.request_id WHERE r.conversation_id=%s",
        (cid,),
    ).fetchall()
    conn.execute(
        "UPDATE conversations SET active_request_id=NULL,run_share_id=NULL WHERE id=%s",
        (cid,),
    )
    conn.execute(
        "DELETE FROM request_events WHERE request_id IN (SELECT id FROM requests WHERE conversation_id=%s)",
        (cid,),
    )
    conn.execute(
        "DELETE FROM request_files WHERE request_id IN (SELECT id FROM requests WHERE conversation_id=%s)",
        (cid,),
    )
    conn.execute("DELETE FROM requests WHERE conversation_id=%s", (cid,))
    conn.execute("DELETE FROM messages WHERE conversation_id=%s", (cid,))
    conn.execute("DELETE FROM sources WHERE conversation_id=%s", (cid,))
    conn.execute(
        "UPDATE usage_ledger SET conversation_id=NULL WHERE conversation_id=%s", (cid,)
    )
    conn.execute("DELETE FROM conversation_shares WHERE conversation_id=%s", (cid,))
    conn.execute("DELETE FROM conversations WHERE id=%s", (cid,))
    delete_objects([item["object_key"] for item in file_rows])
    return {"id": cid, "deleted": True}


@router.post("/api/public/{publication_id}/sessions", response_model=Session)
def guest_session(
    publication_id: UUID, data: SessionInput, request: Request, conn=Depends(db)
):
    pub = conn.execute(
        "SELECT * FROM publications WHERE id=%s AND enabled=true", (publication_id,)
    ).fetchone()
    if not pub or request.headers.get("origin") not in [
        settings.public_url,
        *pub["origins"],
    ]:
        raise HTTPException(403, "Widget is not published for this website")
    agent = conn.execute(
        "SELECT * FROM agents WHERE org_id=%s AND id=%s",
        (pub["org_id"], pub["agent_id"]),
    ).fetchone()
    token = request.headers.get("x-visitor-token", "")
    visitor = (
        conn.execute(
            "SELECT id FROM visitors WHERE publication_id=%s AND token_hash=%s",
            (publication_id, digest(token)),
        ).fetchone()
        if token
        else None
    )
    if not visitor:
        token = secrets.token_urlsafe(32)
        visitor = conn.execute(
            "INSERT INTO visitors(id,publication_id,token_hash) VALUES (%s,%s,%s) RETURNING id",
            (uuid4(), publication_id, digest(token)),
        ).fetchone()
    existing = None
    if data.conversation_id:
        existing = conn.execute(
            "SELECT * FROM conversations WHERE id=%s AND org_id=%s AND agent_id=%s AND visitor_id=%s FOR UPDATE",
            (data.conversation_id, pub["org_id"], agent["id"], visitor["id"]),
        ).fetchone()
        if (
            not existing
            and conn.execute(
                "SELECT 1 FROM conversations WHERE id=%s", (data.conversation_id,)
            ).fetchone()
        ):
            raise HTTPException(403, "Conversation access denied")
    if not existing:
        # Upgrade existing visitors who already have a saved guest secret but no saved conversation ID.
        existing = conn.execute(
            "SELECT * FROM conversations WHERE visitor_id=%s AND agent_id=%s ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
            (visitor["id"], agent["id"]),
        ).fetchone()
    return open_session(
        conn, agent, None, data.mode, visitor["id"], token, existing=existing
    )


@router.get("/api/public/conversations/{cid}", response_model=Detail)
def guest_detail(cid: UUID, request: Request, conn=Depends(db)):
    from app.request_domain import browser_conversation

    browser_conversation(conn, cid, request)
    return read_conversation(conn, cid)
