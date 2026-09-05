from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    album_artist_id: Mapped[int | None] = mapped_column(
        ForeignKey("artists.id", ondelete="SET NULL"),
        nullable=True,
    )

    year: Mapped[int | None] = mapped_column(nullable=True)

    artwork_path: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )

    tracks: Mapped[list["Track"]] = relationship(
        back_populates="album"
    )

    album_artist: Mapped["Artist | None"] = relationship(
        foreign_keys=[album_artist_id]
    )