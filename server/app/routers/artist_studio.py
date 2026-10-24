import os
import uuid
import tempfile
import mimetypes
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.artist import Artist
from app.models.album import Album
from app.models.song import Song
from app.models.user import User, UserRole
from app.schemas.music import SongResponse, AlbumBasic
from app.routers.songs import format_song
from app.auth.dependencies import get_current_artist
from app.storage import get_storage
from app.services.metadata import read_metadata

router = APIRouter(
    prefix="/api/v1/studio",
    tags=["Artist & Music Import Studio"],
)

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".flac", ".m4a", ".wav", ".ogg"}
MAX_AUDIO_SIZE = 250 * 1024 * 1024  # 250 MB
ALLOWED_COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_COVER_SIZE = 15 * 1024 * 1024  # 15 MB


class DirectoryScanRequest(BaseModel):
    directory_path: str
    download_allowed: bool = True


class BatchImportSummary(BaseModel):
    total_processed: int
    imported_songs: List[SongResponse]
    created_albums: int
    failed_files: List[Dict[str, str]]


def _get_or_create_artist_for_user(user: User, db: Session) -> Artist:
    if user.artist_profile:
        return user.artist_profile

    # Create default artist profile for user
    artist_name = user.display_name or user.username
    artist = Artist(user_id=user.id, name=artist_name)
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


def _get_or_create_artist_by_name(name: str, default_user_id: int, db: Session) -> Artist:
    clean_name = name.strip()
    if not clean_name:
        clean_name = "Various Artists"

    artist = db.scalar(select(Artist).where(Artist.name == clean_name))
    if not artist:
        artist = Artist(user_id=default_user_id, name=clean_name)
        db.add(artist)
        db.flush()
    return artist


