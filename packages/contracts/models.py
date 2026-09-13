from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class AgentConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    llm: Literal["mistral-small-latest", "mistral-large-latest"] = (
        "mistral-small-latest"
    )
    stt_provider: Literal["mistral", "deepgram"] = "mistral"
    stt: Literal["voxtral-mini-latest", "flux-general-multi"] = (
        "voxtral-mini-latest"
    )
    tts_provider: Literal["mistral", "cartesia"] = "mistral"
    tts: Literal["voxtral-mini-tts-latest", "sonic-3.6"] = (
        "voxtral-mini-tts-latest"
    )
    voice: str = Field(default="en_paul_neutral", min_length=1, max_length=100)
    language: Literal["auto", "English", "German", "Russian"] = "auto"

    @model_validator(mode="after")
    def compatible_pipeline(self):
        expected_stt = {
            "mistral": "voxtral-mini-latest",
            "deepgram": "flux-general-multi",
        }
        expected_tts = {
            "mistral": "voxtral-mini-tts-latest",
            "cartesia": "sonic-3.6",
        }
        if self.stt != expected_stt[self.stt_provider]:
            raise ValueError("The speech recognition model does not match its provider")
        if self.tts != expected_tts[self.tts_provider]:
            raise ValueError("The speech model does not match its provider")
        if self.language == "Russian" and self.tts_provider == "mistral":
            raise ValueError("Mistral speech does not support Russian; use Cartesia")
        return self


class RuntimeConfig(AgentConfig):
    name: str
    instruction: str
    kb_ids: list[UUID]
    version: int
    mode: Literal["text", "voice"]
