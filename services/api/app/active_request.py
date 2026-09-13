"""Persist the user's selected request, and serialize selection against agent edits."""

from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from app.db import db
from app.security import internal
from app.schemas import Contract
from app.form_schemas import RequestRecord
from app.request_domain import (
    browser_conversation,
    owned_request,
    serialize,
    visible_forms,
)
from app.internal import conversation


class SelectionInput(Contract):
    request_id: UUID | None


class SelectionState(Contract):
    version: int
    request: RequestRecord | None


router = APIRouter(tags=["Active request"])


def state(conn, conv):
    row = (
        conn.execute(
            "SELECT * FROM requests WHERE id=%s AND org_id=%s AND deleted_at IS NULL",
            (conv["active_request_id"], conv["org_id"]),
        ).fetchone()
        if conv["active_request_id"]
        else None
    )
    return {
        "version": conv["selection_version"],
        "request": serialize(conn, row) if row else None,
    }


@router.get(
    "/api/public/conversations/{cid}/active-request", response_model=SelectionState
)
def read(cid: UUID, request: Request, conn=Depends(db)):
    return state(conn, browser_conversation(conn, cid, request))


@router.post(
    "/api/public/conversations/{cid}/active-request", response_model=SelectionState
)
def select(cid: UUID, data: SelectionInput, request: Request, conn=Depends(db)):
    conv = browser_conversation(conn, cid, request)
    conn.execute("SELECT id FROM conversations WHERE id=%s FOR UPDATE", (cid,))
    if data.request_id:
        row = owned_request(conn, conv, data.request_id, lock=True)
        if row["form_id"] not in {f["id"] for f in visible_forms(conn, conv)}:
            raise HTTPException(403, "This form is no longer assigned to this agent")
    conv = conn.execute(
        "UPDATE conversations SET active_request_id=%s,selection_version=selection_version+1 WHERE id=%s RETURNING *",
        (data.request_id, cid),
    ).fetchone()
    return state(conn, conv)


@router.get(
    "/api/internal/conversations/{cid}/active-request",
    dependencies=[Depends(internal)],
    response_model=SelectionState,
)
def worker_read(cid: UUID, conn=Depends(db)):
    return state(conn, conversation(conn, cid))
