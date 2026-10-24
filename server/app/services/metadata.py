from pathlib import Path
from mutagen import File


def parse_number(value):
    """Extract the first number from values like '7/12' or '1'."""
    if value is None:
        return None

    try:
        return int(str(value).split("/")[0])
    except (ValueError, TypeError):
        return None


def parse_year(value):
    """Extract a four-digit year from values like '1997' or '1997-05-21'."""
    if value is None:
        return None

    try:
        return int(str(value)[:4])
    except (ValueError, TypeError):
        return None


def extract_artwork(audio) -> tuple[bytes | None, str | None]:
    """
    Extract embedded album artwork from supported audio formats (MP3, FLAC, M4A, OGG).

    Returns:
        (artwork_bytes, mime_type)
    """

    # 1. FLAC
    pictures = getattr(audio, "pictures", None)
    if pictures:
        picture = pictures[0]
        if picture.data:
            return picture.data, picture.mime

    # 2. MP3 (ID3 APIC frames)
    tags = getattr(audio, "tags", None)
    if tags:
        for key, value in tags.items():
            if key.startswith("APIC") or (hasattr(value, "mime") and hasattr(value, "data")):
                if hasattr(value, "data") and value.data:
                    mime = getattr(value, "mime", "image/jpeg") or "image/jpeg"
                    return value.data, mime

    # 3. MP4 / M4A (covr)
    if tags and "covr" in tags:
        covers = tags["covr"]
        if covers:
            cover = covers[0]
            data = bytes(cover)
            mime = "image/jpeg"
            if data.startswith(b"\x89PNG"):
                mime = "image/png"
            elif data.startswith(b"RIFF") and b"WEBP" in data[:16]:
                mime = "image/webp"
            return data, mime

    # 4. Ogg / Vorbis Comment (METADATA_BLOCK_PICTURE)
    if tags and ("metadata_block_picture" in tags or "METADATA_BLOCK_PICTURE" in tags):
        import base64
        from mutagen.flac import Picture
        try:
            pic_field = tags.get("metadata_block_picture") or tags.get("METADATA_BLOCK_PICTURE")
            if pic_field and len(pic_field) > 0:
                pic_data = base64.b64decode(pic_field[0])
                pic = Picture(pic_data)
                return pic.data, pic.mime
        except Exception:
            pass

    return None, None


def read_metadata(file_path: Path) -> dict:
    audio = File(file_path, easy=False)

    if audio is None:
        raise ValueError(
            f"Unsupported or unreadable audio file: {file_path}"
        )

    tags = getattr(audio, "tags", None)
    info = getattr(audio, "info", None)

    def get_tag(*keys, default=None):
        if not tags:
            return default

        for key in keys:
            value = tags.get(key)

            if value is None:
                continue

            if isinstance(value, list):
                return value[0] if value else default

            return str(value)

        return default

    title = get_tag(
        "TIT2",
        "title",
        "\xa9nam",
        default=None,
    )

    artist = get_tag(
        "TPE1",
        "artist",
        "\xa9ART",
    )

    album = get_tag(
        "TALB",
        "album",
        "\xa9alb",
    )

    album_artist = get_tag(
        "TPE2",
        "albumartist",
        "album artist",
        "aART",
    )

    genre = get_tag(
        "TCON",
        "genre",
        "\xa9gen",
    )

    year = get_tag(
        "TDRC",
        "TYER",
        "date",
        "\xa9day",
    )

    track_number = get_tag(
        "TRCK",
        "tracknumber",
        "trkn",
    )

    disc_number = get_tag(
        "TPOS",
        "discnumber",
        "disk",
    )

    lyrics = get_tag(
        "USLT",
        "SYLT",
        "lyrics",
        "\xa9lyr",
        "UNSYNCEDLYRICS",
        default=None,
    )

    artwork, artwork_mime = extract_artwork(audio)

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "album_artist": album_artist,
        "genre": genre,
        "year": parse_year(year),
        "track_number": parse_number(track_number),
        "disc_number": parse_number(disc_number),
        "lyrics": lyrics,
        "duration_seconds": getattr(info, "length", None),
        "bitrate": getattr(info, "bitrate", None),
        "sample_rate": getattr(info, "sample_rate", None),
        "channels": getattr(info, "channels", None),
        "bit_depth": getattr(info, "bits_per_sample", None),
        "file_path": str(file_path),
        "codec": getattr(audio, "mime", [None])[0] if getattr(audio, "mime", None) else None,
        "artwork": artwork,
        "artwork_mime": artwork_mime,
    }
