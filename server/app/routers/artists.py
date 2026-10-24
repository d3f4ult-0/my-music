from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.artist import Artist
from app.models.album import Album
from app.models.song import Song
from app.models.follow import Follow
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.music import ArtistBasic, ArtistDetail, AlbumBasic
from app.routers.songs import format_song
from app.auth.dependencies import get_optional_user, get_current_user

router = APIRouter(
    prefix="/api/v1/artists",
    tags=["Artists"],
)


@router.get("", response_model=List[ArtistBasic])
def get_artists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    artists = db.scalars(
        select(Artist).offset(offset).limit(limit).order_by(Artist.name.asc())
    ).all()
    return [ArtistBasic.model_validate(a) for a in artists]


@router.get("/{artist_id}", response_model=ArtistDetail)
def get_artist(
    artist_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    artist = db.scalar(
        select(Artist)
        .options(
            selectinload(Artist.albums),
            selectinload(Artist.songs).selectinload(Song.album),
            selectinload(Artist.followers),
        )
        .where(Artist.id == artist_id)
    )
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    follower_count = len(artist.followers)
    is_following = False
    user_fav_ids = set()
    if current_user:
        is_following = any(f.user_id == current_user.id for f in artist.followers)
        user_fav_ids = set(
            db.scalars(
                select(Favorite.song_id).where(Favorite.user_id == current_user.id)
            ).all()
        )

    # Format albums
    formatted_albums = [
        AlbumBasic(
            id=a.id,
            title=a.title,
            cover_url=a.cover_url,
            release_date=a.release_date,
            year=a.year,
            artist_id=artist.id,
            artist_name=artist.name,
            track_count=len(a.songs) if hasattr(a, "songs") else 0,
        )
        for a in artist.albums
    ]

    # Format popular songs (first 10 songs)
    popular = [
        format_song(s, current_user.id if current_user else None, user_fav_ids)
        for s in artist.songs[:10]
    ]

    return ArtistDetail(
        id=artist.id,
        name=artist.name,
        bio=artist.bio,
        image_url=artist.image_url,
        follower_count=follower_count,
        is_following=is_following,
        albums=formatted_albums,
        popular_songs=popular,
    )


@router.post("/{artist_id}/follow", status_code=status.HTTP_200_OK)
def follow_artist(
    artist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    artist = db.scalar(select(Artist).where(Artist.id == artist_id))
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    existing = db.scalar(
        select(Follow).where(
            Follow.user_id == current_user.id,
            Follow.artist_id == artist_id,
        )
    )
    if not existing:
        follow = Follow(user_id=current_user.id, artist_id=artist_id)
        db.add(follow)
        db.commit()

    return {"status": "following", "artist_id": artist_id}


@router.delete("/{artist_id}/follow", status_code=status.HTTP_200_OK)
def unfollow_artist(
    artist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    follow = db.scalar(
        select(Follow).where(
            Follow.user_id == current_user.id,
            Follow.artist_id == artist_id,
        )
    )
    if follow:
        db.delete(follow)
        db.commit()

    return {"status": "unfollowed", "artist_id": artist_id}
