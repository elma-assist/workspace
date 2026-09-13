"""Durable delivery of agent events through the PostgreSQL outbox."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import os
from uuid import UUID, uuid4

import httpx
import psycopg
from psycopg.rows import DictRow, dict_row
from psycopg.types.json import Jsonb

log = logging.getLogger(__name__)


class Events:
    def __init__(self):
        self.database_url = os.environ["DATABASE_URL"]
        self.pending: set[UUID] = set()

    def add(self, path: str, data: dict) -> None:
        event_id = uuid4()
        with psycopg.connect(self.database_url) as conn:
            conn.execute(
                "INSERT INTO agent_event_outbox(id,path,body) VALUES (%s,%s,%s)",
                (event_id, path, Jsonb(data)),
            )
        self.pending.add(event_id)

    async def wait_until_delivered(self, timeout: float = 5) -> None:
        if not self.pending:
            return
        deadline = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < deadline:
            with psycopg.connect(self.database_url) as conn:
                queued = conn.execute(
                    "SELECT id FROM agent_event_outbox WHERE id=ANY(%s::uuid[])",
                    (list(self.pending),),
                ).fetchall()
            self.pending = {row[0] for row in queued}
            if not self.pending:
                return
            await asyncio.sleep(0.05)
        raise TimeoutError("Agent events were not delivered in time")


class EventRelay:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.database_url = os.environ["DATABASE_URL"]
        self.consumer_id = uuid4()

    def _claim(self) -> list[DictRow]:
        with psycopg.Connection[DictRow].connect(
            self.database_url, row_factory=dict_row
        ) as conn:
            return conn.execute(
                """
                WITH candidates AS (
                    SELECT id
                    FROM agent_event_outbox
                    WHERE available_at <= now()
                      AND (locked_until IS NULL OR locked_until < now())
                    ORDER BY created_at, id
                    LIMIT 100
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE agent_event_outbox AS event
                SET locked_by=%s,
                    locked_until=now() + interval '90 seconds',
                    attempts=event.attempts + 1
                FROM candidates
                WHERE event.id=candidates.id
                RETURNING event.id,event.path,event.body,event.attempts
                """,
                (self.consumer_id,),
            ).fetchall()

    def _complete(self, event_id) -> None:
        with psycopg.connect(self.database_url) as conn:
            conn.execute(
                "DELETE FROM agent_event_outbox WHERE id=%s AND locked_by=%s",
                (event_id, self.consumer_id),
            )

    def _retry(self, event_id, attempts: int, error: str) -> None:
        delay = min(60, 2 ** min(attempts, 6))
        available_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
        with psycopg.connect(self.database_url) as conn:
            conn.execute(
                """
                UPDATE agent_event_outbox
                SET available_at=%s,locked_by=NULL,locked_until=NULL,last_error=%s
                WHERE id=%s AND locked_by=%s
                """,
                (available_at, error[:500], event_id, self.consumer_id),
            )

    async def flush(self) -> None:
        for event in self._claim():
            try:
                response = await self.client.post(event["path"], json=event["body"])
                response.raise_for_status()
                self._complete(event["id"])
            except Exception as exc:
                self._retry(event["id"], event["attempts"], type(exc).__name__)
                log.warning("Event remains queued: %s", type(exc).__name__)

    async def run(self) -> None:
        while True:
            await self.flush()
            await asyncio.sleep(1)


async def relay():
    async with httpx.AsyncClient(
        base_url=os.environ["API_URL"],
        headers={"x-service-secret": os.environ["SERVICE_SECRET"]},
        timeout=30,
    ) as client:
        await EventRelay(client).run()


if __name__ == "__main__":
    asyncio.run(relay())
