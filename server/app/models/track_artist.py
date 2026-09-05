from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrackArtist(Base):
    __tablename__ = "track_artists"

    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"),
        primary_key=True,
    )

    artist_id: Mapped[int] = mapped_column(
        ForeignKey("artists.id", ondelete="CASCADE"),
        primary_key=True,
    )

    track: Mapped["Track"] = relationship(
        back_populates="artist_links"
    )

    artist: Mapped["Artist"] = relationship(
        back_populates="track_links"
    )