from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from app.db import db
from app.security import internal
from app.schemas import MessageEvent, MetricEvent, SearchInput, CloseInput
from app.retrieval import retrieve
from app.billing import record

router = APIRouter(
    prefix="/api/internal", dependencies=[Depends(internal)], tags=["Worker"]
)


def conversation(conn, cid: UUID) -> dict:
    row = conn.execute("SELECT * FROM conversations WHERE id=%s", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Session not found")
    return row


@router.get("/conversations/{cid}")
def config(cid: UUID, conn=Depends(db)):
    row = conversation(conn, cid)
    conn.execute("UPDATE conversations SET status='active' WHERE id=%s", (cid,))
    return {
        "id": row["id"],
        "room_name": row["room_name"],
        "config": row["config"],
        "messages": conn.execute(
            "SELECT id,role,content FROM messages WHERE conversation_id=%s ORDER BY created_at,id",
            (cid,),
        ).fetchall(),
    }


@router.post("/conversations/{cid}/messages")
def message(cid: UUID, data: MessageEvent, conn=Depends(db)):
    conversation(conn, cid)
    conn.execute(
        "INSERT INTO messages(id,conversation_id,role,content) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
        (data.id, cid, data.role, data.content),
    )
    conn.execute(
        "UPDATE conversations SET last_event_at=now(),title=CASE WHEN title='New conversation' AND %s='user' THEN %s ELSE title END WHERE id=%s",
        (data.role, data.content[:100], cid),
    )
    return {"ok": True}


@router.post("/conversations/{cid}/search")
def search(cid: UUID, data: SearchInput, conn=Depends(db)):
    return {"sources": retrieve(conn, conversation(conn, cid), data.query)}


@router.post("/conversations/{cid}/metrics")
def metric(cid: UUID, data: MetricEvent, conn=Depends(db)):
    row = conversation(conn, cid)
    record(
        conn,
        row["org_id"],
        data.provider,
        data.event_id,
        data.operation,
        data.model,
        data.quantities,
        data.raw,
        row["agent_id"],
        cid,
    )
    return {"ok": True}


@router.post("/conversations/{cid}/close")
def close(cid: UUID, data: CloseInput, conn=Depends(db)):
    conn.execute(
        "UPDATE conversations SET status=%s,last_event_at=now() WHERE id=%s AND run_id IS NOT DISTINCT FROM %s",
        (data.status, cid, data.run_id),
    )
    return {"ok": True}
