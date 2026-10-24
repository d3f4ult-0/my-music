from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.lyrics import Lyrics
from app.models.song import Song
from app.schemas.lyrics import LyricsResponse, LyricsCreate
from app.services.lyrics.service import LyricsService
from app.services.lyrics.parser import parse_lrc, is_synced_lrc

router = APIRouter(
    prefix="/api/v1/songs",
    tags=["Lyrics (Spicy Lyrics & LRCLIB)"],
)


@router.get("/{song_id}/lyrics", response_model=LyricsResponse)
def get_song_lyrics(
    song_id: int,
    force_refresh: bool = Query(False, description="Force re-fetch from public providers"),
    db: Session = Depends(get_db),
):
    """
    Returns authentic synchronized or plain lyrics for a song.
    If not already in local database, automatically queries public internet database (LRCLIB).
    """
    service = LyricsService()
    lyrics = service.get_or_fetch(db=db, song_id=song_id, force_refresh=force_refresh)

    if not lyrics:
        raise HTTPException(
            status_code=404,
            detail="Lyrics not found. You can upload custom LRC lyrics for this song.",
        )

    parsed_lines = parse_lrc(lyrics.lyrics_text) if lyrics.synced else None

    return LyricsResponse(
        id=lyrics.id,
        song_id=lyrics.song_id,
        lyrics_text=lyrics.lyrics_text,
        synced=lyrics.synced,
        provider=lyrics.provider,
        updated_at=lyrics.updated_at,
        lines=parsed_lines,
    )


@router.get("/{song_id}/lyrics/parsed")
def get_parsed_song_lyrics(
    song_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns line-by-line synchronized timestamps for Spicy Lyrics karaoke playback.
    """
    service = LyricsService()
    lyrics = service.get_or_fetch(db=db, song_id=song_id)

    if not lyrics:
        raise HTTPException(status_code=404, detail="Lyrics not found")

    lines = parse_lrc(lyrics.lyrics_text) if lyrics.synced else []

    return {
        "song_id": song_id,
        "synced": lyrics.synced,
        "provider": lyrics.provider,
        "lines": lines,
        "raw_text": lyrics.lyrics_text,
    }


@router.put("/{song_id}/lyrics", response_model=LyricsResponse)
def save_song_lyrics(
    song_id: int,
    data: LyricsCreate,
    db: Session = Depends(get_db),
):
    """
    Allows uploading or editing synchronized LRC or plain lyrics for a song.
    """
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    service = LyricsService()
    lyrics = service.save_custom_lyrics(
        db=db,
        song_id=song_id,
        lyrics_text=data.lyrics_text,
        synced=data.synced,
    )

    parsed_lines = parse_lrc(lyrics.lyrics_text) if lyrics.synced else None

    return LyricsResponse(
        id=lyrics.id,
        song_id=lyrics.song_id,
        lyrics_text=lyrics.lyrics_text,
        synced=lyrics.synced,
        provider=lyrics.provider,
        updated_at=lyrics.updated_at,
        lines=parsed_lines,
    )


@router.post("/{song_id}/lyrics/upload-file", response_model=LyricsResponse)
def upload_lyrics_file(
    song_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload an .lrc or .txt lyrics file for a song.
    """
    song = db.scalar(select(Song).where(Song.id == song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    file_bytes = file.file.read()
    try:
        lyrics_text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        lyrics_text = file_bytes.decode("latin-1", errors="ignore")

    service = LyricsService()
    lyrics = service.save_custom_lyrics(
        db=db,
        song_id=song_id,
        lyrics_text=lyrics_text,
        synced=is_synced_lrc(lyrics_text),
    )

    parsed_lines = parse_lrc(lyrics.lyrics_text) if lyrics.synced else None

    return LyricsResponse(
        id=lyrics.id,
        song_id=lyrics.song_id,
        lyrics_text=lyrics.lyrics_text,
        synced=lyrics.synced,
        provider=lyrics.provider,
        updated_at=lyrics.updated_at,
        lines=parsed_lines,
    )
