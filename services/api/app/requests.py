from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.db import db
from app.form_schemas import (
    AnswerPatch,
    ChangeStatus,
    Definition,
    DeletedRequest,
    FormTemplate,
    OpenForm,
    RequestRecord,
    SubmitRequest,
    validate_answers,
)
from app.internal import conversation
from app.request_domain import (
    browser_conversation,
    change_status,
    edit_draft,
    open_draft,
    owned_request,
    serialize,
    visible_forms,
)
from app.security import current_user, internal, membership
from app.storage import delete_objects

router = APIRouter(tags=["Requests"])
public = "/api/public/conversations/{cid}"
worker = "/api/internal/conversations/{cid}"
org_path = "/api/organizations/{org_id}/requests"


@router.get(public + "/forms", response_model=list[FormTemplate])
def forms(cid: UUID, request: Request, conn=Depends(db)):
    return visible_forms(conn, browser_conversation(conn, cid, request))


@router.get(public + "/requests", response_model=list[RequestRecord])
def listing(cid: UUID, request: Request, conn=Depends(db)):
    conv = browser_conversation(conn, cid, request)
    if conv.get("shared_access"):
        rows = conn.execute(
            "SELECT * FROM requests WHERE deleted_at IS NULL AND org_id=%s AND (conversation_id=%s OR id=%s) ORDER BY updated_at DESC LIMIT 200",
            (conv["org_id"], cid, conv["active_request_id"]),
        ).fetchall()
        return [serialize(conn, r) for r in rows]
    rows = conn.execute(
        "SELECT * FROM requests WHERE deleted_at IS NULL AND org_id=%s AND ((%s::uuid IS NOT NULL AND user_id=%s) OR (%s::uuid IS NOT NULL AND visitor_id=%s) OR conversation_id=%s) ORDER BY updated_at DESC LIMIT 200",
        (
            conv["org_id"],
            conv["user_id"],
            conv["user_id"],
            conv["visitor_id"],
            conv["visitor_id"],
            cid,
        ),
    ).fetchall()
    return [serialize(conn, r) for r in rows]


@router.post(public + "/requests", response_model=RequestRecord)
def create(cid: UUID, data: OpenForm, request: Request, conn=Depends(db)):
    return open_draft(conn, browser_conversation(conn, cid, request), data.form_id)


@router.delete(public + "/requests/{rid}", response_model=DeletedRequest)
def delete_draft(cid: UUID, rid: UUID, request: Request, conn=Depends(db)):
    conv = browser_conversation(conn, cid, request)
    owned_request(conn, conv, rid)
    # Match agent edit lock order: conversations first, then the request.
    conn.execute(
        "SELECT id FROM conversations WHERE org_id=%s AND (id=%s OR active_request_id=%s) ORDER BY id FOR UPDATE",
        (conv["org_id"], cid, rid),
    ).fetchall()
    row = owned_request(conn, conv, rid, lock=True)
    if row["status"] != "draft":
        raise HTTPException(409, "Only draft requests can be deleted")
    conn.execute(
        "UPDATE requests SET deleted_at=now(),updated_at=now(),revision=revision+1 WHERE id=%s",
        (rid,),
    )
    conn.execute(
        "UPDATE conversations SET active_request_id=NULL,selection_version=selection_version+1 WHERE active_request_id=%s",
        (rid,),
    )
    return {"id": rid, "code": row["code"], "deleted": True}


@router.post(public + "/requests/{rid}/answers", response_model=RequestRecord)
def patch(cid: UUID, rid: UUID, data: AnswerPatch, request: Request, conn=Depends(db)):
    row = owned_request(conn, browser_conversation(conn, cid, request), rid, lock=True)
    return edit_draft(conn, row, data)


