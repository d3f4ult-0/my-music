from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.album import Album
from app.models.song import Song
from app.models.artist import Artist
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.music import AlbumBasic, AlbumDetail, ArtistBasic
from app.routers.songs import format_song
from app.auth.dependencies import get_optional_user

router = APIRouter(
    prefix="/api/v1/albums",
    tags=["Albums"],
)


@router.get("", response_model=List[AlbumBasic])
def get_albums(
    artist_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = (
        select(Album)
        .options(selectinload(Album.artist), selectinload(Album.songs))
        .offset(offset)
        .limit(limit)
        .order_by(Album.release_date.desc().nullslast(), Album.id.desc())
    )
    if artist_id:
        query = query.where(Album.artist_id == artist_id)

    albums = db.scalars(query).all()
    results = []
    for a in albums:
        results.append(
            AlbumBasic(
                id=a.id,
                title=a.title,
                cover_url=a.cover_url,
                release_date=a.release_date,
                year=a.year,
                artist_id=a.artist_id,
                artist_name=a.artist.name if a.artist else None,
                track_count=len(a.songs),
            )
        )
    return results


@router.get("/{album_id}", response_model=AlbumDetail)
def get_album(
    album_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    album = db.scalar(
        select(Album)
        .options(
            selectinload(Album.artist),
            selectinload(Album.songs).selectinload(Song.artist),
        )
        .where(Album.id == album_id)
    )
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    user_fav_ids = set()
    if current_user:
        user_fav_ids = set(
            db.scalars(
                select(Favorite.song_id).where(Favorite.user_id == current_user.id)
            ).all()
        )

    formatted_tracks = [
        format_song(s, current_user.id if current_user else None, user_fav_ids)
        for s in sorted(album.songs, key=lambda s: (s.disc_number or 1, s.track_number or 0))
    ]

    return AlbumDetail(
        id=album.id,
        title=album.title,
        description=album.description,
        cover_url=album.cover_url,
        release_date=album.release_date,
        year=album.year,
        artist=ArtistBasic(
            id=album.artist.id,
            name=album.artist.name,
            image_url=album.artist.image_url,
        ),
        tracks=formatted_tracks,
    )
