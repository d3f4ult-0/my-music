from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.listening_history import ListeningHistory
from app.models.song import Song
from app.models.user import User
from app.models.favorite import Favorite
from app.schemas.music import ListeningHistoryCreateRequest, ListeningHistoryResponse
from app.routers.songs import format_song
from app.auth.dependencies import get_current_user
from app.config import settings

router = APIRouter(
    prefix="/api/v1/history",
    tags=["Listening History"],
)


@router.get("", response_model=List[ListeningHistoryResponse])
def get_listening_history(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.scalars(
        select(ListeningHistory)
        .options(
            selectinload(ListeningHistory.song).selectinload(Song.artist),
            selectinload(ListeningHistory.song).selectinload(Song.album),
        )
        .where(ListeningHistory.user_id == current_user.id)
        .order_by(ListeningHistory.played_at.desc())
        .limit(limit)
    ).all()

    fav_ids = set(
        db.scalars(
            select(Favorite.song_id).where(Favorite.user_id == current_user.id)
        ).all()
    )

    return [
        ListeningHistoryResponse(
            id=entry.id,
            song=format_song(entry.song, current_user.id, fav_ids),
            played_at=entry.played_at,
            progress_seconds=entry.progress_seconds,
            completed=entry.completed,
        )
        for entry in entries
        if entry.song
    ]


@router.post("", status_code=status.HTTP_200_OK)
def record_listening_event(
    request: ListeningHistoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.scalar(select(Song).where(Song.id == request.song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Meaningful listening threshold check:
    # 1. At least 30 seconds
    # 2. Or at least 50% of the duration
    # 3. Or marked completed
    duration = request.duration or song.duration or 1.0
    ratio = request.progress_seconds / max(duration, 1.0)
    is_meaningful = (
        request.completed
        or request.progress_seconds >= settings.history_threshold_seconds
        or ratio >= settings.history_threshold_percentage
    )

    if not is_meaningful:
        return {"status": "ignored_sub_threshold", "recorded": False}

    # Deduplicate within last 2 minutes: update progress rather than spamming rows
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=2)
    recent = db.scalar(
        select(ListeningHistory)
        .where(
            ListeningHistory.user_id == current_user.id,
            ListeningHistory.song_id == request.song_id,
            ListeningHistory.played_at >= cutoff,
        )
        .order_by(ListeningHistory.played_at.desc())
    )

    if recent:
        recent.progress_seconds = max(recent.progress_seconds, request.progress_seconds)
        recent.completed = recent.completed or request.completed
        recent.played_at = now
    else:
        history_entry = ListeningHistory(
            user_id=current_user.id,
            song_id=request.song_id,
            played_at=now,
            progress_seconds=request.progress_seconds,
            completed=request.completed,
        )
        db.add(history_entry)

    db.commit()
    return {"status": "recorded", "recorded": True}