@router.post(public + "/requests/{rid}/submit", response_model=RequestRecord)
def submit(
    cid: UUID, rid: UUID, data: SubmitRequest, request: Request, conn=Depends(db)
):
    row = owned_request(conn, browser_conversation(conn, cid, request), rid, lock=True)
    if row["status"] != "draft":
        return serialize(
            conn, row
        )  # An acknowledgement can be lost; retries never create duplicates.
    if row["revision"] != data.revision:
        raise HTTPException(409, "Form updated. Review it before submitting.")
    result = serialize(conn, row)
    try:
        validate_answers(
            Definition.model_validate(row["snapshot"]["definition"]),
            row["answers"],
            complete=True,
            files=result["files"],
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    return change_status(conn, row, "submitted", "Customer")


@router.get(org_path, response_model=list[RequestRecord])
def organization_requests(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user)
    rows = conn.execute(
        "SELECT * FROM requests WHERE org_id=%s AND deleted_at IS NULL AND status!='draft' ORDER BY created_at DESC LIMIT 200",
        (org_id,),
    ).fetchall()
    return [serialize(conn, r) for r in rows]


@router.post(org_path + "/{rid}/status", response_model=RequestRecord)
def status(
    org_id: UUID,
    rid: UUID,
    data: ChangeStatus,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user)
    row = conn.execute(
        "SELECT * FROM requests WHERE org_id=%s AND id=%s AND deleted_at IS NULL AND status!='draft' FOR UPDATE",
        (org_id, rid),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Request not found")
    if row["revision"] != data.revision:
        raise HTTPException(409, "Status changed. Refresh this request.")
    return change_status(conn, row, data.status, user["name"])


@router.delete(org_path + "/{rid}", response_model=DeletedRequest)
def admin_delete_request(
    org_id: UUID,
    rid: UUID,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "SELECT * FROM requests WHERE org_id=%s AND id=%s AND deleted_at IS NULL FOR UPDATE",
        (org_id, rid),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Request not found")
    file_rows = conn.execute(
        "SELECT object_key FROM request_files WHERE request_id=%s", (rid,)
    ).fetchall()
    conn.execute(
        "UPDATE conversations SET active_request_id=NULL,selection_version=selection_version+1 WHERE active_request_id=%s",
        (rid,),
    )
    conn.execute("DELETE FROM request_events WHERE request_id=%s", (rid,))
    conn.execute("DELETE FROM request_files WHERE request_id=%s", (rid,))
    conn.execute("DELETE FROM requests WHERE id=%s", (rid,))
    delete_objects([item["object_key"] for item in file_rows])
    return {"id": rid, "code": row["code"], "deleted": True}


@router.get(
    worker + "/forms",
    dependencies=[Depends(internal)],
    response_model=list[FormTemplate],
)
def agent_forms(cid: UUID, conn=Depends(db)):
    return visible_forms(conn, conversation(conn, cid))


@router.get(
    worker + "/requests",
    dependencies=[Depends(internal)],
    response_model=list[RequestRecord],
)
def agent_requests(cid: UUID, conn=Depends(db)):
    rows = conn.execute(
        "SELECT * FROM requests WHERE deleted_at IS NULL AND (conversation_id=%s OR id=(SELECT active_request_id FROM conversations WHERE id=%s)) ORDER BY updated_at DESC",
        (cid, cid),
    ).fetchall()
    return [serialize(conn, r) for r in rows]


@router.post(
    worker + "/requests", dependencies=[Depends(internal)], response_model=RequestRecord
)
def agent_open(cid: UUID, data: OpenForm, conn=Depends(db)):
    return open_draft(conn, conversation(conn, cid), data.form_id, agent=True)


@router.post(
    worker + "/requests/{rid}/answers",
    dependencies=[Depends(internal)],
    response_model=RequestRecord,
)
def agent_patch(cid: UUID, rid: UUID, data: AnswerPatch, conn=Depends(db)):
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id=%s FOR UPDATE", (cid,)
    ).fetchone()
    if not conv or conv["active_request_id"] != rid:
        raise HTTPException(
            409,
            "The active request changed. Read the current selection before filling.",
        )
    row = owned_request(conn, conv, rid, lock=True, agent=True)
    if row["form_id"] not in {f["id"] for f in visible_forms(conn, conv)}:
        raise HTTPException(403, "Form access revoked")
    return edit_draft(conn, row, data, actor="agent")
