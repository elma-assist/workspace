from unittest.mock import patch
from app.db import connect
from app.settings import settings
from test_forms import setup
from test_resume import fake_livekit


def test_widget_context_is_persisted_and_scenario_starts_fresh(setup):
    c, base, form, public, cid, agent = setup
    pub = c.put(base + f"/agents/{agent}/publication", json={"enabled": True, "origins": [settings.public_url]}).json()
    c.cookies.clear()
    path = f"/api/public/{pub['id']}/sessions"
    context = {"brand_name": "Tristar Hausmanagement", "assistant_name": "Tristar Service", "language": "de", "scenario": "damage", "demo": True}
    with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
        first_response = c.post(path, headers={"Origin": settings.public_url}, json={"new_conversation": True, "widget_context": context})
        assert first_response.status_code == 200, first_response.text
        first = first_response.json()
        assert first["agent_name"] == "Tristar Service"
        assert first["widget_context"] == context
        headers = {"Origin": settings.public_url, "X-Visitor-Token": first["visitor_token"]}
        resumed = c.post(path, headers=headers, json={"conversation_id": first["id"]}).json()
        assert resumed["id"] == first["id"]
        assert resumed["widget_context"] == context
        context["scenario"] = "management_inquiry"
        second = c.post(path, headers=headers, json={"new_conversation": True, "conversation_id": first["id"], "widget_context": context}).json()
        assert second["id"] != first["id"]
        assert second["widget_context"]["scenario"] == "management_inquiry"
        with connect() as conn:
            rows = conn.execute("SELECT config FROM conversations WHERE id=ANY(%s::uuid[])", ([first["id"], second["id"]],)).fetchall()
            assert {r["config"]["widget_context"]["scenario"] for r in rows} == {"damage", "management_inquiry"}
            assert all(r["config"]["language"] == "German" for r in rows)
            assert conn.execute("SELECT count(*) AS n FROM messages WHERE conversation_id=%s AND role='user'", (second["id"],)).fetchone()["n"] == 0
        share = c.post(f"/api/public/conversations/{second['id']}/share", headers={"X-Guest-Token": second["guest_token"]}).json()
        share_token = share["url"].split("#")[1]
        info = c.post("/api/public/shared/info", json={"token": share_token}).json()
        assert info["agent_name"] == "Tristar Service"
        assert info["widget_context"] == context
        shared = c.post("/api/public/shared/sessions", json={"token": share_token}).json()
        assert shared["widget_context"] == context
        assert shared["agent_name"] == "Tristar Service"
        invalid = c.post(path, headers=headers, json={"widget_context": {"scenario": "unknown"}})
        assert invalid.status_code == 422
