"""Forms exercise real Postgres + S3, with no paid model calls."""

from io import BytesIO
from uuid import UUID, uuid4
import pytest
from PIL import Image
from psycopg.types.json import Jsonb
from app.db import connect
from app.security import digest
from app.settings import settings
from app.form_schemas import Definition, validate_answers


@pytest.fixture
def setup(client):
    c = client
    c.cookies.clear()
    assert (
        c.post(
            "/api/auth/register",
            json={
                "name": "Forms tester",
                "email": f"{uuid4()}@example.com",
                "password": "test-password-long",
            },
        ).status_code
        == 200
    )
    user = c.get("/api/auth/me").json()["id"]
    org = c.post("/api/organizations", json={"name": "Form tests"}).json()["id"]
    base = f"/api/organizations/{org}"
    data = {
        "name": "Window repair",
        "description": "For broken windows",
        "definition": {
            "fields": [
                {"id": "name", "label": "Name", "required": True},
                {
                    "id": "email",
                    "label": "Email",
                    "kind": "email",
                    "required": True,
                },
                {
                    "id": "photo",
                    "label": "Photo",
                    "kind": "images",
                    "required": True,
                },
            ]
        },
    }
    response = c.post(base + "/forms", json=data)
    assert response.status_code == 200, response.text
    form = response.json()
    agent = c.post(
        base + "/agents",
        json={"name": "Test", "instruction": "Help", "form_ids": [form["id"]]},
    ).json()["id"]
    cid = str(uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,user_id,config,room_name) VALUES (%s,%s,%s,%s,%s,%s)",
            (cid, org, agent, user, Jsonb({}), f"test-{cid}"),
        )
    yield c, base, form, f"/api/public/conversations/{cid}", cid, agent


def test_request_lifecycle_and_snapshot(setup):
    c, base, form, public, cid, agent = setup
    r = c.post(public + "/requests", json={"form_id": form["id"]})
    assert r.status_code == 200, r.text
    draft = r.json()
    path = public + "/requests/" + draft["id"]
    assert (
        c.post(public + "/requests", json={"form_id": form["id"]}).json()["id"]
        == draft["id"]
    )
    assert (
        c.post(path + "/submit", json={"revision": 1, "confirmed": True}).status_code
        == 422
    )
    r = c.post(
        path + "/answers",
        json={
            "revision": 1,
            "answers": {"name": "Anton", "email": "anton@example.com"},
        },
    )
    assert r.status_code == 200, r.text
    assert (
        c.post(
            path + "/answers", json={"revision": 1, "answers": {"name": "Lost edit"}}
        ).status_code
        == 409
    )
    image = BytesIO()
    Image.new("RGB", (32, 32), "green").save(image, format="PNG")
    r = c.post(
        path + "/files",
        data={"field_id": "photo"},
        files={"file": ("test.png", image.getvalue(), "image/png")},
    )
    assert r.status_code == 200, r.text
    draft = r.json()
    file_id = draft["files"][0]["id"]
    preview = c.get(path + "/files/" + file_id)
    assert (
        preview.status_code == 200 and preview.headers["content-type"] == "image/jpeg"
    )
    assert (
        c.post(
            path + "/files",
            data={"field_id": "photo"},
            files={"file": ("fake.png", b"<script>bad</script>", "image/png")},
        ).status_code
        == 422
    )
    assert (
        c.post(
            path + "/submit", json={"revision": draft["revision"], "confirmed": False}
        ).status_code
        == 422
    )
    submitted = c.post(
        path + "/submit", json={"revision": draft["revision"], "confirmed": True}
    ).json()
    assert submitted["status"] == "submitted"
    assert submitted["code"] == draft["code"] == "A01"
    assert c.delete(path).status_code == 409
    assert (
        c.post(
            path + "/submit", json={"revision": draft["revision"], "confirmed": True}
        ).json()["id"]
        == submitted["id"]
    )
    assert len(c.get(base + "/requests").json()) == 1
    assert (
        c.post(
            path + "/answers",
            json={"revision": submitted["revision"], "answers": {"name": "No"}},
        ).status_code
        == 409
    )
    saved = c.post(
        base + "/requests/" + draft["id"] + "/status",
        json={"revision": submitted["revision"], "status": "in_progress"},
    )
    assert saved.status_code == 200, saved.text
    assert [e["status"] for e in saved.json()["events"]] == [
        "submitted",
        "in_progress",
    ]
    update = {k: form[k] for k in ["name", "description", "definition", "version"]}
    update["name"] = "Changed template"
    assert c.put(base + "/forms/" + form["id"], json=update).status_code == 200
    assert c.get(public + "/requests").json()[0]["snapshot"]["name"] == "Window repair"
    assert c.get(public + "/requests").json()[0]["status"] == "in_progress"
    c.cookies.clear()
    assert c.get(public + "/requests").status_code == 401
    assert c.get(path + "/files/" + file_id).status_code == 401


