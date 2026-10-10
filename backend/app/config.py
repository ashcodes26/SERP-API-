from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-side configuration. Secrets never leave the backend."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./aimora.db"
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006"
    max_upload_mb: int = 5

    auth_signing_key: SecretStr | None = None
    admin_password: SecretStr | None = None
    demo_password: SecretStr | None = None
    import_retention_hours: int = 24

    linkedin_client_id: str = ''
    linkedin_client_secret: SecretStr | None = None
    linkedin_redirect_uri: str = ''

    @property
    def linkedin_configured(self) -> bool:
        from urllib.parse import urlsplit
        try:
            redirect = urlsplit(self.linkedin_redirect_uri)
        except ValueError:
            return False
        return bool(self.linkedin_client_id.strip() and self.linkedin_client_secret
                    and self.linkedin_client_secret.get_secret_value().strip()
                    and redirect.scheme == 'https' and redirect.hostname
                    and not redirect.username and not redirect.password
                    and not redirect.query and not redirect.fragment
                    and redirect.path == '/api/profile/linkedin/callback')

    serpapi_api_key: SecretStr | None = None
    serpapi_timeout_seconds: float = 10.0
    serpapi_max_results: int = 10
    job_cache_ttl_seconds: int = Field(default=900, ge=30, le=3600)
    job_cache_stale_seconds: int = Field(default=86400, ge=3600, le=604800)

    @property
    def serpapi_configured(self) -> bool:
        return bool(self.serpapi_api_key and self.serpapi_api_key.get_secret_value().strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
