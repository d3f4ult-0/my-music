from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.artist import Artist
from app.models.album import Album
from app.models.song import Song
from app.models.report import Report, ReportStatus
from app.schemas.auth import UserProfileResponse
from app.auth.dependencies import get_current_admin
from app.storage import get_storage

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin System"],
)


@router.get("/stats")
def get_system_stats(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user_count = db.scalar(select(func.count(User.id)))
    artist_count = db.scalar(select(func.count(Artist.id)))
    album_count = db.scalar(select(func.count(Album.id)))
    song_count = db.scalar(select(func.count(Song.id)))
    pending_reports = db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.PENDING)
    )

    return {
        "users": user_count,
        "artists": artist_count,
        "albums": album_count,
        "songs": song_count,
        "pending_reports": pending_reports,
    }


@router.get("/users", response_model=List[UserProfileResponse])
def list_users(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = db.scalars(
        select(User).offset(offset).limit(limit).order_by(User.id.asc())
    ).all()
    return [
        UserProfileResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            display_name=u.display_name or u.username,
            avatar_url=u.avatar_url,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
            artist_id=u.artist_profile.id if u.artist_profile else None,
            artist_name=u.artist_profile.name if u.artist_profile else None,
        )
        for u in users
    ]


@router.patch("/users/{user_id}/status")
def toggle_user_active(
    user_id: int,
    is_active: bool,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account")

    user.is_active = is_active
    db.commit()
    return {"user_id": user.id, "is_active": user.is_active}


@router.delete("/songs/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_unauthorized_content(
    song_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    storage = get_storage()
    if storage.exists(song.audio_key):
        storage.delete(song.audio_key)

    db.delete(song)
    db.commit()
    return None
