from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Text, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.song import Song


class Lyrics(Base):
    __tablename__ = "lyrics"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )
    song_id: Mapped[int] = mapped_column(
        ForeignKey("songs.id", ondelete="CASCADE"),
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
    provider: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    song: Mapped["Song"] = relationship(
        back_populates="lyrics",
    )

    # Compatibility alias
    @property
    def track_id(self) -> int:
        return self.song_id

    @track_id.setter
    def track_id(self, value: int):
        self.song_id = value

    @property
    def track(self) -> "Song":
        return self.song
