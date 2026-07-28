from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Media Basket"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/media_basket"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/media_basket"

    # Redis
    REDIS_URL: str | None = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Vault
    VAULT_URL: str = "http://localhost:8200"
    VAULT_TOKEN: str = "dev-token-root"
    VAULT_MOUNT_PATH: str = "media_basket"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "media-basket"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # SaaS
    DEFAULT_ORG_NAME: str = "My Organization"
    DEFAULT_PLAN: str = "free"
    MAX_SERVICES_FREE: int = 3
    MAX_MEMBERS_FREE: int = 5
    MAX_ML_ANALYSES_FREE: int = 1000

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
