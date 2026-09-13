"""Resuming while agent writes hold a row lock must not block the API event loop."""

from concurrent.futures import ThreadPoolExecutor
from time import monotonic, sleep
from unittest.mock import patch

import test_forms
from app.db import connect
from test_resume import fake_livekit

setup = test_forms.setup


def test_session_waiting_for_agent_write_keeps_api_responsive(setup):
    client, base, _form, _public, cid, agent = setup
    with connect() as writer, connect() as observer, ThreadPoolExecutor(2) as workers:
        writer.execute(
            "SELECT id FROM conversations WHERE id=%s FOR NO KEY UPDATE", (cid,)
        )
        writer_pid = writer.info.backend_pid
        with patch("app.conversations.api.LiveKitAPI", return_value=fake_livekit()):
            resume = workers.submit(
                client.post,
                f"{base}/agents/{agent}/sessions",
                json={"conversation_id": cid},
            )
            try:
                deadline = monotonic() + 5
                while monotonic() < deadline:
                    blocked = observer.execute(
                        "SELECT 1 FROM pg_stat_activity WHERE %s=ANY(pg_blocking_pids(pid))",
                        (writer_pid,),
                    ).fetchone()
                    if blocked:
                        break
                    sleep(0.01)
                else:
                    raise AssertionError("Resume never waited for the writer's lock")
                health = workers.submit(client.get, "/api/health")
                assert health.result(timeout=2).status_code == 200
                assert not resume.done()
            finally:
                writer.rollback()
            response = resume.result(timeout=5)
            assert response.status_code == 200, response.text
            assert response.json()["id"] == cid
            assert response.json()["resumed"]
