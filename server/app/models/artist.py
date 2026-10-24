from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.album import Album
    from app.models.song import Song
    from app.models.follow import Follow
    from app.models.track_artist import TrackArtist


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
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

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        back_populates="artist_profile",
    )
    albums: Mapped[List["Album"]] = relationship(
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    songs: Mapped[List["Song"]] = relationship(
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    track_links: Mapped[List["TrackArtist"]] = relationship(
        back_populates="artist",
        cascade="all, delete-orphan",
    )
    followers: Mapped[List["Follow"]] = relationship(
        back_populates="artist",
        cascade="all, delete-orphan",
    )
