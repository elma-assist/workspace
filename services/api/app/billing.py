from datetime import datetime
from app.settings import settings
from app.responses import Usage
from decimal import Decimal
from uuid import uuid4, UUID
from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from app.db import db
from app.security import current_user, membership

router = APIRouter(prefix="/api/organizations/{org_id}/usage", tags=["Usage"])
# Published list prices, USD. Unknown model rates stay NULL rather than showing free usage.
RATES = {
    "mistral-large-latest": {
        "prompt_tokens": "0.0000005",
        "completion_tokens": "0.0000015",
    },
    "mistral-small-latest": {
        "prompt_tokens": "0.00000015",
        "completion_tokens": "0.0000006",
    },
    "voxtral-mini-latest": {"audio_seconds": "0.00005"},
    "voxtral-mini-tts-latest": {"characters_count": "0.000016"},
    "mistralai/mistral-embed-2312": {"prompt_tokens": "0.0000001"},
}


def calculate(quantities: dict, rates: dict | None) -> Decimal | None:
    if not rates:
        return None
    return sum(
        (Decimal(str(quantities.get(k, 0))) * Decimal(v) for k, v in rates.items()),
        Decimal(0),
    )


def record(
    conn,
    org_id,
    provider: str,
    request_id: str,
    operation: str,
    model: str,
    quantities: dict,
    raw: dict,
    agent_id=None,
    conversation_id=None,
    rates: dict | None = None,
) -> None:
    rates = rates if rates is not None else RATES.get(model)
    cost = calculate(quantities, rates)
    tariff = {
        "version": settings.billing_tariff_version,
        "rates": rates,
        "multiplier": str(settings.billing_multiplier),
        "currency": "USD",
        "status": "list-price-estimate" if rates else "unpriced",
    }
    conn.execute(
        "INSERT INTO usage_ledger(id,org_id,agent_id,conversation_id,provider,request_id,operation,model,quantities,tariff,cost,price,raw_usage) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(provider,request_id,operation) DO NOTHING",
        (
            uuid4(),
            org_id,
            agent_id,
            conversation_id,
            provider,
            request_id,
            operation,
            model,
            Jsonb(quantities),
            Jsonb(tariff),
            cost,
            cost * settings.billing_multiplier if cost is not None else None,
            Jsonb(raw),
        ),
    )


@router.get("", response_model=Usage)
def usage(
    org_id: UUID,
    start: datetime | None = None,
    end: datetime | None = None,
    user=Depends(current_user),
    conn=Depends(db),
):
    membership(conn, org_id, user, True)
    totals = conn.execute(
        "SELECT coalesce(sum(cost),0) AS cost,coalesce(sum(price),0) AS price,count(*) AS calls,count(*) FILTER(WHERE cost IS NULL) AS unpriced FROM usage_ledger WHERE org_id=%s AND (%s::timestamptz IS NULL OR created_at>=%s) AND (%s::timestamptz IS NULL OR created_at<%s)",
        (org_id, start, start, end, end),
    ).fetchone()
    entries = conn.execute(
        "SELECT u.*,a.name AS agent_name FROM usage_ledger u LEFT JOIN agents a ON a.id=u.agent_id WHERE u.org_id=%s AND (%s::timestamptz IS NULL OR u.created_at>=%s) AND (%s::timestamptz IS NULL OR u.created_at<%s) ORDER BY u.created_at DESC LIMIT 200",
        (org_id, start, start, end, end),
    ).fetchall()
    return {
        "totals": totals,
        "entries": entries,
        "currency": "USD",
        "pricing": f"{settings.billing_tariff_version}: list price x {settings.billing_multiplier}. Reconcile before invoicing.",
    }