def _import_single_audio_file(
    audio_bytes: bytes,
    filename: str,
    content_type: Optional[str],
    default_artist: Artist,
    album_id: Optional[int],
    title: Optional[str],
    genre: Optional[str],
    track_number: Optional[int],
    download_allowed: bool,
    db: Session,
    storage,
    companion_artwork: Optional[bytes] = None,
    companion_mime: Optional[str] = None,
) -> Song:
    """Core auto-detection engine for audio tags, embedded artwork, albums, and songs."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise ValueError(f"Unsupported audio format '{ext}'. Allowed: {list(ALLOWED_AUDIO_EXTENSIONS)}")

    file_size = len(audio_bytes)
    if file_size == 0:
        raise ValueError("Audio file is empty")

    # Write temporary file for Mutagen inspection
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)

    try:
        meta = read_metadata(tmp_path)
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise ValueError(f"Could not read audio tags: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)

    # 1. Resolve Song Title
    song_title = (title or meta.get("title") or Path(filename).stem).strip()

    # 2. Resolve Artist (auto-detect from ID3/FLAC tag or fallback to user default)
    artist_tag = meta.get("artist")
    if artist_tag and artist_tag.strip() and artist_tag.strip().lower() != default_artist.name.lower():
        artist = _get_or_create_artist_by_name(artist_tag, default_artist.user_id, db)
    else:
        artist = default_artist

    # 3. Resolve Album (auto-detect from tag or use album_id)
    album = None
    if album_id:
        album = db.scalar(select(Album).where(Album.id == album_id))
    elif meta.get("album") and meta.get("album").strip():
        album_title = meta["album"].strip()
        # Look for existing album by this artist with the same title
        album = db.scalar(
            select(Album).where(Album.artist_id == artist.id, Album.title == album_title)
        )
        if not album:
            album = Album(
                artist_id=artist.id,
                title=album_title,
                year=meta.get("year"),
            )
            db.add(album)
            db.flush()

    # 4. Resolve Embedded Artwork (Automatic detection from MP3 APIC, FLAC, M4A covr, or companion cover.jpg)
    extracted_cover_url = None
    artwork_data = meta.get("artwork") or companion_artwork
    artwork_mime = meta.get("artwork_mime") or companion_mime or "image/jpeg"

    if artwork_data and len(artwork_data) > 0:
        img_ext = ".png" if "png" in artwork_mime else ".jpg"
        cover_key = f"covers/{artist.id}/{uuid.uuid4().hex[:12]}{img_ext}"
        storage.upload(cover_key, artwork_data, content_type=artwork_mime)
        extracted_cover_url = f"/api/v1/storage/file?key={cover_key}"

        # If album doesn't have cover art, set it automatically from this track
        if album and not album.cover_url:
            album.cover_url = extracted_cover_url

    # 5. Upload Audio to Object Storage
    song_uuid = uuid.uuid4().hex
    album_folder = str(album.id) if album else "singles"
    storage_key = f"audio/{artist.id}/{album_folder}/{song_uuid}{ext}"
    final_content_type = content_type or meta.get("codec") or "audio/mpeg"
    storage.upload(storage_key, audio_bytes, content_type=final_content_type)

    # 6. Persist to Database
    song = Song(
        artist_id=artist.id,
        album_id=album.id if album else None,
        title=song_title,
        duration=float(meta.get("duration_seconds") or 0.0),
        track_number=track_number or meta.get("track_number"),
        disc_number=meta.get("disc_number") or 1,
        audio_key=storage_key,
        cover_url=extracted_cover_url or (album.cover_url if album else None),
        genre=genre or meta.get("genre"),
        download_allowed=download_allowed,
        codec=meta.get("codec"),
        bitrate=meta.get("bitrate"),
        sample_rate=meta.get("sample_rate"),
        channels=meta.get("channels"),
        bit_depth=meta.get("bit_depth"),
        file_size_bytes=file_size,
    )
    db.add(song)
    db.commit()
    db.refresh(song)

    # 7. Search public resources (LRCLIB) for authentic lyrics or save embedded tags
    try:
        from app.services.lyrics.service import LyricsService
        lyrics_svc = LyricsService()
        embedded_lyrics = meta.get("lyrics")
        if embedded_lyrics and embedded_lyrics.strip():
            lyrics_svc.save_custom_lyrics(db, song.id, embedded_lyrics.strip())
        else:
            lyrics_svc.get_or_fetch(db, song.id)
    except Exception:
        # Non-blocking if offline or network unreachable
        pass

    return song


@router.post("/albums", response_model=AlbumBasic, status_code=status.HTTP_201_CREATED)
def create_album(
    title: str = Form(..., min_length=1, max_length=255),
    description: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    cover_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    artist = _get_or_create_artist_for_user(current_user, db)
    storage = get_storage()
    cover_url = None

    if cover_file and cover_file.filename:
        ext = Path(cover_file.filename).suffix.lower()
        if ext not in ALLOWED_COVER_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported cover format. Allowed: {list(ALLOWED_COVER_EXTENSIONS)}",
            )
        cover_bytes = cover_file.file.read()
        if len(cover_bytes) > MAX_COVER_SIZE:
            raise HTTPException(status_code=400, detail="Cover image exceeds 15MB limit")

        cover_key = f"covers/{artist.id}/{uuid.uuid4().hex[:12]}{ext}"
        storage.upload(cover_key, cover_bytes, content_type=cover_file.content_type or "image/jpeg")
        cover_url = f"/api/v1/storage/file?key={cover_key}"

    album = Album(
        artist_id=artist.id,
        title=title.strip(),
        description=description,
        year=year,
        cover_url=cover_url,
    )
    db.add(album)
    db.commit()
    db.refresh(album)

    return AlbumBasic(
        id=album.id,
        title=album.title,
        cover_url=album.cover_url,
        release_date=album.release_date,
        year=album.year,
        artist_id=artist.id,
        artist_name=artist.name,
        track_count=0,
    )


@router.post("/songs/upload", response_model=SongResponse, status_code=status.HTTP_201_CREATED)
def upload_song(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    album_id: Optional[int] = Form(None),
    genre: Optional[str] = Form(None),
    download_allowed: bool = Form(True),
    track_number: Optional[int] = Form(None),
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    """Uploads single audio file with full automatic ID3 tag & embedded cover art detection."""
    artist = _get_or_create_artist_for_user(current_user, db)
    storage = get_storage()

    filename = file.filename or "track.mp3"
    audio_bytes = file.file.read()

    try:
        song = _import_single_audio_file(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=file.content_type,
            default_artist=artist,
            album_id=album_id,
            title=title,
            genre=genre,
            track_number=track_number,
            download_allowed=download_allowed,
            db=db,
            storage=storage,
        )
        return format_song(song, current_user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/songs/batch-upload", response_model=BatchImportSummary, status_code=status.HTTP_201_CREATED)
def batch_upload_songs(
    files: List[UploadFile] = File(...),
    download_allowed: bool = Form(True),
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    """
    Batch upload multiple songs or an entire album folder at once.
    Automatically detects titles, artists, albums, genres, track numbers, and embedded cover art.
    """
    artist = _get_or_create_artist_for_user(current_user, db)
    storage = get_storage()

    imported_songs: List[SongResponse] = []
    failed_files: List[Dict[str, str]] = []
    initial_album_count = db.scalar(select(Album.id).where(Album.artist_id == artist.id))

    for f in files:
        filename = f.filename or "unknown.mp3"
        try:
            audio_bytes = f.file.read()
            song = _import_single_audio_file(
                audio_bytes=audio_bytes,
                filename=filename,
                content_type=f.content_type,
                default_artist=artist,
                album_id=None,  # Auto-resolve from tags
                title=None,     # Auto-resolve from tags
                genre=None,     # Auto-resolve from tags
                track_number=None, # Auto-resolve from tags
                download_allowed=download_allowed,
                db=db,
                storage=storage,
            )
            imported_songs.append(format_song(song, current_user.id))
        except Exception as e:
            failed_files.append({"file": filename, "error": str(e)})

    return BatchImportSummary(
        total_processed=len(files),
        imported_songs=imported_songs,
        created_albums=len(set(s.album_id for s in imported_songs if s.album_id)),
        failed_files=failed_files,
    )


@router.post("/import-directory")
def import_local_directory(
    request: DirectoryScanRequest,
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    """
    Scans a local directory recursively on the server/device.
    Auto-detects all audio files, tags, and extracts embedded artwork + folder images (cover.jpg/png).
    """
    target_dir = Path(request.directory_path.strip('"').strip("'"))
    if not target_dir.exists() or not target_dir.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Directory does not exist or is not a folder: {target_dir}",
        )

    artist = _get_or_create_artist_for_user(current_user, db)
    storage = get_storage()

    audio_files: List[Path] = []
    for ext in ALLOWED_AUDIO_EXTENSIONS:
        audio_files.extend(target_dir.rglob(f"*{ext}"))
        audio_files.extend(target_dir.rglob(f"*{ext.upper()}"))

    if not audio_files:
        return {
            "status": "empty",
            "message": "No supported audio files (.mp3, .flac, .m4a, .wav, .ogg) found in this directory.",
            "scanned": 0,
            "imported": 0,
        }

    imported_count = 0
    failed: List[Dict[str, str]] = []

    for audio_path in audio_files:
        try:
            # Check for companion cover image in folder (cover.jpg, folder.jpg, front.jpg)
            companion_data = None
            companion_mime = None
            parent_dir = audio_path.parent
            for cover_name in ["cover.jpg", "folder.jpg", "front.jpg", "cover.png", "folder.png", "album.jpg"]:
                cand = parent_dir / cover_name
                if cand.is_file():
                    companion_data = cand.read_bytes()
                    companion_mime = mimetypes.guess_type(str(cand))[0] or "image/jpeg"
                    break

            audio_bytes = audio_path.read_bytes()
            _import_single_audio_file(
                audio_bytes=audio_bytes,
                filename=audio_path.name,
                content_type=mimetypes.guess_type(str(audio_path))[0],
                default_artist=artist,
                album_id=None,
                title=None,
                genre=None,
                track_number=None,
                download_allowed=request.download_allowed,
                db=db,
                storage=storage,
                companion_artwork=companion_data,
                companion_mime=companion_mime,
            )
            imported_count += 1
        except Exception as e:
            failed.append({"file": audio_path.name, "error": str(e)})

    return {
        "status": "completed",
        "directory": str(target_dir),
        "total_scanned": len(audio_files),
        "imported": imported_count,
        "failed_count": len(failed),
        "failed_files": failed[:10],  # Return up to first 10 errors
    }


@router.patch("/songs/{song_id}", response_model=SongResponse)
def update_song(
    song_id: int,
    title: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    track_number: Optional[int] = Form(None),
    download_allowed: Optional[bool] = Form(None),
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    artist = _get_or_create_artist_for_user(current_user, db)
    song = db.scalar(
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .where(Song.id == song_id)
    )
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.artist_id != artist.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=403, detail="You do not own this track")

    if title is not None:
        song.title = title.strip()
    if genre is not None:
        song.genre = genre.strip()
    if track_number is not None:
        song.track_number = track_number
    if download_allowed is not None:
        song.download_allowed = download_allowed

    db.commit()
    db.refresh(song)
    return format_song(song, current_user.id)


@router.delete("/songs/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_song(
    song_id: int,
    current_user: User = Depends(get_current_artist),
    db: Session = Depends(get_db),
):
    artist = _get_or_create_artist_for_user(current_user, db)
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.artist_id != artist.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=403, detail="You do not own this track")

    storage = get_storage()
    if storage.exists(song.audio_key):
        storage.delete(song.audio_key)

    db.delete(song)
    db.commit()
    return None