def test_guest_resume_scope_and_agent_permissions(setup):
    c, base, form, public, cid, agent = setup
    org = base.split("/")[-1]
    cids = [str(uuid4()) for _ in range(3)]
    pub = str(uuid4())
    visitor = str(uuid4())
    stranger = str(uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO publications(id,org_id,agent_id,enabled,origins) VALUES (%s,%s,%s,true,%s)",
            (pub, org, agent, ["http://localhost"]),
        )
        for vid in (visitor, stranger):
            conn.execute(
                "INSERT INTO visitors(id,publication_id,token_hash) VALUES (%s,%s,%s)",
                (vid, pub, digest(vid)),
            )
        for i, guestcid in enumerate(cids):
            conn.execute(
                "INSERT INTO conversations(id,org_id,agent_id,visitor_id,guest_hash,config,room_name) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (
                    guestcid,
                    org,
                    agent,
                    visitor if i < 2 else stranger,
                    digest(guestcid),
                    Jsonb({}),
                    guestcid,
                ),
            )
    c.cookies.clear()
    p = f"/api/public/conversations/{cids[0]}"
    first = c.post(
        p + "/requests",
        headers={"X-Guest-Token": cids[0]},
        json={"form_id": form["id"]},
    ).json()
    assert "id" in first, first
    for i in (1, 2):
        r = c.get(
            f"/api/public/conversations/{cids[i]}/requests",
            headers={"X-Guest-Token": cids[i]},
        )
        assert len(r.json()) == (1 if i == 1 else 0)
    assert c.get(p + "/requests", headers={"X-Guest-Token": "wrong"}).status_code == 403
    assert (
        c.post(
            f"/api/public/conversations/{cids[2]}/requests/{first['id']}/answers",
            headers={"X-Guest-Token": cids[2]},
            json={"revision": 1, "answers": {}},
        ).status_code
        == 404
    )
    headers = {"x-service-secret": settings.service_secret}
    wp = f"/api/internal/conversations/{cids[0]}"
    assert (
        c.post(
            wp + "/requests", headers=headers, json={"form_id": str(uuid4())}
        ).status_code
        == 403
    )
    assert (
        c.post(
            wp + "/requests/" + first["id"] + "/submit",
            headers=headers,
            json={"revision": 1, "confirmed": True},
        ).status_code
        == 404
    )
    assert (
        c.post(
            wp + "/requests/" + first["id"] + "/answers",
            headers=headers,
            json={"revision": 1, "answers": {"name": "Voice value"}},
        ).status_code
        == 200
    )
    with connect() as conn:
        conn.execute("UPDATE agents SET form_ids='{}' WHERE id=%s", (agent,))
    assert (
        c.post(
            wp + "/requests/" + first["id"] + "/answers",
            headers=headers,
            json={"revision": 2, "answers": {"name": "Not allowed"}},
        ).status_code
        == 403
    )


def test_schema_rejects_unsafe_unknown_and_wrong_typed_fields():
    d = Definition.model_validate(
        {
            "fields": [
                {"id": "count", "label": "Count", "kind": "number"},
                {
                    "id": "agreed",
                    "label": "Agree",
                    "kind": "checkbox",
                    "required": True,
                },
            ]
        }
    )
    for answers in (
        {"count": True},
        {"count": float("inf")},
        {"script": "bad"},
        {"agreed": "true"},
    ):
        with pytest.raises(ValueError):
            validate_answers(d, answers)
    with pytest.raises(ValueError):
        validate_answers(d, {"agreed": False}, complete=True)
    validate_answers(d, {"count": 0, "agreed": True}, complete=True)


