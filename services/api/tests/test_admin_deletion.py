"""Owners and admins may remove organization requests and conversations."""

from uuid import uuid4

import pytest
from app.db import connect
from app.storage import client as storage_client
from psycopg.types.json import Jsonb


def test_admin_deletes_requests_and_conversations(client):
    client.cookies.clear()
    owner_email = f"owner-{uuid4().hex}@example.com"
    assert (
        client.post(
            "/api/auth/register",
            json={
                "name": "Deletion owner",
                "email": owner_email,
                "password": "owner-password-123",
            },
        ).status_code
        == 200
    )
    owner = client.get("/api/auth/me").json()
    owner_cookies = dict(client.cookies)
    org = client.post("/api/organizations", json={"name": "Deletion test"}).json()
    base = f"/api/organizations/{org['id']}"
    form = client.post(
        base + "/forms",
        json={
            "name": "Repair",
            "definition": {"fields": [{"id": "problem", "label": "Problem"}]},
        },
    ).json()
    agent = client.post(
        base + "/agents",
        json={"name": "Helper", "instruction": "Help."},
    ).json()
    request_conversation, deleted_conversation = uuid4(), uuid4()
    request_id, attached_request = uuid4(), uuid4()
    share_id, usage_id = uuid4(), uuid4()
    file_id = uuid4()
    object_key = f"{org['id']}/requests/{attached_request}/{file_id}.jpg"
    snapshot = {
        "name": "Repair",
        "description": "",
        "definition": {
            "schema_version": 1,
            "fields": [
                {
                    "id": "problem",
                    "label": "Problem",
                    "kind": "text",
                    "required": False,
                    "options": [],
                }
            ],
        },
        "version": 1,
    }
    storage_client().put_object(
        Bucket="elma", Key=object_key, Body=b"test-photo", ContentType="image/jpeg"
    )
    with connect() as conn:
        for cid in (request_conversation, deleted_conversation):
            conn.execute(
                "INSERT INTO conversations(id,org_id,agent_id,user_id,config,room_name) VALUES (%s,%s,%s,%s,%s,%s)",
                (cid, org["id"], agent["id"], owner["id"], Jsonb({}), f"delete-{cid}"),
            )
        for rid, cid in (
            (request_id, request_conversation),
            (attached_request, deleted_conversation),
        ):
            conn.execute(
                "INSERT INTO requests(id,org_id,form_id,form_version,snapshot,conversation_id,user_id,status) VALUES (%s,%s,%s,1,%s,%s,%s,'submitted')",
                (rid, org["id"], form["id"], Jsonb(snapshot), cid, owner["id"]),
            )
            conn.execute(
                "INSERT INTO request_events(id,request_id,actor,status) VALUES (%s,%s,'Customer','submitted')",
                (uuid4(), rid),
            )
        conn.execute(
            "UPDATE conversations SET active_request_id=%s WHERE id=%s",
            (request_id, request_conversation),
        )
        conn.execute(
            "INSERT INTO request_files(id,request_id,field_id,name,object_key,content_type,size) VALUES (%s,%s,'photo','photo.jpg',%s,'image/jpeg',10)",
            (file_id, attached_request, object_key),
        )
        conn.execute(
            "INSERT INTO messages(id,conversation_id,role,content) VALUES ('message',%s,'user','Hello')",
            (deleted_conversation,),
        )
        conn.execute(
            "INSERT INTO sources(id,conversation_id,query,name,excerpt,score) VALUES (%s,%s,'q','Source','Excerpt',1)",
            (uuid4(), deleted_conversation),
        )
        conn.execute(
            "INSERT INTO conversation_shares(id,conversation_id,token_hash) VALUES (%s,%s,%s)",
            (share_id, deleted_conversation, uuid4().hex),
        )
        conn.execute(
            "UPDATE conversations SET run_share_id=%s WHERE id=%s",
            (share_id, deleted_conversation),
        )
        conn.execute(
            "INSERT INTO usage_ledger(id,org_id,agent_id,conversation_id,provider,request_id,operation,model,quantities,tariff,cost,price,raw_usage) VALUES (%s,%s,%s,%s,'test',%s,'llm','test',%s,%s,1,2,%s)",
            (
                usage_id,
                org["id"],
                agent["id"],
                deleted_conversation,
                uuid4().hex,
                Jsonb({}),
                Jsonb({}),
                Jsonb({}),
            ),
        )

    client.cookies.clear()
    employee_email = f"employee-{uuid4().hex}@example.com"
    client.post(
        "/api/auth/register",
        json={
            "name": "Deletion employee",
            "email": employee_email,
            "password": "employee-password-123",
        },
    )
    employee = client.get("/api/auth/me").json()
    with connect() as conn:
        conn.execute(
            "INSERT INTO memberships(org_id,user_id,role) VALUES (%s,%s,'employee')",
            (org["id"], employee["id"]),
        )
    assert client.delete(base + f"/requests/{request_id}").status_code == 403
    assert (
        client.delete(base + f"/conversations/{deleted_conversation}").status_code
        == 403
    )

    client.cookies.clear()
    client.cookies.update(owner_cookies)
    deleted = client.delete(base + f"/requests/{request_id}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["deleted"] is True
    with connect() as conn:
        assert not conn.execute(
            "SELECT 1 FROM requests WHERE id=%s", (request_id,)
        ).fetchone()
        assert not conn.execute(
            "SELECT 1 FROM request_events WHERE request_id=%s", (request_id,)
        ).fetchone()
        assert (
            conn.execute(
                "SELECT active_request_id FROM conversations WHERE id=%s",
                (request_conversation,),
            ).fetchone()["active_request_id"]
            is None
        )

    deleted = client.delete(base + f"/conversations/{deleted_conversation}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {"id": str(deleted_conversation), "deleted": True}
    with connect() as conn:
        for table, column in (
            ("conversations", "id"),
            ("messages", "conversation_id"),
            ("sources", "conversation_id"),
            ("conversation_shares", "conversation_id"),
            ("requests", "conversation_id"),
        ):
            assert not conn.execute(
                f"SELECT 1 FROM {table} WHERE {column}=%s", (deleted_conversation,)
            ).fetchone()
        assert (
            conn.execute(
                "SELECT conversation_id FROM usage_ledger WHERE id=%s", (usage_id,)
            ).fetchone()["conversation_id"]
            is None
        )
    with pytest.raises(storage_client().exceptions.ClientError):
        storage_client().head_object(Bucket="elma", Key=object_key)
