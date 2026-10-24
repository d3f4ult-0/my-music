from app.models.user import User, UserRole
from app.models.artist import Artist
from app.models.album import Album
from app.models.song import Song
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.favorite import Favorite
from app.models.listening_history import ListeningHistory
from app.models.follow import Follow
from app.models.report import Report, ReportReason, ReportStatus
from app.models.lyrics import Lyrics
from app.models.genre import Genre
from app.models.track_artist import TrackArtist
from app.models.track_genre import TrackGenre

# Legacy compatibility alias
Track = Song

__all__ = [
    "User",
    "UserRole",
    "Artist",
    "Album",
    "Song",
    "Track",
    "Playlist",
    "PlaylistSong",
    "Favorite",
    "ListeningHistory",
    "Follow",
    "Report",
    "ReportReason",
    "ReportStatus",
    "Lyrics",
    "Genre",
    "TrackArtist",
    "TrackGenre",
]
