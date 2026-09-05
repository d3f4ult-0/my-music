from pathlib import Path

from sqlalchemy.orm import Session

from app.services.scanner import find_audio_files
from app.services.importer import import_track


def scan_library(
    db: Session,
    music_directory: str,
) -> dict:

    files = find_audio_files(music_directory)

    imported = 0
    failed = 0
    errors = []

    for file_path in files:
        try:
            import_track(db, file_path)
            imported += 1

            print(f"Imported: {file_path}")

        except Exception as exc:
            failed += 1
            errors.append(
                {
                    "file": str(file_path),
                    "error": str(exc),
                }
            )

            print(f"Failed: {file_path}")
            print(f"  Error: {exc}")

    return {
        "total_files": len(files),
        "imported": imported,
        "failed": failed,
        "errors": errors,
    }
