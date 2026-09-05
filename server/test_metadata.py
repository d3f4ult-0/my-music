from pathlib import Path

from app.services.metadata import read_metadata


file = Path("/home/d3f4ult0/Music/Let Down.mp3")

metadata = read_metadata(file)

for key, value in metadata.items():
    print(f"{key}: {value}")

