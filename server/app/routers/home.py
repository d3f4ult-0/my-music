from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.song import Song
from app.models.album import Album
from app.models.artist import Artist
from app.models.favorite import Favorite
from app.models.listening_history import ListeningHistory
from app.models.follow import Follow
from app.models.user import User
from app.schemas.music import HomeFeedResponse, ArtistBasic, AlbumBasic, SongResponse
from app.routers.songs import format_song
from app.auth.dependencies import get_optional_user

router = APIRouter(
    prefix="/api/v1/home",
    tags=["Home Feed"],
)


@router.get("", response_model=HomeFeedResponse)
def get_home_feed(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    # Greeting based on server current hour
    hour = datetime.now().hour
    if hour < 12:
        greeting = "Good morning"
    elif hour < 18:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    if current_user and current_user.display_name:
        greeting = f"{greeting}, {current_user.display_name}"

    fav_ids = set()
    recently_played: list[SongResponse] = []
    favorites_list: list[SongResponse] = []

    if current_user:
        fav_records = db.scalars(
            select(Favorite.song_id).where(Favorite.user_id == current_user.id)
        ).all()
        fav_ids = set(fav_records)

        # User's recently played
        recent_entries = db.scalars(
            select(ListeningHistory)
            .options(
                selectinload(ListeningHistory.song).selectinload(Song.artist),
                selectinload(ListeningHistory.song).selectinload(Song.album),
            )
            .where(ListeningHistory.user_id == current_user.id)
            .order_by(ListeningHistory.played_at.desc())
            .limit(10)
        ).all()

        seen_song_ids = set()
        for e in recent_entries:
            if e.song and e.song_id not in seen_song_ids:
                seen_song_ids.add(e.song_id)
                recently_played.append(format_song(e.song, current_user.id, fav_ids))

        # User's favorites
        fav_objs = db.scalars(
            select(Favorite)
            .options(
                selectinload(Favorite.song).selectinload(Song.artist),
                selectinload(Favorite.song).selectinload(Song.album),
            )
            .where(Favorite.user_id == current_user.id)
            .order_by(Favorite.created_at.desc())
            .limit(10)
        ).all()
        favorites_list = [format_song(f.song, current_user.id, fav_ids) for f in fav_objs if f.song]

    # New Releases (latest 8 albums)
    new_albums = db.scalars(
        select(Album)
        .options(selectinload(Album.artist), selectinload(Album.songs))
        .order_by(Album.created_at.desc())
        .limit(8)
    ).all()
    new_releases = [
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
        for a in new_albums
    ]

    # Popular / Trending Songs (deterministic: ordered by ID or release)
    pop_songs = db.scalars(
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .order_by(Song.id.desc())
        .limit(10)
    ).all()
    popular_songs = [
        format_song(s, current_user.id if current_user else None, fav_ids)
        for s in pop_songs
    ]

    # Featured Artists
    artists = db.scalars(select(Artist).order_by(Artist.id.asc()).limit(8)).all()
    featured_artists = [ArtistBasic.model_validate(a) for a in artists]

    return HomeFeedResponse(
        greeting=greeting,
        recently_played=recently_played,
        favorites=favorites_list,
        new_releases=new_releases,
        popular_songs=popular_songs,
        featured_artists=featured_artists,
    )
