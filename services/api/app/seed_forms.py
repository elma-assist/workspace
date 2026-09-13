from uuid import NAMESPACE_DNS, uuid5
from psycopg.types.json import Jsonb


def seed_forms(conn, org, agent):
    fid = uuid5(NAMESPACE_DNS, "elma.demo.repair-form")
    definition = {
        "schema_version": 1,
        "fields": [
            {
                "id": "name",
                "label": "Your name",
                "kind": "text",
                "required": True,
                "options": [],
            },
            {
                "id": "email",
                "label": "Email",
                "kind": "email",
                "required": True,
                "options": [],
            },
            {
                "id": "address",
                "label": "Address / apartment",
                "kind": "text",
                "required": True,
                "options": [],
            },
            {
                "id": "problem",
                "label": "What needs repairing?",
                "kind": "textarea",
                "required": True,
                "options": [],
            },
            {
                "id": "photos",
                "label": "Photos",
                "kind": "images",
                "required": False,
                "options": [],
            },
        ],
    }
    conn.execute(
        "INSERT INTO form_templates(id,org_id,name,description,definition) VALUES (%s,%s,'Repair request','Use when a resident reports a broken window or another repair. Collect contact details, address, description and optional photos.',%s) ON CONFLICT DO NOTHING RETURNING id",
        (fid, org, Jsonb(definition)),
    )
    conn.execute(
        "UPDATE agents SET form_ids=array_append(form_ids,%s) WHERE id=%s AND NOT (%s=ANY(form_ids))",
        (fid, agent, fid),
    )
    conn.execute(
        "UPDATE agents SET instruction=replace(instruction,'You cannot book appointments or submit requests.','Help residents prepare repair requests with the assigned form. Customers review and submit themselves. You cannot book appointments.') WHERE id=%s",
        (agent,),
    )
