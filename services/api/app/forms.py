from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from app.db import db
from app.security import current_user, membership
from app.form_schemas import FormInput, FormTemplate

router = APIRouter(prefix="/api/organizations/{org_id}/forms", tags=["Forms"])


@router.get("", response_model=list[FormTemplate])
def listing(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    return conn.execute(
        "SELECT * FROM form_templates WHERE org_id=%s ORDER BY created_at", (org_id,)
    ).fetchall()


@router.post("", response_model=FormTemplate)
def create(org_id: UUID, data: FormInput, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    return conn.execute(
        "INSERT INTO form_templates(id,org_id,name,description,definition) VALUES (%s,%s,%s,%s,%s) RETURNING *",
        (
            uuid4(),
            org_id,
            data.name,
            data.description,
            Jsonb(data.definition.model_dump()),
        ),
    ).fetchone()


@router.put("/{fid}", response_model=FormTemplate)
def update(
    org_id: UUID,
    fid: UUID,
    data: FormInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "UPDATE form_templates SET name=%s,description=%s,definition=%s,version=version+1 WHERE id=%s AND org_id=%s AND version=%s RETURNING *",
        (
            data.name,
            data.description,
            Jsonb(data.definition.model_dump()),
            fid,
            org_id,
            data.version,
        ),
    ).fetchone()
    if not row:
        raise HTTPException(409, "Form changed. Reopen it before saving.")
    return row
