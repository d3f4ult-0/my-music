from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Lyrics, Track
from app.services.lyrics.provider import LRCLIBProvider


class LyricsService:
    def __init__(self):
        self.provider = LRCLIBProvider()

    def get_or_fetch(
        self,
        db: Session,
        track_id: int,
    ) -> Lyrics | None:

        # Find the track.
        track = db.scalar(
            select(Track).where(
                Track.id == track_id
            )
        )

        if track is None:
            return None

        # Check the local database first.
        lyrics = db.scalar(
            select(Lyrics).where(
                Lyrics.track_id == track_id
            )
        )

        if lyrics is not None:
            return lyrics

        # Get the primary artist.
        artist_name = None

        if track.artist_links:
            artist_name = (
                track.artist_links[0].artist.name
            )

        if not artist_name:
            return None

        # Get album information.
        album_name = None

        if track.album:
            album_name = track.album.title

        # Ask the provider.
        result = self.provider.search(
            title=track.title,
            artist=artist_name,
            album=album_name,
            duration=track.duration_seconds,
        )

        if result is None:
            return None

        # Save the result to PostgreSQL.
        lyrics = Lyrics(
            track_id=track.id,
            lyrics_text=result.lyrics_text,
            synced=result.synced,
            provider=result.provider,
        )

        db.add(lyrics)
        db.commit()
        db.refresh(lyrics)

        return lyrics