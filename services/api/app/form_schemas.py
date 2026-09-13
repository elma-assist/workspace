"""Versioned form contracts; a deliberately small, declarative field vocabulary."""

from datetime import datetime, date
from typing import Literal
from uuid import UUID
import math
from pydantic import (
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    model_validator,
)
from app.schemas import Contract

FieldKind = Literal[
    "text", "textarea", "email", "number", "date", "select", "checkbox", "images"
]
Status = Literal["draft", "submitted", "in_progress", "waiting", "closed"]
Value = StrictStr | StrictBool | StrictInt | StrictFloat


class FormField(Contract):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,49}$")
    label: str = Field(min_length=1, max_length=150)
    kind: FieldKind = "text"
    required: bool = False
    options: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def choices(self):
        if any(not o or len(o) > 150 for o in self.options):
            raise ValueError("Options must contain 1–150 characters")
        if len(set(self.options)) != len(self.options):
            raise ValueError("Duplicate options")
        if self.kind == "select" and not self.options:
            raise ValueError("A select field needs options")
        return self


class Definition(Contract):
    schema_version: Literal[1] = 1
    fields: list[FormField] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def unique_fields(self):
        if len({f.id for f in self.fields}) != len(self.fields):
            raise ValueError("Duplicate field identifiers")
        return self


class FormInput(Contract):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    definition: Definition
    version: int = Field(default=1, ge=1)


class FormTemplate(FormInput):
    id: UUID
    org_id: UUID
    created_at: datetime


class AnswerPatch(Contract):
    revision: int = Field(ge=1)
    answers: dict[str, Value] = Field(max_length=30)


class OpenForm(Contract):
    form_id: UUID


class SubmitRequest(Contract):
    revision: int = Field(ge=1)
    confirmed: Literal[True]


class ChangeStatus(Contract):
    status: Literal["submitted", "in_progress", "waiting", "closed"]
    revision: int = Field(ge=1)


class Attachment(Contract):
    id: UUID
    field_id: str
    name: str
    content_type: str
    size: int


class RequestEvent(Contract):
    actor: str
    status: Status
    created_at: datetime


class DeletedRequest(Contract):
    id: UUID
    code: str
    deleted: Literal[True]


class RequestRecord(Contract):
    id: UUID
    code: str
    org_id: UUID
    form_id: UUID
    form_version: int
    snapshot: FormInput
    conversation_id: UUID
    answers: dict[str, Value]
    revision: int
    status: Status
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    files: list[Attachment] = Field(default_factory=list)
    events: list[RequestEvent] = Field(default_factory=list)


def validate_answers(
    definition: Definition, answers: dict, *, complete=False, files=()
):
    fields = {f.id: f for f in definition.fields}
    if answers.keys() - fields.keys():
        raise ValueError("Unknown form field")
    for key, value in answers.items():
        f = fields[key]
        if f.kind == "images":
            raise ValueError("Images must be uploaded using the attachment field")
        if value == "" and f.kind != "checkbox":
            continue
        if f.kind == "checkbox":
            valid = type(value) is bool
        elif f.kind == "number":
            valid = type(value) in (int, float) and math.isfinite(float(value))
        else:
            valid = isinstance(value, str) and len(value) <= 4000
        if not valid:
            raise ValueError(f"Invalid value for {f.label}")
        if f.kind == "select" and value not in f.options:
            raise ValueError(f"Choose an option for {f.label}")
        if f.kind == "email":
            from email_validator import validate_email, EmailNotValidError

            try:
                validate_email(value, check_deliverability=False)
            except EmailNotValidError:
                raise ValueError(f"Enter a valid email for {f.label}")
        if f.kind == "date":
            try:
                date.fromisoformat(value)
            except ValueError:
                raise ValueError(f"Enter a valid date for {f.label}")
    if complete:
        for f in fields.values():
            value = answers.get(f.id)
            present = (
                any(a["field_id"] == f.id for a in files)
                if f.kind == "images"
                else (
                    value is True
                    if f.kind == "checkbox"
                    else value is not None and value != ""
                )
            )
            if f.required and not present:
                raise ValueError(f"{f.label} is required")
