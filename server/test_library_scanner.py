from app.database import SessionLocal
from app.services.library_scanner import scan_library


MUSIC_DIRECTORY = "/home/d3f4ult0/Music"

db = SessionLocal()

try:
    result = scan_library(
        db,
        MUSIC_DIRECTORY,
    )

    print("\n--- Scan Complete ---")
    print(f"Total files: {result['total_files']}")
    print(f"Imported: {result['imported']}")
    print(f"Failed: {result['failed']}")

    if result["errors"]:
        print("\nErrors:")

        for error in result["errors"]:
            print(f"- {error['file']}")
            print(f"  {error['error']}")

finally:
    db.close()
