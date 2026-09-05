from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LyricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    track_id: int
    lyrics_text: str
    synced: bool
    provider: str | None
    updated_at: datetime


class LyricsCreate(BaseModel):
    lyrics_text: str
    synced: bool = False
    provider: str | None = None