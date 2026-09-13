"""Authenticated image storage. No public bucket, executable uploads or embedded base64."""

from io import BytesIO
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from app.db import db
from app.storage import client
from app.security import current_user, membership
from app.form_schemas import RequestRecord
from app.request_domain import browser_conversation, owned_request, serialize

router = APIRouter(tags=["Request attachments"])
base = "/api/public/conversations/{cid}/requests/{rid}/files"
MAX_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000


def normalize_image(raw: bytes):
    try:
        with Image.open(BytesIO(raw)) as im:
            if (
                im.format not in ("JPEG", "PNG", "WEBP")
                or im.width * im.height > 20_000_000
            ):
                raise ValueError()
            im = ImageOps.exif_transpose(im)
            im.thumbnail((2400, 2400))
            output = BytesIO()
            im.convert("RGB").save(output, format="JPEG", quality=88)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(
            422, "Use a JPEG, PNG or WebP image up to 8 MB and 20 megapixels."
        )


@router.post(base, response_model=RequestRecord)
def upload(
    cid: UUID,
    rid: UUID,
    request: Request,
    field_id: str = Form(...),
    file: UploadFile = File(...),
    conn=Depends(db),
):
    row = owned_request(conn, browser_conversation(conn, cid, request), rid, lock=True)
    if row["status"] != "draft":
        raise HTTPException(409, "Submitted requests are read-only")
    if not any(
        f["id"] == field_id and f["kind"] == "images"
        for f in row["snapshot"]["definition"]["fields"]
    ):
        raise HTTPException(422, "Unknown image field")
    files = serialize(conn, row)["files"]
    if len(files) >= 20 or sum(f["field_id"] == field_id for f in files) >= 5:
        raise HTTPException(422, "Maximum 5 photos per field and 20 per request")
    raw = file.file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Each photo must be smaller than 8 MB")
    content = normalize_image(raw)
    fid = uuid4()
    key = f"{row['org_id']}/requests/{rid}/{fid}.jpg"
    s3 = client()
    try:
        s3.head_bucket(Bucket="elma")
    except s3.exceptions.ClientError:
        s3.create_bucket(Bucket="elma")
    s3.put_object(Bucket="elma", Key=key, Body=content, ContentType="image/jpeg")
    conn.execute(
        "INSERT INTO request_files(id,request_id,field_id,name,object_key,content_type,size) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (
            fid,
            rid,
            field_id,
            (file.filename or "Photo")[:150],
            key,
            "image/jpeg",
            len(content),
        ),
    )
    row = conn.execute(
        "UPDATE requests SET revision=revision+1,updated_at=now() WHERE id=%s RETURNING *",
        (rid,),
    ).fetchone()
    return serialize(conn, row)


def image_response(conn, rid, fid):
    row = conn.execute(
        "SELECT * FROM request_files WHERE id=%s AND request_id=%s", (fid, rid)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Photo not found")
    body = client().get_object(Bucket="elma", Key=row["object_key"])["Body"].read()
    return Response(
        body,
        media_type=row["content_type"],
        headers={"Cache-Control": "private, no-store", "Content-Disposition": "inline"},
    )


@router.get(base + "/{fid}")
def preview(cid: UUID, rid: UUID, fid: UUID, request: Request, conn=Depends(db)):
    owned_request(conn, browser_conversation(conn, cid, request), rid)
    return image_response(conn, rid, fid)


@router.post(base + "/{fid}/remove", response_model=RequestRecord)
def remove(cid: UUID, rid: UUID, fid: UUID, request: Request, conn=Depends(db)):
    row = owned_request(conn, browser_conversation(conn, cid, request), rid, lock=True)
    if row["status"] != "draft":
        raise HTTPException(409, "Submitted requests are read-only")
    conn.execute("DELETE FROM request_files WHERE id=%s AND request_id=%s", (fid, rid))
    # Object retained for the existing retention policy; it is no longer accessible through this request.
    row = conn.execute(
        "UPDATE requests SET revision=revision+1,updated_at=now() WHERE id=%s RETURNING *",
        (rid,),
    ).fetchone()
    return serialize(conn, row)


@router.get("/api/organizations/{org_id}/requests/{rid}/files/{fid}")
def staff_preview(
    org_id: UUID, rid: UUID, fid: UUID, user=Depends(current_user), conn=Depends(db)
):
    membership(conn, org_id, user)
    if not conn.execute(
        "SELECT id FROM requests WHERE id=%s AND org_id=%s AND deleted_at IS NULL AND status!='draft'",
        (rid, org_id),
    ).fetchone():
        raise HTTPException(404, "Request not found")
    return image_response(conn, rid, fid)
