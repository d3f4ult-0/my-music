from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lyrics, Track
from app.schemas.lyrics import LyricsCreate,LyricsResponse
from app.services.lyrics.service import LyricsService
from app.services.lyrics.parser import parse_lrc


router = APIRouter(
    prefix="/lyrics",
    tags=["Lyrics"],
)


@router.get(
    "/tracks/{track_id}",
    response_model=LyricsResponse,
)
def get_track_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
):
    service = LyricsService()

    lyrics = service.get_or_fetch(
        db=db,
        track_id=track_id,
    )

    if lyrics is None:
        raise HTTPException(
            status_code=404,
            detail="Lyrics not found",
        )

    return lyrics

@router.get(
    "/tracks/{track_id}/parsed",
)
def get_parsed_track_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
):
    lyrics = db.scalar(
        select(Lyrics).where(
            Lyrics.track_id == track_id
        )
    )

    if lyrics is None:
        raise HTTPException(
            status_code=404,
            detail="Lyrics not found",
        )

    if not lyrics.synced:
        raise HTTPException(
            status_code=400,
            detail="Lyrics are not synchronized",
        )

    return {
        "track_id": track_id,
        "synced": True,
        "provider": lyrics.provider,
        "lines": parse_lrc(
            lyrics.lyrics_text
        ),
    }

@router.put(
    "/tracks/{track_id}",
    response_model=LyricsResponse,
)
def save_track_lyrics(
    track_id: int,
    data: LyricsCreate,
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

    lyrics = db.scalar(
        select(Lyrics).where(
            Lyrics.track_id == track_id
        )
    )

    if lyrics is None:
        lyrics = Lyrics(
            track_id=track_id,
            lyrics_text=data.lyrics_text,
            synced=data.synced,
            provider=data.provider,
        )

        db.add(lyrics)

    else:
        lyrics.lyrics_text = data.lyrics_text
        lyrics.synced = data.synced
        lyrics.provider = data.provider

    db.commit()
    db.refresh(lyrics)

    return lyrics