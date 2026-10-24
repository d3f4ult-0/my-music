from typing import Optional
from app.config import settings
from app.storage.base import ObjectStorage
from app.storage.local import LocalStorage
from app.storage.s3 import S3ObjectStorage

_storage_instance: Optional[ObjectStorage] = None


def get_storage() -> ObjectStorage:
    global _storage_instance
    if _storage_instance is None:
        if settings.storage_provider.lower() in ("s3", "minio", "r2") and settings.s3_endpoint_url:
            _storage_instance = S3ObjectStorage()
        else:
            _storage_instance = LocalStorage()
    return _storage_instance


__all__ = ["ObjectStorage", "LocalStorage", "S3ObjectStorage", "get_storage"]
