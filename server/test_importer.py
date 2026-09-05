from pathlib import Path

from app.database import SessionLocal
from app.services.importer import import_track


file_path = Path(
    "/home/d3f4ult0/Music/Let Down.mp3"
)

db = SessionLocal()

try:
    track = import_track(db, file_path)

    print("Imported successfully!")
    print(f"ID: {track.id}")
    print(f"Title: {track.title}")
    print(f"File: {track.file_path}")

finally:
    db.close()
