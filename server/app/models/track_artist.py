from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.song import Song
    from app.models.artist import Artist


class TrackArtist(Base):
    __tablename__ = "track_artists"

    track_id: Mapped[int] = mapped_column(
        ForeignKey("songs.id", ondelete="CASCADE"),
        primary_key=True,
    )

    artist_id: Mapped[int] = mapped_column(
        ForeignKey("artists.id", ondelete="CASCADE"),
        primary_key=True,
    )

    track: Mapped["Song"] = relationship(
        back_populates="artist_links",
    )

    artist: Mapped["Artist"] = relationship(
        back_populates="track_links",
    )
