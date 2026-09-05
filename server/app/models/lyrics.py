from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.track import Track

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Lyrics(Base):
    __tablename__ = "lyrics"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    lyrics_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    synced: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    provider: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    track: Mapped["Track"] = relationship(
        back_populates="lyrics",
    )