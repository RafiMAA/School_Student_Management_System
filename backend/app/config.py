from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    supabase_db_url: str = "postgresql://postgres:password@localhost:5432/postgres"

    # Supabase Auth — JWT verification
    # Found in: Supabase Dashboard → Project Settings → API → JWT Secret
    supabase_jwt_secret: str = "change-me-to-your-supabase-jwt-secret"

    # Supabase project URL and anon/publishable key — used as fallback
    # when local HS256 verification fails (Supabase migrated to ES256).
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # PDF
    pdf_school_name: str = "Ahadiya School"

    # CORS
    cors_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
