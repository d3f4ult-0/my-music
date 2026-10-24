from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.lyrics import Lyrics
from app.models.song import Song
from app.services.lyrics.provider import LRCLIBProvider
from app.services.lyrics.parser import is_synced_lrc


class LyricsService:
    def __init__(self):
        self.provider = LRCLIBProvider()

    def get_or_fetch(
        self,
        db: Session,
        song_id: int,
        force_refresh: bool = False,
    ) -> Optional[Lyrics]:
        """
        Gets existing lyrics from database, or automatically fetches authentic
        synchronized lyrics from public providers (LRCLIB) if connected.
        """
        # Find song with artist and album relations
        song = db.scalar(
            select(Song)
            .options(selectinload(Song.artist), selectinload(Song.album))
            .where(Song.id == song_id)
        )
        if not song:
            return None

        # Check existing cached lyrics in database
        existing_lyrics = db.scalar(select(Lyrics).where(Lyrics.song_id == song_id))
        if existing_lyrics and not force_refresh:
            return existing_lyrics

        # Fetch authentic lyrics from public provider
        artist_name = song.artist.name if song.artist else ""
        album_name = song.album.title if song.album else None

        result = self.provider.search(
            title=song.title,
            artist=artist_name,
            album=album_name,
            duration=song.duration,
        )

        if not result:
            return existing_lyrics  # Return existing if refresh yielded nothing

        if existing_lyrics:
            existing_lyrics.lyrics_text = result.lyrics_text
            existing_lyrics.synced = result.synced
            existing_lyrics.provider = result.provider
            db.commit()
            db.refresh(existing_lyrics)
            return existing_lyrics

        new_lyrics = Lyrics(
            song_id=song.id,
            lyrics_text=result.lyrics_text,
            synced=result.synced,
            provider=result.provider,
        )
        db.add(new_lyrics)
        db.commit()
        db.refresh(new_lyrics)
        return new_lyrics

    def save_custom_lyrics(
        self,
        db: Session,
        song_id: int,
        lyrics_text: str,
        synced: Optional[bool] = None,
    ) -> Lyrics:
        """Saves user-uploaded or pasted lyrics for a song."""
        clean_text = lyrics_text.strip()
        auto_synced = is_synced_lrc(clean_text) if synced is None else synced

        existing = db.scalar(select(Lyrics).where(Lyrics.song_id == song_id))
        if existing:
            existing.lyrics_text = clean_text
            existing.synced = auto_synced
            existing.provider = "user_uploaded"
            db.commit()
            db.refresh(existing)
            return existing

        new_lyrics = Lyrics(
            song_id=song_id,
            lyrics_text=clean_text,
            synced=auto_synced,
            provider="user_uploaded",
        )
        db.add(new_lyrics)
        db.commit()
        db.refresh(new_lyrics)
        return new_lyrics
