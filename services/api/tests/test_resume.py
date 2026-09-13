from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from psycopg.types.json import Jsonb
from app.db import connect
from app.settings import settings
from test_forms import setup


def fake_livekit():
    sdk = MagicMock()
    sdk.room.create_room = AsyncMock()
    sdk.room.delete_room = AsyncMock()
    sdk.agent_dispatch.create_dispatch = AsyncMock()
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=sdk)
    context.__aexit__ = AsyncMock(return_value=False)
    return context


def test_resume_same_conversation_requires_visitor_secret_and_fences_old_run(setup):
    c, base, form, public, cid, agent = setup
    org = base.split("/")[-1]
    pub = str(uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO publications(id,org_id,agent_id,enabled,origins) VALUES (%s,%s,%s,true,%s)",
            (pub, org, agent, [settings.public_url]),
        )
    c.cookies.clear()
    path = f"/api/public/{pub}/sessions"
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        first = c.post(path, headers={"Origin": settings.public_url}, json={}).json()
        p = f"/api/public/conversations/{first['id']}"
        draft = c.post(
            p + "/requests",
            headers={"X-Guest-Token": first["guest_token"]},
            json={"form_id": form["id"]},
        ).json()
        with connect() as conn:
            run = conn.execute(
                "SELECT run_id FROM conversations WHERE id=%s", (first["id"],)
            ).fetchone()["run_id"]
            conn.execute(
                "INSERT INTO messages(id,conversation_id,role,content) VALUES (%s,%s,'user','My reference is emerald bicycle')",
                (str(uuid4()), first["id"]),
            )
        r = c.post(
            path,
            headers={
                "Origin": settings.public_url,
                "X-Visitor-Token": first["visitor_token"],
            },
            json={"conversation_id": first["id"]},
        )
        assert r.status_code == 200, r.text
        resumed = r.json()
        assert resumed["id"] == first["id"] and resumed["resumed"]
        assert resumed["messages"][0]["content"] == "My reference is emerald bicycle"
        assert resumed["token"] != first["token"]
        headers = {"X-Guest-Token": resumed["guest_token"]}
        assert (
            c.get(p + "/active-request", headers=headers).json()["request"]["id"]
            == draft["id"]
        )
        assert len(c.get(p + "/requests", headers=headers).json()) == 1
        assert (
            c.post(
                path,
                headers={"Origin": settings.public_url},
                json={"conversation_id": first["id"]},
            ).status_code
            == 403
        )
        service = {"x-service-secret": settings.service_secret}
        assert (
            c.post(
                f"/api/internal/conversations/{first['id']}/close",
                headers=service,
                json={"status": "completed", "run_id": str(run)},
            ).status_code
            == 200
        )
        with connect() as conn:
            assert (
                conn.execute(
                    "SELECT status FROM conversations WHERE id=%s", (first["id"],)
                ).fetchone()["status"]
                == "connecting"
            )
        assert (
            c.get(
                f"/api/internal/conversations/{first['id']}",
                headers={**service, "x-conversation-run": str(run)},
            ).status_code
            == 409
        )


def test_deleted_public_conversation_starts_fresh_with_saved_visitor(setup):
    c, base, form, public, cid, agent = setup
    org = base.split("/")[-1]
    pub = str(uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO publications(id,org_id,agent_id,enabled,origins) VALUES (%s,%s,%s,true,%s)",
            (pub, org, agent, [settings.public_url]),
        )
    c.cookies.clear()
    path = f"/api/public/{pub}/sessions"
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        first = c.post(path, headers={"Origin": settings.public_url}, json={}).json()
        with connect() as conn:
            conn.execute("DELETE FROM conversations WHERE id=%s", (first["id"],))
        resumed = c.post(
            path,
            headers={
                "Origin": settings.public_url,
                "X-Visitor-Token": first["visitor_token"],
            },
            json={"conversation_id": first["id"]},
        )
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["id"] != first["id"]
        assert resumed.json()["resumed"] is False


