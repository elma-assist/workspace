import hashlib
from uuid import NAMESPACE_DNS, uuid5
from psycopg.types.json import Jsonb
from app.db import connect
from app.security import hasher
from app.settings import settings
from app.storage import put_text
from app.schemas import AgentConfig


def stable(name: str):
    return uuid5(NAMESPACE_DNS, "elma.demo." + name)


def seed() -> None:
    org, admin, employee, kb, agent = [
        stable(x) for x in ("org", "admin", "employee", "kb", "agent")
    ]
    with connect() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(61725)")
        conn.execute(
            "INSERT INTO organizations(id,name,slug) VALUES (%s,'Nordhaus','nordhaus') ON CONFLICT DO NOTHING",
            (org,),
        )
        for uid, email, name, role in [
            (admin, "admin@example.com", "Alex Morgan", "owner"),
            (employee, "member@example.com", "Jordan Weber", "employee"),
        ]:
            conn.execute(
                "INSERT INTO users(id,email,name,password_hash) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (uid, email, name, hasher.hash(settings.seed_password)),
            )
            conn.execute(
                "INSERT INTO memberships VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                (org, uid, role),
            )
        conn.execute(
            "INSERT INTO knowledge_bases(id,org_id,name) VALUES (%s,%s,'Resident handbook') ON CONFLICT DO NOTHING",
            (kb, org),
        )
        texts = {
            "Welcome guide.txt": "Nordhaus is a fictional property management company for demonstration. Office hours: Monday to Friday, 09:00 to 17:00. The resident meeting is on October 14 at 18:30 in the courtyard room at Lindenstrasse 12. For a window repair, residents should provide their apartment number, a description, and a photo. Scheduling is confirmed by a human employee. No appointments or repairs are booked by this demo agent.",
            "Hausordnung.txt": "Nordhaus ist eine fiktive Hausverwaltung. Buerozeiten: Montag bis Freitag von 09:00 bis 17:00 Uhr. Die Mieterversammlung findet am 14. Oktober um 18:30 Uhr im Hofraum, Lindenstrasse 12, statt. Ruhezeiten: taeglich 22:00 bis 07:00 Uhr. Bei einer Fensterreparatur benoetigen wir Wohnungsnummer, Beschreibung und ein Foto. Termine bestaetigt ein Mitarbeiter. Dieser Demo-Assistent bucht keine Termine.",
        }
        for name, body in texts.items():
            doc = stable(name)
            if conn.execute("SELECT 1 FROM documents WHERE id=%s", (doc,)).fetchone():
                continue
            key = f"{org}/documents/{doc}.txt"
            put_text(key, body)
            conn.execute(
                "INSERT INTO documents(id,org_id,kb_id,name,body,object_key,checksum) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (
                    doc,
                    org,
                    kb,
                    name,
                    body,
                    key,
                    hashlib.sha256(body.encode()).hexdigest(),
                ),
            )
        config = AgentConfig.model_validate(
            {
                "llm": settings.mistral_llm_model,
                "stt_provider": "mistral",
                "stt": settings.mistral_stt_model,
                "tts_provider": "mistral",
                "tts": settings.mistral_tts_model,
                "voice": settings.mistral_voice,
            }
        )
        conn.execute(
            "INSERT INTO agents(id,org_id,name,instruction,kb_ids,config,description) VALUES (%s,%s,'Emma','You are Emma, the AI resident assistant for Nordhaus. Answer briefly in English or German. Use the knowledge base for factual company questions. Be transparent about uncertainty and your nature as an AI. You cannot book appointments or submit requests.',%s,%s,'Helps Nordhaus residents with questions and repair requests.') ON CONFLICT DO NOTHING",
            (agent, org, [kb], Jsonb(config.model_dump())),
        )
        conn.execute(
            "INSERT INTO agent_access VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
            (org, agent, employee),
        )
        conn.execute(
            "INSERT INTO publications VALUES (%s,%s,%s,true,%s) ON CONFLICT DO NOTHING",
            (stable("publication"), org, agent, [settings.public_url]),
        )
        from app.seed_forms import seed_forms

        seed_forms(conn, org, agent)
    print("Seed ready: Nordhaus / Emma")


if __name__ == "__main__":
    seed()