def test_delete_draft_clears_selection_and_never_reuses_code(setup):
    c, base, form, public, cid, agent = setup
    draft = c.post(public + "/requests", json={"form_id": form["id"]}).json()
    path = public + "/requests/" + draft["id"]
    assert draft["code"] == "A01"
    assert (
        c.post(public + "/requests", json={"form_id": form["id"]}).json()["code"]
        == "A01"
    )
    before = c.get(public + "/active-request").json()
    image = BytesIO()
    Image.new("RGB", (32, 32), "green").save(image, format="PNG")
    uploaded = c.post(
        path + "/files",
        data={"field_id": "photo"},
        files={"file": ("photo.png", image.getvalue(), "image/png")},
    ).json()
    file_id = uploaded["files"][0]["id"]
    result = c.delete(path)
    assert result.status_code == 200, result.text
    assert result.json() == {"id": draft["id"], "code": "A01", "deleted": True}
    assert c.get(public + "/requests").json() == []
    selection = c.get(public + "/active-request").json()
    assert selection["request"] is None and selection["version"] > before["version"]
    assert (
        c.post(public + "/active-request", json={"request_id": draft["id"]}).status_code
        == 404
    )
    assert (
        c.post(
            path + "/answers", json={"revision": 2, "answers": {"name": "Late"}}
        ).status_code
        == 404
    )
    assert (
        c.post(path + "/submit", json={"revision": 2, "confirmed": True}).status_code
        == 404
    )
    assert c.get(path + "/files/" + file_id).status_code == 404
    headers = {"x-service-secret": settings.service_secret}
    internal = f"/api/internal/conversations/{cid}"
    assert c.get(internal + "/requests", headers=headers).json() == []
    assert (
        c.post(
            internal + "/requests/" + draft["id"] + "/answers",
            headers=headers,
            json={"revision": 2, "answers": {"name": "Late"}},
        ).status_code
        == 409
    )
    new = c.post(public + "/requests", json={"form_id": form["id"]}).json()
    assert new["code"] == "A02" and new["id"] != draft["id"]
    assert c.get(public + "/requests").json() == [new]


def test_request_codes_boundaries_and_concurrent_creation(setup):
    from concurrent.futures import ThreadPoolExecutor

    c, base, form, public, cid, agent = setup
    with connect() as conn:
        for n, expected in [
            (1, "A01"),
            (99, "A99"),
            (100, "B01"),
            (2574, "Z99"),
            (2575, "AA01"),
        ]:
            assert (
                conn.execute("SELECT elma_request_code(%s) AS code", (n,)).fetchone()[
                    "code"
                ]
                == expected
            )
        conv = conn.execute(
            "SELECT * FROM conversations WHERE id=%s", (cid,)
        ).fetchone()
        # Exercise the boundary through real concurrent inserts in one organization.
        conn.execute(
            "UPDATE organizations SET request_counter=97 WHERE id=%s", (conv["org_id"],)
        )

    def create(_):
        from app.request_domain import open_draft

        with connect() as conn:
            new_cid = uuid4()
            new_conv = conn.execute(
                "INSERT INTO conversations(id,org_id,agent_id,user_id,config,room_name) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
                (
                    new_cid,
                    conv["org_id"],
                    agent,
                    conv["user_id"],
                    Jsonb({}),
                    f"test-{new_cid}",
                ),
            ).fetchone()
            return open_draft(conn, new_conv, UUID(form["id"]))["code"]

    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = list(pool.map(create, range(6)))
    assert set(codes) == {"A98", "A99", "B01", "B02", "B03", "B04"}


def test_other_customer_cannot_delete_draft(setup):
    c, base, form, public, cid, agent = setup
    draft = c.post(public + "/requests", json={"form_id": form["id"]}).json()
    with connect() as conn:
        conv = conn.execute(
            "SELECT * FROM conversations WHERE id=%s", (cid,)
        ).fetchone()
        other_cid = uuid4()
        conn.execute(
            "INSERT INTO conversations(id,org_id,agent_id,config,room_name,guest_hash) VALUES (%s,%s,%s,%s,%s,%s)",
            (
                other_cid,
                conv["org_id"],
                agent,
                Jsonb({}),
                f"test-{other_cid}",
                digest("other-guest"),
            ),
        )
    response = c.delete(
        f"/api/public/conversations/{other_cid}/requests/{draft['id']}",
        headers={"X-Guest-Token": "other-guest"},
    )
    assert response.status_code == 404
    assert c.get(public + "/requests").json()[0]["id"] == draft["id"]
