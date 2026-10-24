import sys
import io
import uuid
import struct
import tempfile
from pathlib import Path
from mutagen.wave import WAVE
from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC, ID3NoHeaderError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.song import Song
from app.models.album import Album
from app.models.artist import Artist
from app.services.metadata import read_metadata, extract_artwork
from app.routers.artist_studio import _import_single_audio_file
from app.storage import get_storage


def create_test_wav_file(filename: Path) -> Path:
    """Creates a valid PCM WAV audio file with RIFF headers."""
    sample_rate = 44100
    duration_secs = 2
    num_samples = sample_rate * duration_secs
    num_channels = 2
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)
    data_size = num_samples * block_align
    total_size = 36 + data_size

    with open(filename, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", total_size))
        f.write(b"WAVE")
        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))
        f.write(struct.pack("<H", 1))  # PCM
        f.write(struct.pack("<H", num_channels))
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", bits_per_sample))
        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(b"\x00" * data_size)

    return filename


def test_auto_detection():
    print("==================================================")
    print("   TESTING AUTOMATIC SONG & ARTWORK DETECTION    ")
    print("==================================================")

    db: Session = SessionLocal()
    storage = get_storage()

    try:
        user = db.scalar(select(User).order_by(User.id.asc()))
        assert user is not None
        artist = db.scalar(select(Artist).where(Artist.user_id == user.id))
        if not artist:
            artist = Artist(user_id=user.id, name="Test Producer")
            db.add(artist)
            db.commit()
            db.refresh(artist)

        # 1. Create a dummy audio file with a companion artwork image
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            wav_path = tmppath / "Synthetic_Horizon.wav"
            create_test_wav_file(wav_path)

            # Dummy artwork JPEG bytes (minimal valid JPEG header)
            dummy_jpeg = (
                b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"
                b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
                b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
                b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
            )

            print("[1] Testing Companion Cover Art Detection & Auto-Import...")
            audio_bytes = wav_path.read_bytes()
            song = _import_single_audio_file(
                audio_bytes=audio_bytes,
                filename="Synthetic_Horizon.wav",
                content_type="audio/wav",
                default_artist=artist,
                album_id=None,  # Leave empty: auto-resolve!
                title=None,     # Leave empty: auto-resolve from filename!
                genre="Synthwave",
                track_number=1,
                download_allowed=True,
                db=db,
                storage=storage,
                companion_artwork=dummy_jpeg,
                companion_mime="image/jpeg",
            )

            assert song.title == "Synthetic_Horizon"
            assert song.cover_url is not None
            assert "/storage/file?key=covers/" in song.cover_url
            print(f"  -> Successfully detected title: '{song.title}'")
            print(f"  -> Successfully extracted & saved cover art: {song.cover_url}")
            print(f"  -> Duration detected: {song.duration}s, Genre: '{song.genre}'")

            print("\n[2] Testing Object Storage persistence...")
            assert storage.exists(song.audio_key)
            # Cover key extraction
            cover_key = song.cover_url.split("key=")[-1]
            assert storage.exists(cover_key)
            print(f"  -> Audio binary in storage: {song.audio_key}")
            print(f"  -> Artwork binary in storage: {cover_key}")

            # 3. Test Embedded Tag & Artwork Detection with Mutagen ID3
            print("\n[3] Testing Embedded ID3 APIC & Metadata Detection...")
            unique_suffix = uuid.uuid4().hex[:6]
            tagged_wav = tmppath / f"tagged_track_{unique_suffix}.wav"
            create_test_wav_file(tagged_wav)

            # Add ID3 tags to WAV file
            try:
                wave_file = WAVE(tagged_wav)
                wave_file.add_tags()
            except Exception:
                wave_file = WAVE(tagged_wav)

            wave_file.tags.add(TIT2(encoding=3, text=[f"Neon Dreamscape {unique_suffix}"]))
            wave_file.tags.add(TPE1(encoding=3, text=[f"Cyber Artist {unique_suffix}"]))
            wave_file.tags.add(TALB(encoding=3, text=[f"Cyber City {unique_suffix}"]))
            wave_file.tags.add(
                APIC(
                    encoding=3,
                    mime="image/jpeg",
                    type=3,  # Front cover
                    desc="Cover Art",
                    data=dummy_jpeg,
                )
            )
            wave_file.save()

            embedded_song = _import_single_audio_file(
                audio_bytes=tagged_wav.read_bytes(),
                filename="tagged_track.wav",
                content_type="audio/wav",
                default_artist=artist,
                album_id=None,
                title=None,
                genre=None,
                track_number=None,
                download_allowed=True,
                db=db,
                storage=storage,
            )

            assert embedded_song.title == f"Neon Dreamscape {unique_suffix}"
            assert embedded_song.artist.name == f"Cyber Artist {unique_suffix}"
            assert embedded_song.album is not None
            assert embedded_song.album.title == f"Cyber City {unique_suffix}"
            assert embedded_song.cover_url is not None
            assert embedded_song.album.cover_url == embedded_song.cover_url
            print(f"  -> Auto-detected Track: '{embedded_song.title}'")
            print(f"  -> Auto-created Artist: '{embedded_song.artist.name}'")
            print(f"  -> Auto-created Album: '{embedded_song.album.title}'")
            print(f"  -> Auto-extracted Embedded Artwork: {embedded_song.cover_url}")

        print("\n==================================================")
        print("   AUTOMATIC DETECTION VERIFIED SUCCESSFULLY!    ")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_auto_detection()
