from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    track_links: Mapped[list["TrackArtist"]] = relationship(
        back_populates="artist",
        cascade="all, delete-orphan",
    )