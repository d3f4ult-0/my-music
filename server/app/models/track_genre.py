from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrackGenre(Base):
    __tablename__ = "track_genres"

    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"),
        primary_key=True,
    )

    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="CASCADE"),
        primary_key=True,
    )

    track: Mapped["Track"] = relationship(
        back_populates="genre_links"
    )

    genre: Mapped["Genre"] = relationship(
        back_populates="track_links"
    )