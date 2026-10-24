from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.song import Song
from app.models.artist import Artist
from app.models.album import Album
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.music import SongResponse, ArtistBasic
from app.auth.dependencies import get_optional_user, get_current_user
from app.storage import get_storage

router = APIRouter(
    prefix="/api/v1/songs",
    tags=["Songs"],
)


def format_song(song: Song, current_user_id: Optional[int] = None, user_favorite_ids: Optional[set] = None) -> SongResponse:
    is_fav = False
    if user_favorite_ids is not None:
        is_fav = song.id in user_favorite_ids
    elif current_user_id is not None and hasattr(song, "favorites"):
        is_fav = any(f.user_id == current_user_id for f in song.favorites)

    artist_basic = None
    if song.artist:
        artist_basic = ArtistBasic(
            id=song.artist.id,
            name=song.artist.name,
            image_url=song.artist.image_url,
        )

    return SongResponse(
        id=song.id,
        title=song.title,
        description=song.description,
        duration=song.duration,
        track_number=song.track_number,
        disc_number=song.disc_number,
        audio_key=song.audio_key,
        cover_url=song.cover_url or (song.album.cover_url if song.album else None),
        genre=song.genre,
        release_date=song.release_date,
        download_allowed=song.download_allowed,
        artist=artist_basic,
        album_id=song.album_id,
        album_title=song.album.title if song.album else None,
        is_favorite=is_fav,
        stream_url=f"/api/v1/songs/{song.id}/stream",
        codec=song.codec,
        bitrate=song.bitrate,
    )


@router.get("", response_model=List[SongResponse])
def get_songs(
    genre: Optional[str] = None,
    artist_id: Optional[int] = None,
    album_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    query = (
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .offset(offset)
        .limit(limit)
        .order_by(Song.id.asc())
    )
    if genre:
        query = query.where(Song.genre.ilike(f"%{genre}%"))
    if artist_id:
        query = query.where(Song.artist_id == artist_id)
    if album_id:
        query = query.where(Song.album_id == album_id)

    songs = db.scalars(query).all()

    user_fav_ids = set()
    if current_user:
        fav_records = db.scalars(
            select(Favorite.song_id).where(Favorite.user_id == current_user.id)
        ).all()
        user_fav_ids = set(fav_records)

    return [format_song(s, current_user.id if current_user else None, user_fav_ids) for s in songs]


@router.get("/{song_id}", response_model=SongResponse)
def get_song(
    song_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    song = db.scalar(
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .where(Song.id == song_id)
    )
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    is_fav = False
    if current_user:
        is_fav = db.scalar(
            select(Favorite).where(
                Favorite.user_id == current_user.id,
                Favorite.song_id == song.id,
            )
        ) is not None

    return format_song(song, current_user.id if current_user else None, {song.id} if is_fav else set())


@router.get("/{song_id}/stream")
def stream_song(
    song_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    storage = get_storage()
    if not storage.exists(song.audio_key):
        raise HTTPException(status_code=404, detail="Audio file not found in storage")

    total_size = storage.get_file_size(song.audio_key)
    range_header = request.headers.get("range")

    # Full file response if no Range requested
    if not range_header:
        chunks, start, size, mime = storage.get_stream(song.audio_key, start=0)
        return StreamingResponse(
            chunks,
            media_type=mime,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(total_size),
                "Content-Type": mime,
            },
        )

    # HTTP Range Request: bytes=start-end
    if not range_header.startswith("bytes="):
        raise HTTPException(status_code=416, detail="Invalid Range header")

    range_val = range_header.replace("bytes=", "", 1).strip()
    try:
        parts = range_val.split("-", 1)
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else total_size - 1
    except (ValueError, IndexError):
        raise HTTPException(status_code=416, detail="Invalid Range header")

    if start < 0 or start >= total_size or start > end:
        raise HTTPException(status_code=416, detail="Range not satisfiable")

    end = min(end, total_size - 1)
    content_length = end - start + 1

    chunks, _, _, mime = storage.get_stream(song.audio_key, start=start, length=content_length)

    return StreamingResponse(
        chunks,
        status_code=206,
        media_type=mime,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{total_size}",
            "Content-Length": str(content_length),
            "Content-Type": mime,
        },
    )


@router.get("/{song_id}/download")
def download_song(
    song_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.scalar(
        select(Song)
        .options(selectinload(Song.artist))
        .where(Song.id == song_id)
    )
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Download permission gate
    if not song.download_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The artist has disabled downloads for this track.",
        )

    storage = get_storage()
    if not storage.exists(song.audio_key):
        raise HTTPException(status_code=404, detail="Audio file not found in storage")

    filename = f"{song.title}.mp3"
    if song.artist:
        filename = f"{song.artist.name} - {song.title}.mp3"
    # Sanitize filename
    clean_filename = "".join(c for c in filename if c.isalnum() or c in (" ", "-", "_", ".")).strip()

    # If S3/remote storage, redirect to presigned signed download URL
    if hasattr(storage, "generate_download_url") and not storage.__class__.__name__ == "LocalStorage":
        signed_url = storage.generate_download_url(song.audio_key, filename=clean_filename)
        return RedirectResponse(url=signed_url, status_code=307)

    # Local stream download
    total_size = storage.get_file_size(song.audio_key)
    chunks, _, _, mime = storage.get_stream(song.audio_key, start=0)

    return StreamingResponse(
        chunks,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Content-Length": str(total_size),
        },
    )
