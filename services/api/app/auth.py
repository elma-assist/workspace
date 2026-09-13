from app.responses import User
import secrets
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from psycopg.errors import UniqueViolation
from app.db import db
from app.schemas import Credentials, Registration, AcceptInvite
from app.security import current_user, digest, hasher, verify
from app.settings import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def issue_session(conn, response: Response, user_id) -> None:
    token = secrets.token_urlsafe(40)
    conn.execute(
        "INSERT INTO auth_sessions VALUES (%s,%s,now()+interval '7 days')",
        (digest(token), user_id),
    )
    # Make the session visible before the browser follows the login response.
    # Yield-dependency cleanup can otherwise commit after the next request starts.
    conn.commit()
    response.set_cookie(
        "elma_session",
        token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=604800,
    )


@router.post("/register", response_model=User)
def register(data: Registration, response: Response, conn=Depends(db)):
    user_id = uuid4()
    try:
        conn.execute(
            "INSERT INTO users(id,email,name,password_hash) VALUES (%s,%s,%s,%s)",
            (user_id, str(data.email).lower(), data.name, hasher.hash(data.password)),
        )
    except UniqueViolation:
        raise HTTPException(409, "An account already exists")
    issue_session(conn, response, user_id)
    return {"id": user_id, "name": data.name, "email": data.email}


@router.post("/login", response_model=User)
def login(data: Credentials, response: Response, conn=Depends(db)):
    user = conn.execute(
        "SELECT * FROM users WHERE email=%s", (str(data.email).lower(),)
    ).fetchone()
    if not user or not verify(data.password, user["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    issue_session(conn, response, user["id"])
    return {k: user[k] for k in ("id", "name", "email")}


@router.get("/me", response_model=User)
def me(user=Depends(current_user)):
    return user


@router.post("/logout")
def logout(request: Request, response: Response, conn=Depends(db)):
    conn.execute(
        "DELETE FROM auth_sessions WHERE token_hash=%s",
        (digest(request.cookies.get("elma_session", "")),),
    )
    response.delete_cookie("elma_session")
    return {"ok": True}


@router.post("/accept")
def accept(data: AcceptInvite, response: Response, conn=Depends(db)):
    invite = conn.execute(
        "SELECT * FROM invitations WHERE token_hash=%s AND accepted_at IS NULL AND expires_at>now() FOR UPDATE",
        (digest(data.token),),
    ).fetchone()
    if not invite:
        raise HTTPException(400, "Invitation expired or already used")
    user = conn.execute(
        "SELECT * FROM users WHERE email=%s", (invite["email"],)
    ).fetchone()
    if user and not verify(data.password, user["password_hash"]):
        raise HTTPException(401, "Use your existing account password")
    user_id = user["id"] if user else uuid4()
    if not user:
        conn.execute(
            "INSERT INTO users(id,email,name,password_hash) VALUES (%s,%s,%s,%s)",
            (user_id, invite["email"], invite["name"], hasher.hash(data.password)),
        )
    conn.execute(
        "INSERT INTO memberships VALUES (%s,%s,'employee') ON CONFLICT DO NOTHING",
        (invite["org_id"], user_id),
    )
    for agent_id in invite["agent_ids"]:
        conn.execute(
            "INSERT INTO agent_access VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
            (invite["org_id"], agent_id, user_id),
        )
    conn.execute(
        "UPDATE invitations SET accepted_at=now() WHERE id=%s", (invite["id"],)
    )
    issue_session(conn, response, user_id)
    return {"ok": True}
