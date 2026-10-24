import mimetypes
from typing import Iterator, Optional, Tuple
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.storage.base import ObjectStorage
from app.config import settings


class S3ObjectStorage(ObjectStorage):
    """S3-compatible object storage provider (MinIO, Cloudflare R2, AWS S3)."""

    def __init__(self):
        s3_kwargs = {
            "service_name": "s3",
            "region_name": settings.s3_region_name,
        }
        if settings.s3_endpoint_url:
            s3_kwargs["endpoint_url"] = settings.s3_endpoint_url
        if settings.s3_access_key_id and settings.s3_secret_access_key:
            s3_kwargs["aws_access_key_id"] = settings.s3_access_key_id
            s3_kwargs["aws_secret_access_key"] = settings.s3_secret_access_key

        config = Config(
            signature_version=settings.s3_signature_version,
            s3={"addressing_style": "path"},
        )
        s3_kwargs["config"] = config

        self.s3_client = boto3.client(**s3_kwargs)
        self.bucket = settings.s3_bucket_name

    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def delete(self, key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def exists(self, key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def get_file_size(self, key: str) -> int:
        res = self.s3_client.head_object(Bucket=self.bucket, Key=key)
        return int(res.get("ContentLength", 0))

    def get_stream(
        self, key: str, start: int = 0, length: Optional[int] = None
    ) -> Tuple[Iterator[bytes], int, int, str]:
        total_size = self.get_file_size(key)
        mime_type, _ = mimetypes.guess_type(key)
        if not mime_type:
            mime_type = "audio/mpeg" if key.lower().endswith(".mp3") else "application/octet-stream"

        if start < 0 or start >= total_size:
            start = 0

        end = total_size - 1
        if length is not None:
            end = min(start + length - 1, total_size - 1)

        range_header = f"bytes={start}-{end}"
        response = self.s3_client.get_object(
            Bucket=self.bucket,
            Key=key,
            Range=range_header,
        )
        body = response["Body"]

        def iterator() -> Iterator[bytes]:
            chunk_size = 256 * 1024
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk

        return iterator(), start, total_size, mime_type

    def generate_stream_url(self, key: str, expires_in: int = 3600) -> str:
        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError:
            # Fallback to application proxy URL
            return f"{settings.storage_base_url}/stream?key={key}"

    def generate_download_url(
        self, key: str, filename: Optional[str] = None, expires_in: int = 3600
    ) -> str:
        params = {"Bucket": self.bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'

        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expires_in,
            )
        except ClientError:
            name_param = f"&filename={filename}" if filename else ""
            return f"{settings.storage_base_url}/download?key={key}{name_param}"
