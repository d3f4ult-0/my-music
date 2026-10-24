import os
import mimetypes
from pathlib import Path
from typing import Iterator, Optional, Tuple

from app.storage.base import ObjectStorage
from app.config import settings


class LocalStorage(ObjectStorage):
    """Local filesystem object storage implementation."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.storage_local_path).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, key: str) -> Path:
        # Sanitize path to prevent directory traversal
        clean_key = Path(key).as_posix().lstrip("/").replace("..", "")
        target_path = (self.base_dir / clean_key).resolve()
        # Ensure target is strictly within base_dir
        if not str(target_path).startswith(str(self.base_dir)):
            raise ValueError(f"Path traversal detected: {key}")
        return target_path

    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        target_path = self._resolve_path(key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(data)
        # Store relative POSIX key
        return Path(key).as_posix()

    def delete(self, key: str) -> bool:
        try:
            target_path = self._resolve_path(key)
            if target_path.is_file():
                target_path.unlink()
                return True
        except Exception:
            pass
        return False

    def exists(self, key: str) -> bool:
        try:
            return self._resolve_path(key).is_file()
        except Exception:
            return False

    def get_file_size(self, key: str) -> int:
        target_path = self._resolve_path(key)
        if not target_path.is_file():
            raise FileNotFoundError(f"Object not found: {key}")
        return target_path.stat().st_size

    def get_stream(
        self, key: str, start: int = 0, length: Optional[int] = None
    ) -> Tuple[Iterator[bytes], int, int, str]:
        target_path = self._resolve_path(key)
        if not target_path.is_file():
            raise FileNotFoundError(f"Object not found: {key}")

        total_size = target_path.stat().st_size
        mime_type, _ = mimetypes.guess_type(target_path.name)
        if not mime_type:
            mime_type = "audio/mpeg" if target_path.suffix.lower() == ".mp3" else "application/octet-stream"

        if start < 0 or start >= total_size:
            start = 0

        bytes_to_read = total_size - start
        if length is not None:
            bytes_to_read = min(length, bytes_to_read)

        def iterator() -> Iterator[bytes]:
            with open(target_path, "rb") as f:
                f.seek(start)
                remaining = bytes_to_read
                chunk_size = 256 * 1024  # 256 KB
                while remaining > 0:
                    read_len = min(chunk_size, remaining)
                    chunk = f.read(read_len)
                    if not chunk:
                        break
                    yield chunk
                    remaining -= len(chunk)

        return iterator(), start, total_size, mime_type

    def generate_stream_url(self, key: str, expires_in: int = 3600) -> str:
        # For local storage, streams are served through the proxy endpoint
        return f"{settings.storage_base_url}/stream?key={key}"

    def generate_download_url(
        self, key: str, filename: Optional[str] = None, expires_in: int = 3600
    ) -> str:
        name_param = f"&filename={filename}" if filename else ""
        return f"{settings.storage_base_url}/download?key={key}{name_param}"
