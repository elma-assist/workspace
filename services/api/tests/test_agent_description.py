from unittest.mock import patch

from app.db import connect
from test_forms import setup
from test_resume import fake_livekit


def test_agent_description_persists_validates_and_reaches_chat(setup):
    client, base, _, _, cid, agent = setup
    path = f"{base}/agents"
    data = {
        "name": "Concierge",
        "description": "  Helps with apartment repairs.  ",
        "instruction": "Private instructions must not become the description.",
    }
    created = client.post(path, json=data)
    assert created.status_code == 200
    created_id = created.json()["id"]
    with connect() as conn:
        assert (
            conn.execute(
                "SELECT description FROM agents WHERE id=%s", (created_id,)
            ).fetchone()["description"]
            == "Helps with apartment repairs."
        )
    data["description"] = "Repairs and resident questions."
    assert client.put(f"{path}/{agent}", json=data).status_code == 200
    row = next(a for a in client.get(path).json() if a["id"] == agent)
    assert row["description"] == data["description"]
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        response = client.post(
            f"{path}/{agent}/sessions", json={"conversation_id": cid}
        )
    assert response.status_code == 200, response.text
    assert response.json()["agent_description"] == data["description"]
    assert "instruction" not in response.json()
    assert (
        client.put(
            f"{path}/{agent}", json={**data, "description": "x" * 181}
        ).status_code
        == 422
    )
    assert (
        client.put(f"{path}/{agent}", json={**data, "description": ""}).status_code
        == 200
    )
    assert (
        next(a for a in client.get(path).json() if a["id"] == agent)["description"]
        == ""
    )
