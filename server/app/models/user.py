import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, DateTime, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.artist import Artist
    from app.models.playlist import Playlist
    from app.models.favorite import Favorite
    from app.models.listening_history import ListeningHistory
    from app.models.follow import Follow
    from app.models.report import Report


class UserRole(str, enum.Enum):
    USER = "USER"
    ARTIST = "ARTIST"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), default="local_peer", index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100), default="Local Library")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    peer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_roles_enum"),
        default=UserRole.ADMIN,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    artist_profile: Mapped["Artist | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    playlists: Mapped[List["Playlist"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    favorites: Mapped[List["Favorite"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    listening_history: Mapped[List["ListeningHistory"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    following: Mapped[List["Follow"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reports: Mapped[List["Report"]] = relationship(
        back_populates="reporter",
        cascade="all, delete-orphan",
    )
