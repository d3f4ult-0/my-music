from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.favorite import Favorite
from app.models.song import Song
from app.models.user import User
from app.schemas.music import SongResponse
from app.routers.songs import format_song
from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/api/v1/favorites",
    tags=["Favorites"],
)


@router.get("", response_model=List[SongResponse])
def get_user_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorites = db.scalars(
        select(Favorite)
        .options(
            selectinload(Favorite.song).selectinload(Song.artist),
            selectinload(Favorite.song).selectinload(Song.album),
        )
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    ).all()

    all_fav_ids = {f.song_id for f in favorites}
    return [
        format_song(f.song, current_user.id, all_fav_ids)
        for f in favorites
        if f.song
    ]


@router.post("/{song_id}", status_code=status.HTTP_200_OK)
def add_favorite(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    existing = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.song_id == song_id,
        )
    )
    if not existing:
        fav = Favorite(user_id=current_user.id, song_id=song_id)
        db.add(fav)
        db.commit()

    return {"status": "favorited", "song_id": song_id}


@router.delete("/{song_id}", status_code=status.HTTP_200_OK)
def remove_favorite(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.song_id == song_id,
        )
    )
    if fav:
        db.delete(fav)
        db.commit()

    return {"status": "unfavorited", "song_id": song_id}


@router.get("/{song_id}/check")
def check_favorite(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.song_id == song_id,
        )
    )
    return {"song_id": song_id, "is_favorite": fav is not None}
