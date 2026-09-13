"""Response schemas validate serialization and drive the generated browser contracts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from contracts.models import AgentConfig
from pydantic import BaseModel


class User(BaseModel):
    id: UUID
    name: str
    email: str


class Organization(BaseModel):
    id: UUID
    name: str
    slug: str
    role: Literal["owner", "admin", "employee"]


class Agent(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str = ""
    instruction: str
    kb_ids: list[UUID]
    form_ids: list[UUID] = []
    config: AgentConfig
    version: int
    publication_id: UUID | None = None
    published: bool | None = None


class KnowledgeBase(BaseModel):
    id: UUID
    name: str
    documents: int = 0
    ready: int = 0


class Document(BaseModel):
    id: UUID
    name: str
    status: Literal["uploaded", "indexing", "ready", "failed"]
    error: str | None = None


class Session(BaseModel):
    id: UUID
    token: str
    url: str
    guest_token: str | None = None
    visitor_token: str | None = None
    resumed: bool = False
    shared_access: bool = False
    messages: list[Message] = []
    agent_name: str
    agent_description: str = ""
    mode: Literal["text", "voice"]


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class Source(BaseModel):
    name: str
    excerpt: str
    score: float


class History(BaseModel):
    id: UUID
    title: str
    status: str
    created_at: datetime
    agent_name: str
    user_name: str | None = None


class Detail(BaseModel):
    id: UUID
    title: str
    status: str
    messages: list[Message]
    sources: list[Source]


class DeletedConversation(BaseModel):
    id: UUID
    deleted: Literal[True]


class UsageTotals(BaseModel):
    cost: Decimal
    price: Decimal
    calls: int
    unpriced: int


class UsageEntry(BaseModel):
    id: UUID
    agent_id: UUID | None
    conversation_id: UUID | None
    agent_name: str | None
    provider: str
    request_id: str
    operation: str
    model: str
    quantities: dict[str, float]
    tariff: dict
    cost: Decimal | None
    price: Decimal | None
    raw_usage: dict
    created_at: datetime


class Usage(BaseModel):
    totals: UsageTotals
    entries: list[UsageEntry]
    currency: str
    pricing: str


class Publication(BaseModel):
    id: UUID
    enabled: bool
    origins: list[str]
    embed: str
    url: str


class PublicAgent(BaseModel):
    name: str
    description: str
    publication_id: UUID


class ShareLink(BaseModel):
    url: str


class SharedConversation(BaseModel):
    agent_name: str
    title: str
