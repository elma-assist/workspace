import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app import auth, organizations, agents, knowledge, conversations, internal, billing
from app import (
    usage_export,
    forms,
    requests as request_routes,
    request_files,
    active_request,
    sharing,
)
from app.db import pool
from app.settings import settings
from app.seed import stable


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    pool.wait()
    yield
    pool.close()


app = FastAPI(
    title="Elma API",
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url=None,
)
for router in (
    auth.router,
    organizations.router,
    agents.router,
    knowledge.router,
    sharing.router,
    conversations.router,
    internal.router,
    billing.router,
    usage_export.router,
    forms.router,
    request_routes.router,
    request_files.router,
    active_request.router,
):
    app.include_router(router)

requests: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def boundary(request: Request, call_next):
    path = request.url.path
    origin = request.headers.get("origin")
    public = path.startswith("/api/public/")
    if request.method == "OPTIONS" and public:
        return JSONResponse(
            {},
            headers={
                "Access-Control-Allow-Origin": origin or "null",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Guest-Token, X-Visitor-Token",
                "Vary": "Origin",
            },
        )
    if (
        request.method not in {"GET", "HEAD", "OPTIONS"}
        and not public
        and not path.startswith("/api/internal/")
    ):
        if origin and origin != settings.public_url:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    if path.startswith(("/api/auth/", "/api/public/")) and request.method == "POST":
        key = (
            request.headers.get("x-forwarded-for")
            or (request.client.host if request.client else "unknown")
        ) + path
        times = requests[key]
        now = time.monotonic()
        while times and times[0] < now - 60:
            times.popleft()
        if len(times) >= 20:
            return JSONResponse(
                {"detail": "Please wait before trying again"}, status_code=429
            )
        times.append(now)
    response = await call_next(request)
    response.headers["X-Request-ID"] = str(uuid4())
    response.headers["X-Content-Type-Options"] = "nosniff"
    if public:
        response.headers["Cache-Control"] = "no-store"
    if public and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    return response


@app.get("/api/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.get("/api/demo")
def demo():
    return {"publication_id": str(stable("publication")), "name": "Emma"}
