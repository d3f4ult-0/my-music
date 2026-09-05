from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Album, Artist, Genre, Track, TrackArtist, TrackGenre
from app.services.metadata import read_metadata
from app.services.artwork import save_artwork


def get_or_create_artist(db: Session, name: str) -> Artist:
    name = name.strip()

    artist = db.scalar(
        select(Artist).where(Artist.name == name)
    )

    if artist:
        return artist

    artist = Artist(name=name)
    db.add(artist)
    db.flush()

    return artist


def get_or_create_genre(db: Session, name: str) -> Genre:
    name = name.strip()

    genre = db.scalar(
        select(Genre).where(Genre.name == name)
    )

    if genre:
        return genre

    genre = Genre(name=name)
    db.add(genre)
    db.flush()

    return genre


def get_or_create_album(
    db: Session,
    title: str,
    album_artist: str | None,
    year: int | None,
) -> Album:

    album_artist_obj = None

    if album_artist:
        album_artist_obj = get_or_create_artist(
            db,
            album_artist,
        )

    album = db.scalar(
        select(Album).where(
            Album.title == title,
            Album.album_artist_id
            == (
                album_artist_obj.id
                if album_artist_obj
                else None
            ),
        )
    )

    if album:
        return album

    album = Album(
        title=title,
        album_artist_id=(
            album_artist_obj.id
            if album_artist_obj
            else None
        ),
        year=year,
    )

    db.add(album)
    db.flush()

    return album


def import_track(
    db: Session,
    file_path: Path,
) -> Track:

    metadata = read_metadata(file_path)

    # Check whether this exact file is already in the library.
    track = db.scalar(
        select(Track).where(
            Track.file_path == str(file_path)
        )
    )

    # Artist
    artist_obj = None

    if metadata["artist"]:
        artist_obj = get_or_create_artist(
            db,
            metadata["artist"],
        )

    # Album
    album_obj = None

    if metadata["album"]:
        album_obj = get_or_create_album(
            db,
            metadata["album"],
            metadata["album_artist"],
            metadata["year"],
        )

        # Save embedded album artwork.
    if album_obj and metadata["artwork"]:
        artwork_path = save_artwork(
            artwork=metadata["artwork"],
            mime_type=metadata["artwork_mime"],
            source_identifier=(
                f"{album_obj.title}:"
                f"{album_obj.album_artist_id}"
            ),
        )

        album_obj.artwork_path = artwork_path

    if track:
        # Existing file: update its metadata.
        track.title = metadata["title"]
        track.album_id = (
            album_obj.id
            if album_obj
            else None
        )
        track.track_number = metadata["track_number"]
        track.disc_number = metadata["disc_number"]
        track.duration_seconds = metadata["duration_seconds"]
        track.codec = metadata["codec"]
        track.bitrate = metadata["bitrate"]
        track.sample_rate = metadata["sample_rate"]
        track.bit_depth = metadata["bit_depth"]
        track.channels = metadata["channels"]

        # Remove old artist relationships.
        db.query(TrackArtist).filter(
            TrackArtist.track_id == track.id
        ).delete()

        # Remove old genre relationships.
        db.query(TrackGenre).filter(
            TrackGenre.track_id == track.id
        ).delete()

    else:
        track = Track(
            title=metadata["title"],
            album_id=(
                album_obj.id
                if album_obj
                else None
            ),
            track_number=metadata["track_number"],
            disc_number=metadata["disc_number"],
            duration_seconds=metadata["duration_seconds"],
            file_path=str(file_path),
            codec=metadata["codec"],
            bitrate=metadata["bitrate"],
            sample_rate=metadata["sample_rate"],
            bit_depth=metadata["bit_depth"],
            channels=metadata["channels"],
        )

        db.add(track)
        db.flush()

    # Connect artist to track.
    if artist_obj:
        db.add(
            TrackArtist(
                track_id=track.id,
                artist_id=artist_obj.id,
            )
        )

    # Connect genre to track.
    if metadata["genre"]:
        genres = [
            genre.strip()
            for genre in metadata["genre"].split(",")
            if genre.strip()
        ]

        for genre_name in genres:
            genre_obj = get_or_create_genre(
                db,
                genre_name,
            )

            db.add(
                TrackGenre(
                    track_id=track.id,
                    genre_id=genre_obj.id,
                )
            )

    db.commit()
    db.refresh(track)

    return track
