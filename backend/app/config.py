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
    supabase_service_role_key: str = ""

    # Push notifications and protected scheduler calls
    notification_cron_secret: str = ""
    vapid_private_key: str = ""
    vapid_claim_email: str = ""

    # PDF
    pdf_school_name: str = "Ahadiya School"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:19006,https://ahadiya-student-management-system.vercel.app"

    @property
    def cors_origin_list(self) -> list[str]:
        configured = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        # Render environment variables can lag behind a frontend domain change.
        # Always retain the known production origin in addition to configured
        # localhost/preview origins.
        required = ["https://ahadiya-student-management-system.vercel.app"]
        return list(dict.fromkeys([*configured, *required]))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
