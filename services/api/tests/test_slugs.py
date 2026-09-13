import re
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from app.db import connect
from test_forms import setup


def test_slug_transliteration():
    with connect() as conn:
        for name, expected in [
            ("Nordhaus Support", "nordhaus-support"),
            ("Müller & Söhne GmbH", "mueller-soehne-gmbh"),
            ("Жилой Дом № 7", "zhiloy-dom-no-7"),
            ("Équipe Café", "equipe-cafe"),
            (" -- !!! ", "agent"),
        ]:
            assert (
                conn.execute(
                    "SELECT elma_slug_base(%s, 'agent') AS slug", (name,)
                ).fetchone()["slug"]
                == expected
            )


def test_slugs_collide_only_in_their_scope_and_stay_stable(setup):
    client, base, _, _, _, _ = setup
    name = "Readable " + uuid4().hex[:10]
    org1 = client.post("/api/organizations", json={"name": name}).json()
    org2 = client.post("/api/organizations", json={"name": name}).json()
    assert org1["slug"] == name.lower().replace(" ", "-")
    assert re.fullmatch(re.escape(org1["slug"]) + r"-[0-9a-f]{6}", org2["slug"])
    data = {"name": "Анна Помощник", "instruction": "Help"}
    path = base + "/agents"
    first = client.post(path, json=data).json()["id"]
    second = client.post(path, json=data).json()["id"]
    rows = {r["id"]: r for r in client.get(path).json()}
    assert rows[first]["slug"] == "anna-pomoshchnik"
    assert re.fullmatch(r"anna-pomoshchnik-[0-9a-f]{6}", rows[second]["slug"])
    other_path = f"/api/organizations/{org2['id']}/agents"
    other = client.post(other_path, json=data).json()["id"]
    assert (
        next(a for a in client.get(other_path).json() if a["id"] == other)["slug"]
        == "anna-pomoshchnik"
    )
    assert (
        client.put(path + "/" + first, json={**data, "name": "Renamed"}).status_code
        == 200
    )
    assert (
        next(a for a in client.get(path).json() if a["id"] == first)["slug"]
        == "anna-pomoshchnik"
    )
    pub = client.put(
        path + f"/{first}/publication", json={"enabled": True, "origins": []}
    ).json()
    address = pub["url"].split("/a/", 1)[1]
    assert (
        client.get("/api/public/agents/" + address).json()["publication_id"]
        == pub["id"]
    )
    assert client.get("/api/public/agents/" + pub["id"]).status_code == 404
    # Neither an unpublished agent nor the same slug in the wrong organization resolves.
    assert (
        client.get(f"/api/public/agents/{org2['slug']}/anna-pomoshchnik").status_code
        == 404
    )
    client.put(path + f"/{first}/publication", json={"enabled": False, "origins": []})
    assert client.get("/api/public/agents/" + address).status_code == 404
    assert client.get("/api/public/agents/" + pub["id"]).status_code == 404


def test_simultaneous_slug_assignment_is_unique():
    name = "Concurrent " + uuid4().hex[:10]

    def insert_org(_):
        with connect() as conn:
            return conn.execute(
                "INSERT INTO organizations(id,name) VALUES (%s,%s) RETURNING id,slug",
                (uuid4(), name),
            ).fetchone()

    with ThreadPoolExecutor(6) as pool:
        rows = list(pool.map(insert_org, range(6)))
    assert len({r["slug"] for r in rows}) == 6
    assert sum(r["slug"] == name.lower().replace(" ", "-") for r in rows) == 1
    org = rows[0]["id"]

    def insert_agent(_):
        with connect() as conn:
            return conn.execute(
                "INSERT INTO agents(id,org_id,name,instruction,config) VALUES (%s,%s,'Emma','Help','{}') RETURNING slug",
                (uuid4(), org),
            ).fetchone()["slug"]

    with ThreadPoolExecutor(6) as pool:
        slugs = list(pool.map(insert_agent, range(6)))
    assert len(set(slugs)) == 6
    assert slugs.count("emma") == 1
