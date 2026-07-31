from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Media Basket"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

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

    # YouTube
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/youtube"

    # Reddit
    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    REDDIT_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/reddit"

    # WhatsApp Business API
    WHATSAPP_APP_ID: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/whatsapp"
    WHATSAPP_VERIFY_TOKEN: str = "media-basket-verify"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # Instagram
    INSTAGRAM_APP_ID: str = ""
    INSTAGRAM_APP_SECRET: str = ""
    INSTAGRAM_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/instagram"

    # Twitter/X
    TWITTER_CLIENT_ID: str = ""
    TWITTER_CLIENT_SECRET: str = ""
    TWITTER_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/twitter"

    # Facebook
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""
    FACEBOOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/facebook"

    # LinkedIn
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/linkedin"

    # TikTok
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    TIKTOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/tiktok"

    # Discord
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""
    DISCORD_BOT_TOKEN: str = ""
    DISCORD_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/discord"

    # Slack
    SLACK_CLIENT_ID: str = ""
    SLACK_CLIENT_SECRET: str = ""
    SLACK_BOT_TOKEN: str = ""
    SLACK_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/slack"

    # Mastodon
    MASTODON_INSTANCE_URL: str = "https://mastodon.social"
    MASTODON_CLIENT_ID: str = ""
    MASTODON_CLIENT_SECRET: str = ""
    MASTODON_ACCESS_TOKEN: str = ""
    MASTODON_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/mastodon"

    # Pinterest
    PINTEREST_APP_ID: str = ""
    PINTEREST_APP_SECRET: str = ""
    PINTEREST_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/pinterest"

    # Snapchat
    SNAPCHAT_CLIENT_ID: str = ""
    SNAPCHAT_CLIENT_SECRET: str = ""
    SNAPCHAT_REDIRECT_URI: str = "http://localhost:8000/api/v1/services/callback/snapchat"

    # Bluesky
    BLUESKY_HANDLE: str = ""
    BLUESKY_APP_PASSWORD: str = ""

    # AI Content Suggestions
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"

    # SaaS
    DEFAULT_ORG_NAME: str = "My Organization"
    DEFAULT_PLAN: str = "free"
    MAX_SERVICES_FREE: int = 3
    MAX_MEMBERS_FREE: int = 5
    MAX_ML_ANALYSES_FREE: int = 1000

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO: str = ""
    STRIPE_PRICE_ENTERPRISE: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def has_default_secrets(self) -> bool:
        return (
            self.JWT_SECRET_KEY == "dev-secret-change-in-production"
            or self.VAULT_TOKEN == "dev-token-root"
        )

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
