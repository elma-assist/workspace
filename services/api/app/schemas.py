from contracts.models import AgentConfig
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from urllib.parse import urlsplit


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Credentials(Contract):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=100)


class Named(Contract):
    name: str = Field(min_length=1, max_length=100)


class AgentInput(Named):
    description: str = Field(default="", max_length=180)
    instruction: str = Field(min_length=1, max_length=12000)
    kb_ids: list[UUID] = Field(default_factory=list, max_length=30)
    form_ids: list[UUID] = Field(default_factory=list, max_length=30)
    config: AgentConfig = Field(default_factory=AgentConfig)


class Invitation(Named):
    email: EmailStr
    agent_ids: list[UUID] = Field(default_factory=list, max_length=100)


class AcceptInvite(Contract):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=10, max_length=200)


class AccessInput(Contract):
    agent_ids: list[UUID] = Field(max_length=100)


class DocumentInput(Named):
    text: str = Field(min_length=1, max_length=200000)


class PublicationInput(Contract):
    enabled: bool
    origins: list[str] = Field(max_length=20)

    @field_validator("origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            u = urlsplit(origin)
            if (
                u.scheme not in {"http", "https"}
                or not u.hostname
                or u.path
                or u.query
                or u.fragment
                or u.username
            ):
                raise ValueError("Use an exact origin such as https://example.com")
        return list(dict.fromkeys(origins))


class SessionInput(Contract):
    conversation_id: UUID | None = None
    mode: Literal["text", "voice"] = "text"


class MessageEvent(Contract):
    id: str = Field(max_length=150)
    role: Literal["user", "assistant"]
    content: str = Field(max_length=60000)


class SearchInput(Contract):
    query: str = Field(min_length=1, max_length=12000)


class CloseInput(Contract):
    run_id: UUID | None = None
    status: Literal["completed", "error"] = "completed"


class MetricEvent(Contract):
    event_id: str = Field(max_length=200)
    provider: Literal["mistral", "deepgram", "cartesia"]
    operation: Literal["llm", "stt", "tts"]
    model: str = Field(max_length=100)
    quantities: dict[str, float] = Field(max_length=30)
    raw: dict = Field(default_factory=dict)

    @field_validator("quantities")
    @classmethod
    def nonnegative(cls, values: dict[str, float]) -> dict[str, float]:
        import math

        if any(v < 0 or not math.isfinite(v) for v in values.values()):
            raise ValueError("Usage quantities must be finite and nonnegative")
        return values
