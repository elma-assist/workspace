from uuid import uuid4
from unittest.mock import patch
from psycopg.types.json import Jsonb
from test_forms import setup
from test_resume import fake_livekit
from app.db import connect
from app.settings import settings


def publish(c, base, agent):
    r = c.put(
        base + f"/agents/{agent}/publication", json={"enabled": True, "origins": []}
    )
    assert r.status_code == 200
    return r.json()


def test_public_agent_link_creates_separate_visitors_without_embed_origins(setup):
    c, base, form, public, cid, agent = setup
    pub = publish(c, base, agent)
    slug_path = pub["url"].split("/a/", 1)[1]
    assert slug_path.endswith("/test")
    assert (
        c.get("/api/public/agents/" + slug_path).json()["publication_id"] == pub["id"]
    )
    info = c.get("/api/public/widgets/" + pub["id"])
    assert info.status_code == 200
    assert set(info.json()) == {"name", "description", "publication_id"}
    c.cookies.clear()
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        url = f"/api/public/{pub['id']}/sessions"
        first = c.post(url, headers={"Origin": settings.public_url}, json={}).json()
        second = c.post(url, headers={"Origin": settings.public_url}, json={}).json()
        assert first["id"] != second["id"]
        assert (
            c.post(
                url, headers={"Origin": "https://not-allowed.example"}, json={}
            ).status_code
            == 403
        )


def test_shared_private_conversation_is_scoped_and_revocable(setup):
    c, base, form, public, cid, agent = setup
    publish(c, base, agent)
    own = c.post(public + "/requests", json={"form_id": form["id"]}).json()
    other = str(uuid4())
    with connect() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id=%s", (cid,)).fetchone()
        conn.execute(
            "INSERT INTO messages(id,conversation_id,role,content) VALUES (%s,%s,'user','Shared reference: purple window')",
            (str(uuid4()), cid),
        )
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,user_id,config,room_name) VALUES (%s,%s,%s,%s,%s,%s)",
            (other, row["org_id"], agent, row["user_id"], Jsonb({}), other),
        )
    unrelated = c.post(
        f"/api/public/conversations/{other}/requests", json={"form_id": form["id"]}
    ).json()
    link = c.post(public + "/share").json()["url"]
    token = link.split("#")[1]
    assert (
        c.post("/api/public/shared/info", json={"token": "x" * 43}).status_code == 403
    )
    assert c.post("/api/public/shared/info", json={"token": token}).status_code == 200
    headers = {"X-Guest-Token": token}
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        shared = c.post("/api/public/shared/sessions", json={"token": token})
    assert shared.status_code == 200, shared.text
    assert shared.json()["id"] == cid
    assert shared.json()["shared_access"]
    assert shared.json()["visitor_token"] is None
    assert "purple window" in shared.json()["messages"][0]["content"]
    visible = c.get(public + "/requests", headers=headers).json()
    assert [r["id"] for r in visible] == [own["id"]]
    assert (
        c.get(f"/api/public/conversations/{other}", headers=headers).status_code == 403
    )
    assert (
        c.post(
            public + "/active-request",
            headers=headers,
            json={"request_id": unrelated["id"]},
        ).status_code
        == 404
    )
    assert (
        c.post(
            public + f"/requests/{unrelated['id']}/answers",
            headers=headers,
            json={"revision": 1, "answers": {"name": "No"}},
        ).status_code
        == 404
    )
    changed = c.post(
        public + f"/requests/{own['id']}/answers",
        headers=headers,
        json={"revision": 1, "answers": {"name": "Shared participant"}},
    )
    assert changed.status_code == 200
    assert c.post(public + "/share", headers=headers).json()["url"] == link
    assert c.delete(public + "/share", headers=headers).status_code == 403
    with patch("app.sharing.api.LiveKitAPI", return_value=fake_livekit()):
        assert c.delete(public + "/share").status_code == 200
    assert c.get(public + "/requests", headers=headers).status_code == 403
    assert (
        c.post("/api/public/shared/sessions", json={"token": token}).status_code == 403
    )


def test_unpublishing_blocks_shared_links(setup):
    c, base, form, public, cid, agent = setup
    assert c.post(public + "/share").status_code == 403
    pub = publish(c, base, agent)
    token = c.post(public + "/share").json()["url"].split("#")[1]
    c.put(base + f"/agents/{agent}/publication", json={"enabled": False, "origins": []})
    assert c.get("/api/public/widgets/" + pub["id"]).status_code == 404
    assert c.post("/api/public/shared/info", json={"token": token}).status_code == 403
