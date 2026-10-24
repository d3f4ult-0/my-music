import math
import struct
import io
import wave
from datetime import datetime, timezone, timedelta
from typing import Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal, Base
from app.models.user import User, UserRole
from app.models.artist import Artist
from app.models.album import Album
from app.models.song import Song
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.favorite import Favorite
from app.models.listening_history import ListeningHistory
from app.auth.security import hash_password
from app.storage import get_storage


def generate_synthesized_wav(duration_sec: float = 3.0, freq: float = 440.0) -> bytes:
    """Generates a valid, lightweight PCM WAV audio file with a musical tone."""
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            # Generate harmonic wave with envelope decay
            t = float(i) / sample_rate
            decay = max(0.1, 1.0 - (t / duration_sec) * 0.7)
            sample = 0.5 * math.sin(2.0 * math.pi * freq * t) + 0.25 * math.sin(2.0 * math.pi * (freq * 1.5) * t)
            value = int(sample * decay * 32767.0 * 0.5)
            frames.extend(struct.pack("<h", max(-32767, min(32767, value))))

        wav_file.writeframes(frames)

    return buffer.getvalue()


def seed_database():
    """Seeds the platform with 3 artists, 5 albums, 15 songs, 5 playlists, and 2 users."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    storage = get_storage()

    try:
        # Check if already seeded
        existing_songs = db.scalar(select(Song))
        if existing_songs:
            print("Database already contains songs. Skipping seed.")
            return

        print("--- Starting Seed Data Generation ---")

        # 1. Users
        listener_user = User(
            username="demo_listener",
            email="listener@mymusic.dev",
            password_hash=hash_password("DemoPassword123!"),
            display_name="Demo Listener",
            role=UserRole.USER,
        )
        artist_user = User(
            username="demo_artist",
            email="artist@mymusic.dev",
            password_hash=hash_password("DemoArtist123!"),
            display_name="Komorebi Studio",
            role=UserRole.ARTIST,
        )
        admin_user = User(
            username="demo_admin",
            email="admin@mymusic.dev",
            password_hash=hash_password("DemoAdmin123!"),
            display_name="Platform Admin",
            role=UserRole.ADMIN,
        )
        db.add_all([listener_user, artist_user, admin_user])
        db.flush()

        # 2. Artists (3 Artists)
        artist_1 = Artist(
            user_id=artist_user.id,
            name="Komorebi Strings",
            bio="Neoclassical and acoustic ensemble blending solo cello, acoustic guitar, and organic soundscapes.",
            image_url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
        )
        artist_2 = Artist(
            name="Neon Horizon",
            bio="Synthesizer composer crafting 80s retrowave, outrun aesthetics, and cybernetic night drives.",
            image_url="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
        )
        artist_3 = Artist(
            name="Luna Sol",
            bio="Indie-folk singer-songwriter fusing warm tape saturation with acoustic fingerpicking and dreamy vocals.",
            image_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=80",
        )
        db.add_all([artist_1, artist_2, artist_3])
        db.flush()

        # 3. Albums (5 Albums)
        now = datetime.now(timezone.utc)
        album_1 = Album(
            artist_id=artist_1.id,
            title="Whispering Pines",
            description="Organic acoustic pieces recorded in a mountain cabin.",
            cover_url="https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop&q=80",
            year=2024,
            release_date=now - timedelta(days=200),
        )
        album_2 = Album(
            artist_id=artist_1.id,
            title="Echoes of Dawn",
            description="Minimal cello and piano meditations for the quiet hours.",
            cover_url="https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop&q=80",
            year=2025,
            release_date=now - timedelta(days=80),
        )
        album_3 = Album(
            artist_id=artist_2.id,
            title="Midnight Circuit",
            description="High-energy analog synths, gated reverbs, and highway basslines.",
            cover_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
            year=2024,
            release_date=now - timedelta(days=150),
        )
        album_4 = Album(
            artist_id=artist_2.id,
            title="Retrograde Dreams",
            description="Chilled chillwave and nostalgic electronic reveries.",
            cover_url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
            year=2025,
            release_date=now - timedelta(days=30),
        )
        album_5 = Album(
            artist_id=artist_3.id,
            title="Velvet Daylight",
            description="Intimate folk recordings captured on vintage reel-to-reel tape.",
            cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80",
            year=2025,
            release_date=now - timedelta(days=15),
        )
        db.add_all([album_1, album_2, album_3, album_4, album_5])
        db.flush()

        # 4. Songs (15 Songs with real audio files)
        song_definitions = [
            # Album 1 (Komorebi Strings)
            (album_1, artist_1, "Forest Canopy", "Ambient", 184.0, 1, 261.63, True),
            (album_1, artist_1, "Morning Mist", "Acoustic", 212.0, 2, 293.66, True),
            (album_1, artist_1, "First Light", "Neoclassical", 195.0, 3, 329.63, True),
            # Album 2 (Komorebi Strings)
            (album_2, artist_1, "Forgotten Path", "Ambient", 240.0, 1, 349.23, True),
            (album_2, artist_1, "Evening Dew", "Acoustic", 198.0, 2, 392.00, True),
            (album_2, artist_1, "Solitude", "Classical", 265.0, 3, 440.00, False),  # Download forbidden
            # Album 3 (Neon Horizon)
            (album_3, artist_2, "Neon Velocity", "Synthwave", 220.0, 1, 220.00, True),
            (album_3, artist_2, "Cyberpunk Rain", "Electronic", 245.0, 2, 246.94, True),
            (album_3, artist_2, "Grid Runner", "Retrowave", 210.0, 3, 277.18, True),
            # Album 4 (Neon Horizon)
            (album_4, artist_2, "Synthetic Heart", "Chillwave", 230.0, 1, 311.13, False),  # Download forbidden
            (album_4, artist_2, "Starlight Overdrive", "Electronic", 260.0, 2, 369.99, True),
            (album_4, artist_2, "Digital Sunset", "Synthwave", 215.0, 3, 415.30, True),
            # Album 5 (Luna Sol)
            (album_5, artist_3, "Golden Hour", "Indie Folk", 205.0, 1, 261.63, True),
            (album_5, artist_3, "Paper Cranes", "Lo-Fi Folk", 188.0, 2, 329.63, True),
            (album_5, artist_3, "Lavender Skies", "Dream Pop", 235.0, 3, 392.00, True),
        ]

        created_songs: list[Song] = []
        for alb, art, title, genre, dur, track_no, freq, dl_allowed in song_definitions:
            # Generate valid audio bytes
            audio_bytes = generate_synthesized_wav(duration_sec=3.0, freq=freq)
            key = f"audio/{art.id}/{alb.id}/{title.lower().replace(' ', '_')}.wav"
            storage.upload(key, audio_bytes, content_type="audio/wav")

            song = Song(
                album_id=alb.id,
                artist_id=art.id,
                title=title,
                duration=dur,
                track_number=track_no,
                audio_key=key,
                cover_url=alb.cover_url,
                genre=genre,
                download_allowed=dl_allowed,
                codec="audio/wav",
                bitrate=352800,
                sample_rate=22050,
                channels=1,
                bit_depth=16,
                file_size_bytes=len(audio_bytes),
            )
            db.add(song)
            created_songs.append(song)

        db.flush()

        # 5. Playlists (5 Playlists)
        pl_1 = Playlist(
            user_id=listener_user.id,
            name="Deep Focus & Study",
            description="Gentle acoustic and ambient textures to keep you immersed.",
            cover_url="https://images.unsplash.com/photo-1507842229451-7f4153093284?w=500&auto=format&fit=crop&q=80",
            is_public=True,
        )
        pl_2 = Playlist(
            user_id=listener_user.id,
            name="Late Night Driving",
            description="Retro synths and neon-lit cruising tracks.",
            cover_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
            is_public=True,
        )
        pl_3 = Playlist(
            user_id=listener_user.id,
            name="Morning Acoustic Calm",
            description="Soft strings and warming melodies for a peaceful start.",
            cover_url="https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop&q=80",
            is_public=True,
        )
        pl_4 = Playlist(
            user_id=artist_user.id,
            name="Synthwave Essentials",
            description="The premier collection of cyberpunk and outrun soundscapes.",
            cover_url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
            is_public=True,
        )
        pl_5 = Playlist(
            user_id=listener_user.id,
            name="Lo-Fi Sunday Vibes",
            description="Dreamy vocals, cozy acoustic guitars, and relaxed afternoons.",
            cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80",
            is_public=True,
        )
        db.add_all([pl_1, pl_2, pl_3, pl_4, pl_5])
        db.flush()

        # Add songs to playlists with explicit position
        for pos, s in enumerate(created_songs[0:5]):
            db.add(PlaylistSong(playlist_id=pl_1.id, song_id=s.id, position=pos, added_at=now))
        for pos, s in enumerate(created_songs[6:12]):
            db.add(PlaylistSong(playlist_id=pl_2.id, song_id=s.id, position=pos, added_at=now))
        for pos, s in enumerate([created_songs[0], created_songs[1], created_songs[4], created_songs[12]]):
            db.add(PlaylistSong(playlist_id=pl_3.id, song_id=s.id, position=pos, added_at=now))
        for pos, s in enumerate(created_songs[6:12]):
            db.add(PlaylistSong(playlist_id=pl_4.id, song_id=s.id, position=pos, added_at=now))
        for pos, s in enumerate(created_songs[12:15] + [created_songs[1], created_songs[7]]):
            db.add(PlaylistSong(playlist_id=pl_5.id, song_id=s.id, position=pos, added_at=now))

        # 6. Favorites for demo listener
        for s in [created_songs[0], created_songs[6], created_songs[12], created_songs[3]]:
            db.add(Favorite(user_id=listener_user.id, song_id=s.id, created_at=now))

        # 7. Listening History
        for i, s in enumerate([created_songs[0], created_songs[6], created_songs[1]]):
            db.add(
                ListeningHistory(
                    user_id=listener_user.id,
                    song_id=s.id,
                    played_at=now - timedelta(hours=i * 2 + 1),
                    progress_seconds=120.0,
                    completed=True,
                )
            )

        db.commit()
        print("--- Seed Data Successfully Inserted! ---")
        print(f"Users: 3 (listener, artist, admin)")
        print(f"Artists: 3")
        print(f"Albums: 5")
        print(f"Songs: {len(created_songs)}")
        print(f"Playlists: 5")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
