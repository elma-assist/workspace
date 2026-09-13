from decimal import Decimal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")
    database_url: str
    service_secret: str
    livekit_url: str = "http://livekit:7880"
    livekit_public_url: str = "ws://localhost:8180"
    livekit_api_key: str
    livekit_api_secret: str
    mistral_api_key: str = ""
    openrouter_api_key: str = ""
    embedding_model: str = "mistralai/mistral-embed-2312"
    embedding_dimensions: int = 1024
    mistral_llm_model: str = "mistral-small-latest"
    mistral_stt_model: str = "voxtral-mini-latest"
    mistral_tts_model: str = "voxtral-mini-tts-latest"
    mistral_voice: str = "en_paul_neutral"
    s3_endpoint: str = "http://seaweedfs:8333"
    s3_public_endpoint: str = "http://files.localhost:8180"
    s3_access_key: str
    s3_secret_key: str
    seed_password: str
    public_url: str = "http://localhost:8180"
    billing_multiplier: Decimal = Field(default=Decimal("1.20"), gt=0, le=100)
    billing_tariff_version: str = "pilot-1"
    secure_cookies: bool = False


settings = Settings()  # pyright: ignore[reportCallIssue] -- required values come from environment
