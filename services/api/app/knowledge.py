from app.responses import Document, KnowledgeBase
import hashlib
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from app.db import db
from app.schemas import Named, DocumentInput
from app.security import current_user, membership
from app.storage import put_text, download_url

router = APIRouter(prefix="/api/organizations/{org_id}/knowledge", tags=["Knowledge"])


@router.get("", response_model=list[KnowledgeBase])
def listing(org_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    return conn.execute(
        "SELECT k.*,count(d.id) AS documents,count(d.id) FILTER(WHERE d.status='ready') AS ready FROM knowledge_bases k LEFT JOIN documents d ON d.kb_id=k.id AND d.org_id=k.org_id WHERE k.org_id=%s GROUP BY k.id ORDER BY k.created_at",
        (org_id,),
    ).fetchall()


@router.post("", response_model=KnowledgeBase)
def create(org_id: UUID, data: Named, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "INSERT INTO knowledge_bases(id,org_id,name) VALUES (%s,%s,%s) RETURNING *",
        (uuid4(), org_id, data.name),
    ).fetchone()
    return row


@router.get("/{kb_id}/documents", response_model=list[Document])
def documents(org_id: UUID, kb_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    return conn.execute(
        "SELECT id,name,status,error,created_at FROM documents WHERE org_id=%s AND kb_id=%s ORDER BY created_at DESC",
        (org_id, kb_id),
    ).fetchall()


@router.post("/{kb_id}/documents")
def upload(
    org_id: UUID,
    kb_id: UUID,
    data: DocumentInput,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    if not conn.execute(
        "SELECT 1 FROM knowledge_bases WHERE org_id=%s AND id=%s", (org_id, kb_id)
    ).fetchone():
        raise HTTPException(404, "Knowledge base not found")
    doc_id = uuid4()
    key = f"{org_id}/documents/{doc_id}.txt"
    put_text(key, data.text)
    conn.execute(
        "INSERT INTO documents(id,org_id,kb_id,name,object_key,body,checksum) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (
            doc_id,
            org_id,
            kb_id,
            data.name,
            key,
            data.text,
            hashlib.sha256(data.text.encode()).hexdigest(),
        ),
    )
    return {"id": doc_id, "status": "uploaded"}


@router.post("/documents/{doc_id}/retry")
def retry(org_id: UUID, doc_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    conn.execute(
        "UPDATE documents SET status='uploaded',error=NULL,attempts=0 WHERE org_id=%s AND id=%s AND status='failed'",
        (org_id, doc_id),
    )
    return {"ok": True}


@router.get("/documents/{doc_id}/download")
def download(org_id: UUID, doc_id: UUID, user=Depends(current_user), conn=Depends(db)):
    membership(conn, org_id, user, True)
    row = conn.execute(
        "SELECT object_key FROM documents WHERE org_id=%s AND id=%s", (org_id, doc_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    return {"url": download_url(row["object_key"])}
