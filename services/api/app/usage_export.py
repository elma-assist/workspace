"""Stream the complete usage ledger; unlike the UI preview, exports are not capped."""

import csv
import io
import json
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.db import db, connect
from app.security import current_user, membership

router = APIRouter(tags=["Usage"])


def csv_cell(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text


@router.get("/api/organizations/{org_id}/usage/export.csv")
def export(
    org_id: UUID,
    start: datetime | None = None,
    end: datetime | None = None,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)

    def rows():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "Created UTC",
                "Agent",
                "Conversation",
                "Provider",
                "Request",
                "Operation",
                "Model",
                "Quantities",
                "Provider cost USD",
                "Customer price USD",
                "Tariff",
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        with connect() as connection, connection.cursor(name="usage_export") as cursor:
            cursor.execute(
                "SELECT u.*,a.name AS agent_name FROM usage_ledger u LEFT JOIN agents a ON a.id=u.agent_id "
                "WHERE u.org_id=%s AND (%s::timestamptz IS NULL OR u.created_at>=%s) "
                "AND (%s::timestamptz IS NULL OR u.created_at<%s) ORDER BY u.created_at",
                (org_id, start, start, end, end),
            )
            for row in cursor:
                values = [
                    row["created_at"],
                    row["agent_name"],
                    row["conversation_id"],
                    row["provider"],
                    row["request_id"],
                    row["operation"],
                    row["model"],
                    json.dumps(row["quantities"]),
                    row["cost"],
                    row["price"],
                    json.dumps(row["tariff"]),
                ]
                writer.writerow([csv_cell(value) for value in values])
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate(0)

    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="elma-usage.csv"'},
    )
