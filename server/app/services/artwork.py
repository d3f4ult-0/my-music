from pathlib import Path
import hashlib


ARTWORK_DIRECTORY = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "artwork"
)


def ensure_artwork_directory() -> None:
    ARTWORK_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )


def save_artwork(
    artwork: bytes,
    mime_type: str | None,
    source_identifier: str,
) -> str:
    """
    Save artwork to the local artwork cache.

    Returns the relative path stored in the database.
    """

    ensure_artwork_directory()

    extension = ".jpg"

    if mime_type == "image/png":
        extension = ".png"
    elif mime_type == "image/webp":
        extension = ".webp"

    artwork_hash = hashlib.sha256(
        source_identifier.encode("utf-8")
    ).hexdigest()[:16]

    filename = f"{artwork_hash}{extension}"

    output_path = ARTWORK_DIRECTORY / filename

    if not output_path.exists():
        output_path.write_bytes(artwork)

    return str(
        Path("data") / "artwork" / filename
    )
