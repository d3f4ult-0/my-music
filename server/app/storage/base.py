from abc import ABC, abstractmethod
from typing import BinaryIO, Optional, Tuple, Iterator


class ObjectStorage(ABC):
    """Abstract object storage provider interface."""

    @abstractmethod
    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Uploads data bytes to the given key and returns the storage location/key."""
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Deletes the object at key. Returns True if deleted, False otherwise."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Checks if an object exists at key."""
        pass

    @abstractmethod
    def get_file_size(self, key: str) -> int:
        """Returns file size in bytes."""
        pass

    @abstractmethod
    def get_stream(
        self, key: str, start: int = 0, length: Optional[int] = None
    ) -> Tuple[Iterator[bytes], int, int, str]:
        """
        Returns a generator of bytes chunks, start byte, total file size, and content_type.
        """
        pass

    @abstractmethod
    def generate_stream_url(self, key: str, expires_in: int = 3600) -> str:
        """Generates a temporary signed or internal streaming URL."""
        pass

    @abstractmethod
    def generate_download_url(
        self, key: str, filename: Optional[str] = None, expires_in: int = 3600
    ) -> str:
        """Generates a temporary download URL."""
        pass
