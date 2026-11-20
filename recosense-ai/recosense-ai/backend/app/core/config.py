"""Application configuration loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    APP_NAME: str = "RecoSense AI API"
    ENV: str = "development"  # development | production | test
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+psycopg://recosense:recosense@localhost:5432/recosense"

    JWT_SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    FRONTEND_URL: str = "http://localhost:3000"

    MODEL_DIR: Path = BASE_DIR / "trained_models"
    DATASET_DIR: Path = BASE_DIR / "datasets"
    MAX_UPLOAD_MB: int = 25

    # Hybrid recommendation weights (normalised at runtime, can be overridden by admin)
    REC_WEIGHT_CONTENT: float = 0.35
    REC_WEIGHT_COLLABORATIVE: float = 0.30
    REC_WEIGHT_SENTIMENT: float = 0.25
    REC_WEIGHT_RATING: float = 0.10

    RATE_LIMIT_PER_MINUTE: int = 120
    AUTH_RATE_LIMIT_PER_MINUTE: int = 20

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        # Render/Railway hand out postgres:// URLs; SQLAlchemy needs a driver name.
        if v.startswith("postgres://"):
            v = "postgresql+psycopg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and s.JWT_SECRET_KEY.startswith("dev-only"):
        raise RuntimeError("JWT_SECRET_KEY must be set to a strong secret in production")
    s.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    return s


settings = get_settings()
