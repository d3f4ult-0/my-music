from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    album_id: Mapped[int | None] = mapped_column(
        ForeignKey("albums.id", ondelete="SET NULL"),
        nullable=True,
    )

    track_number: Mapped[int | None] = mapped_column(nullable=True)
    disc_number: Mapped[int | None] = mapped_column(nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(nullable=True)

    file_path: Mapped[str] = mapped_column(
        String(2048),
        nullable=False,
        unique=True,
    )

    codec: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    bitrate: Mapped[int | None] = mapped_column(nullable=True)
    sample_rate: Mapped[int | None] = mapped_column(nullable=True)
    bit_depth: Mapped[int | None] = mapped_column(nullable=True)
    channels: Mapped[int | None] = mapped_column(nullable=True)

    album: Mapped["Album | None"] = relationship(
        back_populates="tracks"
    )

    artist_links: Mapped[list["TrackArtist"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
    )

    genre_links: Mapped[list["TrackGenre"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
    )

    lyrics: Mapped["Lyrics | None"] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
        uselist=False,
    )