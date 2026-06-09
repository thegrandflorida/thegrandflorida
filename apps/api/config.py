from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    next_public_supabase_url: Optional[str] = None
    next_public_supabase_anon_key: Optional[str] = None

    # Database
    database_url: str

    # Inngest
    inngest_signing_key: Optional[str] = None
    inngest_event_key: Optional[str] = None

    # Data Sources
    attom_api_key: Optional[str] = None
    costar_api_key: Optional[str] = None
    crexi_api_key: Optional[str] = None
    beaches_mls_access_token: Optional[str] = None
    miami_mls_access_token: Optional[str] = None
    bls_api_key: Optional[str] = None

    # Communications
    resend_api_key: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_number: Optional[str] = None

    # Cache
    redis_url: str = "redis://localhost:6379"

    # App
    environment: str = "development"
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "https://*.vercel.app",
    ]
    api_version: str = "v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
