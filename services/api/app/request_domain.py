"""Request lifecycle and access rules shared by browser and agent endpoints."""

from uuid import uuid4
from fastapi import HTTPException, Request
from psycopg.types.json import Jsonb
from app.security import current_user, digest
from app.settings import settings
from app.form_schemas import Definition, validate_answers


def browser_conversation(conn, cid, request: Request):
    row = conn.execute("SELECT * FROM conversations WHERE id=%s", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found")
    token = request.headers.get("x-guest-token", "")
    if token:
        if not row["user_id"] and row["guest_hash"] == digest(token):
            return row
        from app.share_access import lookup_share

        share = lookup_share(conn, token)
        if share["conversation_id"] != row["id"]:
            raise HTTPException(403, "Conversation access denied")
        return {**row, "shared_access": True}
    if row["user_id"]:
        if request.method != "GET" and request.headers.get("origin") not in (
            None,
            settings.public_url,
        ):
            raise HTTPException(403, "Origin not allowed")
        if current_user(request, conn)["id"] != row["user_id"]:
            raise HTTPException(403, "Conversation access denied")
    else:
        raise HTTPException(403, "Guest access denied")
    return row


def visible_forms(conn, conv):
    return conn.execute(
        "SELECT f.* FROM form_templates f JOIN agents a ON a.org_id=f.org_id AND f.id=ANY(a.form_ids) WHERE a.id=%s AND a.org_id=%s ORDER BY f.created_at",
        (conv["agent_id"], conv["org_id"]),
    ).fetchall()


def owned_request(conn, conv, rid, *, lock=False, agent=False):
    row = conn.execute(
        "SELECT * FROM requests WHERE id=%s AND org_id=%s AND deleted_at IS NULL"
        + (" FOR UPDATE" if lock else ""),
        (rid, conv["org_id"]),
    ).fetchone()
    allowed = row and (
        (row["conversation_id"] == conv["id"] or row["id"] == conv["active_request_id"])
        if agent or conv.get("shared_access")
        else (
            row["user_id"] == conv["user_id"]
            if conv["user_id"]
            else (
                row["visitor_id"] == conv["visitor_id"]
                if conv["visitor_id"]
                else row["conversation_id"] == conv["id"]
            )
        )
    )
    if not allowed:
        raise HTTPException(404, "Request not found")
    return row


def serialize(conn, row):
    files = conn.execute(
        "SELECT id,field_id,name,content_type,size FROM request_files WHERE request_id=%s ORDER BY created_at",
        (row["id"],),
    ).fetchall()
    events = conn.execute(
        "SELECT actor,status,created_at FROM request_events WHERE request_id=%s ORDER BY created_at,id",
        (row["id"],),
    ).fetchall()
    keys = (
        "id",
        "code",
        "org_id",
        "form_id",
        "form_version",
        "snapshot",
        "conversation_id",
        "answers",
        "revision",
        "status",
        "created_at",
        "updated_at",
        "submitted_at",
    )
    return {**{k: row[k] for k in keys}, "files": files, "events": events}


def open_draft(conn, conv, fid, *, agent=False):
    # Serialize repeated tool calls / double clicks before checking for an existing draft.
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id=%s FOR UPDATE", (conv["id"],)
    ).fetchone()
    form = next((f for f in visible_forms(conn, conv) if f["id"] == fid), None)
    if not form:
        raise HTTPException(403, "This form is not assigned to the agent")
    if agent and conv["active_request_id"]:
        active = owned_request(conn, conv, conv["active_request_id"], agent=True)
        if active["status"] != "draft":
            raise HTTPException(
                409,
                "The selected request is already submitted and read-only. Do not create a replacement; ask the user to start a new request explicitly.",
            )
        if active["form_id"] != fid:
            raise HTTPException(
                409,
                "A different request is selected. Read active-request and use its form, or ask the user to change the selection.",
            )
        if fid not in {f["id"] for f in visible_forms(conn, conv)}:
            raise HTTPException(403, "Form access revoked")
        return serialize(conn, active)
    row = conn.execute(
        "SELECT * FROM requests WHERE conversation_id=%s AND form_id=%s AND status='draft' AND deleted_at IS NULL",
        (conv["id"], fid),
    ).fetchone()
    if not row:
        snapshot = {
            k: form[k] for k in ("name", "description", "definition", "version")
        }
        row = conn.execute(
            "INSERT INTO requests(id,org_id,form_id,form_version,snapshot,conversation_id,user_id,visitor_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                uuid4(),
                conv["org_id"],
                fid,
                form["version"],
                Jsonb(snapshot),
                conv["id"],
                conv["user_id"],
                conv["visitor_id"],
            ),
        ).fetchone()
    conn.execute(
        "UPDATE conversations SET active_request_id=%s,selection_version=selection_version+1 WHERE id=%s",
        (row["id"], conv["id"]),
    )
    return serialize(conn, row)


def edit_draft(conn, row, patch, *, actor="customer"):
    if row["status"] != "draft":
        raise HTTPException(409, "Submitted requests are read-only")
    if row["revision"] != patch.revision:
        raise HTTPException(
            409, "This form was updated. Review the latest values before saving."
        )
    merged = {**row["answers"], **patch.answers}
    try:
        validate_answers(
            Definition.model_validate(row["snapshot"]["definition"]), merged
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    row = conn.execute(
        "UPDATE requests SET answers=%s,revision=revision+1,updated_at=now() WHERE id=%s RETURNING *",
        (Jsonb(merged), row["id"]),
    ).fetchone()
    return serialize(conn, row)


def change_status(conn, row, status, actor):
    previous = row["status"]
    if previous == status:
        return serialize(conn, row)
    row = conn.execute(
        "UPDATE requests SET status=%s,revision=revision+1,updated_at=now(),submitted_at=CASE WHEN %s='submitted' AND submitted_at IS NULL THEN now() ELSE submitted_at END WHERE id=%s RETURNING *",
        (status, status, row["id"]),
    ).fetchone()
    conn.execute(
        "INSERT INTO request_events(id,request_id,actor,status) VALUES (%s,%s,%s,%s)",
        (uuid4(), row["id"], actor, status),
    )
    return serialize(conn, row)
