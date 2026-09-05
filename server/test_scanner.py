from app.services.scanner import find_audio_files


files = find_audio_files("/home/d3f4ult0/Music")

print(f"Found {len(files)} audio files:")

for file in files:
    print(file)
