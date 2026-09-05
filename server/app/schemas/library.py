from pydantic import BaseModel, ConfigDict


class ArtistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class GenreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class AlbumResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    album_artist_id: int | None
    year: int | None
    artwork_path: str | None


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str

    artists: list[ArtistResponse]
    album: AlbumResponse | None
    genres: list[GenreResponse]

    track_number: int | None
    disc_number: int | None
    duration_seconds: float | None

    codec: str | None
    bitrate: int | None
    sample_rate: int | None
    bit_depth: int | None
    channels: int | None