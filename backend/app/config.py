from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    supabase_db_url: str = "postgresql://postgres:password@localhost:5432/postgres"

    # Supabase Auth — JWT verification
    # Found in: Supabase Dashboard → Project Settings → API → JWT Secret
    supabase_jwt_secret: str = "change-me-to-your-supabase-jwt-secret"

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
