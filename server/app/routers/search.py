from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.song import Song
from app.models.album import Album
from app.models.artist import Artist
from app.models.playlist import Playlist
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.music import SearchResponse, ArtistBasic, AlbumBasic, PlaylistBasic
from app.routers.songs import format_song
from app.auth.dependencies import get_optional_user

router = APIRouter(
    prefix="/api/v1/search",
    tags=["Search"],
)


@router.get("", response_model=SearchResponse)
def search_catalog(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    search_pattern = f"%{q.strip()}%"

    # Search Songs
    songs = db.scalars(
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .where(or_(Song.title.ilike(search_pattern), Song.genre.ilike(search_pattern)))
        .limit(limit)
    ).all()

    # Search Albums
    albums = db.scalars(
        select(Album)
        .options(selectinload(Album.artist), selectinload(Album.songs))
        .where(Album.title.ilike(search_pattern))
        .limit(limit)
    ).all()

    # Search Artists
    artists = db.scalars(
        select(Artist)
        .where(Artist.name.ilike(search_pattern))
        .limit(limit)
    ).all()

    # Search Playlists (public only or user's own)
    playlist_filter = (Playlist.is_public == True)
    if current_user:
        playlist_filter = or_(playlist_filter, Playlist.user_id == current_user.id)

    playlists = db.scalars(
        select(Playlist)
        .options(selectinload(Playlist.user), selectinload(Playlist.songs))
        .where(playlist_filter, Playlist.name.ilike(search_pattern))
        .limit(limit)
    ).all()

    # Favorites for song formatting
    fav_ids = set()
    if current_user:
        fav_ids = set(
            db.scalars(
                select(Favorite.song_id).where(Favorite.user_id == current_user.id)
            ).all()
        )

    return SearchResponse(
        songs=[format_song(s, current_user.id if current_user else None, fav_ids) for s in songs],
        albums=[
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
            for a in albums
        ],
        artists=[ArtistBasic.model_validate(a) for a in artists],
        playlists=[
            PlaylistBasic(
                id=p.id,
                name=p.name,
                description=p.description,
                cover_url=p.cover_url,
                is_public=p.is_public,
                user_id=p.user_id,
                owner_name=p.user.display_name if p.user else None,
                track_count=len(p.songs),
                created_at=p.created_at,
            )
            for p in playlists
        ],
    )
