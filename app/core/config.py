"""Application configuration (Pydantic Settings)."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "workflow-automation"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-dev-secret"
    CREDENTIALS_ENCRYPTION_KEY: str = ""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "sqlite:///./workflow.db"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_ALWAYS_EAGER: bool = False

    EMAIL_PROVIDER: str = "mock"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@example.com"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    SCHEDULER_ENABLED: bool = True
    TIMEZONE: str = "UTC"


@lru_cache
def get_settings() -> Settings:
    return Settings()
