"""pi-cloud backend configuration.

Environment:
  SUPABASE_URL          Supabase project URL. When set together with
  SUPABASE_SERVICE_KEY  SUPABASE_SERVICE_KEY the backend persists to Postgres;
                        otherwise it runs on an in-memory store (dev fallback).
  DEV_OWNER_ID          Owner id attached to all writes in dev mode (no auth
                        yet). For Supabase mode set this to a real auth.users
                        id (created via Dashboard > Authentication); the
                        backend upserts the matching cloud_profiles row on boot.
  CORS_ORIGINS          Comma-separated origins allowed to call the API
                        directly (default: http://localhost:30141).
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    supabase_url: str | None = None
    supabase_service_key: str | None = None
    dev_owner_id: str = "00000000-0000-0000-0000-000000000000"
    cors_origins: str = "http://localhost:30141"

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
