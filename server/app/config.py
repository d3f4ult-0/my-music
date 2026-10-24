from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./mymusic.db"

    # Security & Auth
    jwt_secret_key: str = "mymusic-super-secret-jwt-dev-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 1 day for dev usability
    jwt_refresh_token_expire_days: int = 30

    # Storage Abstraction: "local", "s3", "minio", "r2"
    storage_provider: str = "local"
    storage_local_path: str = "./data/storage"
    storage_base_url: str = "/api/v1/storage"

    # S3 Compatible Config
    s3_endpoint_url: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_bucket_name: str = "mymusic"
    s3_region_name: str = "us-east-1"
    s3_signature_version: str = "s3v4"

    # CORS
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ]

    # Legacy & Scanning directory
    music_directory: str = "./data/music"

    # History tracking threshold
    history_threshold_seconds: int = 30
    history_threshold_percentage: float = 0.5

    # Environment
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