def test_selected_older_draft_is_agent_target_and_stale_write_is_rejected(setup):
    c, base, form, public, cid, agent = setup
    first = c.post(public + "/requests", json={"form_id": form["id"]}).json()
    other = str(uuid4())
    with connect() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id=%s", (cid,)).fetchone()
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,user_id,config,room_name) VALUES (%s,%s,%s,%s,%s,%s)",
            (other, row["org_id"], agent, row["user_id"], Jsonb({}), other),
        )
    second = c.post(
        f"/api/public/conversations/{other}/requests", json={"form_id": form["id"]}
    ).json()
    service = {"x-service-secret": settings.service_secret}
    wp = f"/api/internal/conversations/{cid}"
    selected = c.post(public + "/active-request", json={"request_id": second["id"]})
    assert selected.status_code == 200, selected.text
    assert (
        c.post(wp + "/requests", headers=service, json={"form_id": form["id"]}).json()[
            "id"
        ]
        == second["id"]
    )
    assert (
        c.post(
            wp + "/requests/" + second["id"] + "/answers",
            headers=service,
            json={"revision": 1, "answers": {"name": "Selected draft"}},
        ).status_code
        == 200
    )
    assert (
        c.post(
            wp + "/requests/" + first["id"] + "/answers",
            headers=service,
            json={"revision": 1, "answers": {"name": "Wrong target"}},
        ).status_code
        == 409
    )
    assert (
        c.post(
            public + "/active-request", json={"request_id": str(uuid4())}
        ).status_code
        == 404
    )
    with connect() as conn:
        assert (
            conn.execute(
                "SELECT answers FROM requests WHERE id=%s", (first["id"],)
            ).fetchone()["answers"]
            == {}
        )
        conn.execute(
            "UPDATE requests SET status='submitted' WHERE id=%s", (second["id"],)
        )
    assert (
        c.post(
            wp + "/requests", headers=service, json={"form_id": form["id"]}
        ).status_code
        == 409
    )
    assert len(c.get(public + "/requests").json()) == 2


def test_signed_in_agent_resumes_own_latest_history(setup):
    c, base, form, public, cid, agent = setup
    with connect() as conn:
        conn.execute(
            "INSERT INTO messages(id,conversation_id,role,content) VALUES (%s,%s,'user','Continue my saved conversation')",
            (str(uuid4()), cid),
        )
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        result = c.post(base + f"/agents/{agent}/sessions", json={})
        assert result.status_code == 200
        assert result.json()["id"] == cid
        assert result.json()["resumed"]
        assert (
            result.json()["messages"][0]["content"] == "Continue my saved conversation"
        )
        denied = c.post(
            base + f"/agents/{agent}/sessions", json={"conversation_id": str(uuid4())}
        )
        assert denied.status_code == 403


def test_worker_guard_does_not_block_independent_usage_transaction(setup):
    from app.billing import record

    c, base, form, public, cid, agent = setup
    run = uuid4()
    with connect() as conn:
        conn.execute("UPDATE conversations SET run_id=%s WHERE id=%s", (run, cid))

    def retrieve_with_usage(conn, conv, query):
        # Retrieval bills through a separate connection: its FK check must not
        # wait for the request's own lock on the parent conversation.
        with connect() as billing:
            billing.execute("SET LOCAL statement_timeout='2s'")
            record(
                billing,
                conv["org_id"],
                "openrouter",
                str(uuid4()),
                "embedding",
                settings.embedding_model,
                {"prompt_tokens": 1},
                {},
                agent,
                cid,
            )
        return []

    with patch("app.internal.retrieve", side_effect=retrieve_with_usage):
        result = c.post(
            f"/api/internal/conversations/{cid}/search",
            headers={
                "x-service-secret": settings.service_secret,
                "x-conversation-run": str(run),
            },
            json={"query": "meeting"},
        )
    assert result.status_code == 200
