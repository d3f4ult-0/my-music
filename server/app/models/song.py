from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.album import Album
    from app.models.lyrics import Lyrics
    from app.models.favorite import Favorite
    from app.models.playlist_song import PlaylistSong
    from app.models.listening_history import ListeningHistory
    from app.models.report import Report
    from app.models.track_artist import TrackArtist
    from app.models.track_genre import TrackGenre


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    album_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("albums.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    artist_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    track_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disc_number: Mapped[Optional[int]] = mapped_column(Integer, default=1, nullable=True)
    audio_key: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True, index=True)
    cover_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    genre: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    release_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    download_allowed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audio file technical attributes
    codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bitrate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bit_depth: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    channels: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Helper alias
    @property
    def duration_seconds(self) -> float:
        return self.duration

    @duration_seconds.setter
    def duration_seconds(self, value: float):
        self.duration = value

    @property
    def file_path(self) -> str:
        return self.audio_key

    @file_path.setter
    def file_path(self, value: str):
        self.audio_key = value

    # Relationships
    album: Mapped[Optional["Album"]] = relationship(
        back_populates="songs",
    )
    artist: Mapped[Optional["Artist"]] = relationship(
        back_populates="songs",
    )
    lyrics: Mapped[Optional["Lyrics"]] = relationship(
        back_populates="song",
        uselist=False,
        cascade="all, delete-orphan",
    )
    favorites: Mapped[List["Favorite"]] = relationship(
        back_populates="song",
        cascade="all, delete-orphan",
    )
    playlist_songs: Mapped[List["PlaylistSong"]] = relationship(
        back_populates="song",
        cascade="all, delete-orphan",
    )
    history_entries: Mapped[List["ListeningHistory"]] = relationship(
        back_populates="song",
        cascade="all, delete-orphan",
    )
    reports: Mapped[List["Report"]] = relationship(
        back_populates="song",
        cascade="all, delete-orphan",
    )
    artist_links: Mapped[List["TrackArtist"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
    )
    genre_links: Mapped[List["TrackGenre"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
    )
