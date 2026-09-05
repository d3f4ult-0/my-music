from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from pathlib import Path
import mimetypes

from app.database import get_db
from app.models import Album, Artist, Genre, Track, TrackArtist, TrackGenre
from app.schemas.library import AlbumResponse,ArtistResponse,GenreResponse,TrackResponse
from app.services.library_scanner import scan_library
from app.config import settings

router = APIRouter(
    prefix="/library",
    tags=["Library"],
)


@router.get("/tracks", response_model=list[TrackResponse])
def get_tracks(db: Session = Depends(get_db)):
    tracks = db.scalars(
        select(Track)
        .options(
            selectinload(Track.artist_links)
            .selectinload(TrackArtist.artist),

            selectinload(Track.genre_links)
            .selectinload(TrackGenre.genre),

            selectinload(Track.album),
        )
        .order_by(Track.title)
    ).all()

    return [
        TrackResponse(
            id=track.id,
            title=track.title,

            artists=[
                ArtistResponse.model_validate(link.artist)
                for link in track.artist_links
            ],

            album=(
                AlbumResponse.model_validate(track.album)
                if track.album
                else None
            ),

            genres=[
                GenreResponse.model_validate(link.genre)
                for link in track.genre_links
            ],

            track_number=track.track_number,
            disc_number=track.disc_number,
            duration_seconds=track.duration_seconds,

            codec=track.codec,
            bitrate=track.bitrate,
            sample_rate=track.sample_rate,
            bit_depth=track.bit_depth,
            channels=track.channels,
        )
        for track in tracks
    ]


@router.get("/albums", response_model=list[AlbumResponse])
def get_albums(
    db: Session = Depends(get_db),
):
    albums = db.scalars(
        select(Album).order_by(Album.title)
    ).all()

    return albums

@router.get("/albums/{album_id}/artwork")
def get_album_artwork(
    album_id: int,
    db: Session = Depends(get_db),
):
    album = db.scalar(
        select(Album).where(Album.id == album_id)
    )

    if album is None:
        raise HTTPException(
            status_code=404,
            detail="Album not found",
        )

    if not album.artwork_path:
        raise HTTPException(
            status_code=404,
            detail="Album artwork not found",
        )

    artwork_path = Path(album.artwork_path)

    if not artwork_path.is_absolute():
        artwork_path = (
            Path(__file__).resolve().parents[2]
            / artwork_path
        )

    if not artwork_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Artwork file not found",
        )

    media_type, _ = mimetypes.guess_type(
        artwork_path.name
    )

    if media_type is None:
        media_type = "application/octet-stream"

    return FileResponse(
        path=artwork_path,
        media_type=media_type,
    )

@router.get("/artists", response_model=list[ArtistResponse])
def get_artists(
    db: Session = Depends(get_db),
):
    artists = db.scalars(
        select(Artist).order_by(Artist.name)
    ).all()

    return artists


@router.get("/genres", response_model=list[GenreResponse])
def get_genres(
    db: Session = Depends(get_db),
):
    genres = db.scalars(
        select(Genre).order_by(Genre.name)
    ).all()

    return genres


@router.get("/search", response_model=list[TrackResponse])
def search_library(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    search_term = f"%{q}%"

    tracks = db.scalars(
        select(Track)
        .outerjoin(TrackArtist, TrackArtist.track_id == Track.id)
        .outerjoin(Artist, Artist.id == TrackArtist.artist_id)
        .outerjoin(Album, Album.id == Track.album_id)
        .outerjoin(TrackGenre, TrackGenre.track_id == Track.id)
        .outerjoin(Genre, Genre.id == TrackGenre.genre_id)
        .options(
            selectinload(Track.artist_links)
            .selectinload(TrackArtist.artist),

            selectinload(Track.genre_links)
            .selectinload(TrackGenre.genre),

            selectinload(Track.album),
        )
        .where(
            (Track.title.ilike(search_term))
            | (Artist.name.ilike(search_term))
            | (Album.title.ilike(search_term))
            | (Genre.name.ilike(search_term))
        )
        .distinct()
        .order_by(Track.title)
    ).all()

    return [
        TrackResponse(
            id=track.id,
            title=track.title,

            artists=[
                ArtistResponse.model_validate(link.artist)
                for link in track.artist_links
            ],

            album=(
                AlbumResponse.model_validate(track.album)
                if track.album
                else None
            ),

            genres=[
                GenreResponse.model_validate(link.genre)
                for link in track.genre_links
            ],

            track_number=track.track_number,
            disc_number=track.disc_number,
            duration_seconds=track.duration_seconds,

            codec=track.codec,
            bitrate=track.bitrate,
            sample_rate=track.sample_rate,
            bit_depth=track.bit_depth,
            channels=track.channels,
        )
        for track in tracks
    ]

@router.post("/scan")
def scan_music_library(
    db: Session = Depends(get_db),
):
    result = scan_library(
        db,
        settings.music_directory,
    )

    return result

@router.get("/tracks/{track_id}/stream")
def stream_track(
    track_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    track = db.scalar(
        select(Track).where(Track.id == track_id)
    )

    if track is None:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    file_path = Path(track.file_path)

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    # No Range header: return the complete file
    if not range_header:
        return FileResponse(
            path=file_path,
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            },
            filename=file_path.name,
        )

    # Parse: bytes=start-end
    if not range_header.startswith("bytes="):
        raise HTTPException(
            status_code=416,
            detail="Invalid Range header",
        )

    range_value = range_header.replace("bytes=", "", 1)

    try:
        start_str, end_str = range_value.split("-", 1)

        start = int(start_str)

        if end_str:
            end = int(end_str)
        else:
            end = file_size - 1

    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=416,
            detail="Invalid Range header",
        )

    if start < 0 or start >= file_size:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
        )

    end = min(end, file_size - 1)

    if start > end:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
        )

    content_length = end - start + 1

    def file_iterator():
        with open(file_path, "rb") as audio_file:
            audio_file.seek(start)

            remaining = content_length

            while remaining > 0:
                chunk_size = min(1024 * 1024, remaining)
                chunk = audio_file.read(chunk_size)

                if not chunk:
                    break

                yield chunk
                remaining -= len(chunk)

    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        file_iterator(),
        status_code=206,
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
        },
    )