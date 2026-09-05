from pathlib import Path


SUPPORTED_FORMATS = {
    ".flac",
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".opus",
}


def find_audio_files(music_directory: str) -> list[Path]:
    music_path = Path(music_directory).expanduser().resolve()

    if not music_path.exists():
        raise FileNotFoundError(
            f"Music directory does not exist: {music_path}"
        )

    if not music_path.is_dir():
        raise NotADirectoryError(
            f"Music path is not a directory: {music_path}"
        )

    audio_files = []

    for path in music_path.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS:
            audio_files.append(path)

    return sorted(audio_files)
