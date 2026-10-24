from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.song import Song
from app.models.user import User
from app.models.favorite import Favorite
from app.schemas.music import (
    PlaylistBasic,
    PlaylistDetail,
    PlaylistCreateRequest,
    PlaylistUpdateRequest,
    PlaylistAddSongRequest,
    PlaylistReorderRequest,
)
from app.routers.songs import format_song
from app.auth.dependencies import get_current_user, get_optional_user

router = APIRouter(
    prefix="/api/v1/playlists",
    tags=["Playlists"],
)


@router.get("", response_model=List[PlaylistBasic])
def get_playlists(
    only_mine: bool = False,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if only_mine:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        query = (
            select(Playlist)
            .options(selectinload(Playlist.user), selectinload(Playlist.songs))
            .where(Playlist.user_id == current_user.id)
            .order_by(Playlist.updated_at.desc())
        )
    else:
        if current_user:
            query = (
                select(Playlist)
                .options(selectinload(Playlist.user), selectinload(Playlist.songs))
                .where(or_(Playlist.is_public == True, Playlist.user_id == current_user.id))
                .order_by(Playlist.updated_at.desc())
            )
        else:
            query = (
                select(Playlist)
                .options(selectinload(Playlist.user), selectinload(Playlist.songs))
                .where(Playlist.is_public == True)
                .order_by(Playlist.updated_at.desc())
            )

    playlists = db.scalars(query).all()
    return [
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
    ]


@router.post("", response_model=PlaylistBasic, status_code=status.HTTP_201_CREATED)
def create_playlist(
    request: PlaylistCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = Playlist(
        user_id=current_user.id,
        name=request.name.strip(),
        description=request.description,
        is_public=request.is_public,
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return PlaylistBasic(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_url=playlist.cover_url,
        is_public=playlist.is_public,
        user_id=playlist.user_id,
        owner_name=current_user.display_name or current_user.username,
        track_count=0,
        created_at=playlist.created_at,
    )


@router.get("/{playlist_id}", response_model=PlaylistDetail)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    playlist = db.scalar(
        select(Playlist)
        .options(
            selectinload(Playlist.user),
            selectinload(Playlist.songs)
            .selectinload(PlaylistSong.song)
            .selectinload(Song.artist),
            selectinload(Playlist.songs)
            .selectinload(PlaylistSong.song)
            .selectinload(Song.album),
        )
        .where(Playlist.id == playlist_id)
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if not playlist.is_public and (not current_user or current_user.id != playlist.user_id):
        raise HTTPException(status_code=403, detail="This playlist is private")

    user_fav_ids = set()
    if current_user:
        user_fav_ids = set(
            db.scalars(
                select(Favorite.song_id).where(Favorite.user_id == current_user.id)
            ).all()
        )

    ordered_entries = sorted(playlist.songs, key=lambda ps: ps.position)
    formatted_tracks = [
        format_song(ps.song, current_user.id if current_user else None, user_fav_ids)
        for ps in ordered_entries
        if ps.song
    ]

    return PlaylistDetail(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_url=playlist.cover_url,
        is_public=playlist.is_public,
        user_id=playlist.user_id,
        owner_name=playlist.user.display_name if playlist.user else None,
        track_count=len(formatted_tracks),
        created_at=playlist.created_at,
        songs=formatted_tracks,
    )


@router.patch("/{playlist_id}", response_model=PlaylistBasic)
def update_playlist(
    playlist_id: int,
    request: PlaylistUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.scalar(
        select(Playlist)
        .options(selectinload(Playlist.user), selectinload(Playlist.songs))
        .where(Playlist.id == playlist_id)
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.user_id != current_user.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=403, detail="You can only edit your own playlist")

    if request.name is not None:
        playlist.name = request.name.strip()
    if request.description is not None:
        playlist.description = request.description
    if request.is_public is not None:
        playlist.is_public = request.is_public
    if request.cover_url is not None:
        playlist.cover_url = request.cover_url

    db.commit()
    db.refresh(playlist)

    return PlaylistBasic(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_url=playlist.cover_url,
        is_public=playlist.is_public,
        user_id=playlist.user_id,
        owner_name=playlist.user.display_name if playlist.user else None,
        track_count=len(playlist.songs),
        created_at=playlist.created_at,
    )


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.scalar(select(Playlist).where(Playlist.id == playlist_id))
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.user_id != current_user.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=403, detail="You can only delete your own playlist")

    db.delete(playlist)
    db.commit()
    return None


@router.post("/{playlist_id}/songs", status_code=status.HTTP_200_OK)
def add_song_to_playlist(
    playlist_id: int,
    request: PlaylistAddSongRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.scalar(
        select(Playlist).options(selectinload(Playlist.songs)).where(Playlist.id == playlist_id)
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own playlist")

    song = db.scalar(select(Song).where(Song.id == request.song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    existing_entry = db.scalar(
        select(PlaylistSong).where(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.song_id == request.song_id,
        )
    )
    if existing_entry:
        return {"status": "already_in_playlist", "position": existing_entry.position}

    max_pos = db.scalar(
        select(func.coalesce(func.max(PlaylistSong.position), -1)).where(
            PlaylistSong.playlist_id == playlist_id
        )
    )
    next_position = request.position if request.position is not None else max_pos + 1

    entry = PlaylistSong(
        playlist_id=playlist_id,
        song_id=request.song_id,
        position=next_position,
        added_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    return {"status": "added", "song_id": request.song_id, "position": next_position}


@router.delete("/{playlist_id}/songs/{song_id}", status_code=status.HTTP_200_OK)
def remove_song_from_playlist(
    playlist_id: int,
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.scalar(select(Playlist).where(Playlist.id == playlist_id))
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own playlist")

    entry = db.scalar(
        select(PlaylistSong).where(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.song_id == song_id,
        )
    )
    if entry:
        db.delete(entry)
        db.commit()

    return {"status": "removed", "song_id": song_id}


@router.put("/{playlist_id}/reorder", status_code=status.HTTP_200_OK)
def reorder_playlist(
    playlist_id: int,
    request: PlaylistReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.scalar(select(Playlist).where(Playlist.id == playlist_id))
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only modify your own playlist")

    for index, s_id in enumerate(request.song_ids):
        entry = db.scalar(
            select(PlaylistSong).where(
                PlaylistSong.playlist_id == playlist_id,
                PlaylistSong.song_id == s_id,
            )
        )
        if entry:
            entry.position = index

    db.commit()
    return {"status": "reordered"}
