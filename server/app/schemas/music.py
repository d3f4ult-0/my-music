from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.report import ReportReason, ReportStatus


class ArtistBasic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    image_url: Optional[str] = None


class AlbumBasic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    cover_url: Optional[str] = None
    release_date: Optional[datetime] = None
    year: Optional[int] = None
    artist_id: int
    artist_name: Optional[str] = None
    track_count: Optional[int] = None


class SongResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str] = None
    duration: float
    track_number: Optional[int] = None
    disc_number: Optional[int] = 1
    audio_key: str
    cover_url: Optional[str] = None
    genre: Optional[str] = None
    release_date: Optional[datetime] = None
    download_allowed: bool = True
    artist: Optional[ArtistBasic] = None
    album_id: Optional[int] = None
    album_title: Optional[str] = None
    is_favorite: bool = False
    stream_url: Optional[str] = None

    # Audio details
    codec: Optional[str] = None
    bitrate: Optional[int] = None


class AlbumDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    release_date: Optional[datetime] = None
    year: Optional[int] = None
    artist: ArtistBasic
    tracks: List[SongResponse] = []


class ArtistDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    bio: Optional[str] = None
    image_url: Optional[str] = None
    follower_count: int = 0
    is_following: bool = False
    albums: List[AlbumBasic] = []
    popular_songs: List[SongResponse] = []


class PlaylistBasic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    is_public: bool
    user_id: int
    owner_name: Optional[str] = None
    track_count: int = 0
    created_at: datetime


class PlaylistDetail(PlaylistBasic):
    songs: List[SongResponse] = []


class PlaylistCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: bool = True


class PlaylistUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    cover_url: Optional[str] = None


class PlaylistAddSongRequest(BaseModel):
    song_id: int
    position: Optional[int] = None


class PlaylistReorderRequest(BaseModel):
    song_ids: List[int]


class ListeningHistoryCreateRequest(BaseModel):
    song_id: int
    progress_seconds: float
    duration: float
    completed: bool = False


class ListeningHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    song: SongResponse
    played_at: datetime
    progress_seconds: float
    completed: bool


class ReportCreateRequest(BaseModel):
    song_id: int
    reason: ReportReason
    description: Optional[str] = None


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    song_id: int
    song_title: str
    reporter_id: int
    reporter_username: str
    reason: str
    description: Optional[str] = None
    status: ReportStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None


class SearchResponse(BaseModel):
    songs: List[SongResponse] = []
    albums: List[AlbumBasic] = []
    artists: List[ArtistBasic] = []
    playlists: List[PlaylistBasic] = []


class HomeFeedResponse(BaseModel):
    greeting: str
    recently_played: List[SongResponse] = []
    favorites: List[SongResponse] = []
    new_releases: List[AlbumBasic] = []
    popular_songs: List[SongResponse] = []
    featured_artists: List[ArtistBasic] = []
