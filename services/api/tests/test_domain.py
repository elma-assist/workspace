from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.billing import calculate
from app.indexer import split_text
from app.schemas import PublicationInput, MetricEvent
from contracts.models import AgentConfig


def test_exact_cost():
    assert calculate({"tokens": 123456}, {"tokens": "0.00000015"}) == Decimal(
        "0.0185184"
    )
    assert calculate({"tokens": 9}, None) is None


def test_chunks_preserve_end_and_overlap():
    text = "a" * 1900 + "THE END"
    chunks = split_text(text)
    assert chunks[-1].endswith("THE END")
    assert chunks[0][-200:] == chunks[1][:200]


@pytest.mark.parametrize(
    "origin", ["https://a.com/path", "javascript:alert(1)", "https://user@a.com", "*"]
)
def test_invalid_widget_origin(origin):
    with pytest.raises(ValidationError):
        PublicationInput(enabled=True, origins=[origin])


def test_negative_usage_rejected():
    with pytest.raises(ValidationError):
        MetricEvent(
            event_id="x",
            provider="mistral",
            operation="llm",
            model="x",
            quantities={"tokens": -1},
        )


def test_agent_model_pipeline_validation():
    russian = AgentConfig(
        language="Russian",
        stt_provider="deepgram",
        stt="flux-general-multi",
        tts_provider="cartesia",
        tts="sonic-3.6",
        voice="7a62541e-5492-410e-95ff-3abd096fce87",
    )
    assert russian.language == "Russian"
    with pytest.raises(ValidationError):
        AgentConfig(language="Russian")
    with pytest.raises(ValidationError):
        AgentConfig(stt_provider="deepgram", stt="voxtral-mini-latest")


def test_export_neutralizes_spreadsheet_formulas():
    from app.usage_export import csv_cell

    assert csv_cell("=1+1").startswith("'")
    assert csv_cell("Emma") == "Emma"
