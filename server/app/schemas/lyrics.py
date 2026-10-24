from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class LyricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    song_id: int
    lyrics_text: str
    synced: bool
    provider: Optional[str] = None
    updated_at: datetime
    lines: Optional[List[Dict[str, Any]]] = None


class LyricsCreate(BaseModel):
    lyrics_text: str
    synced: Optional[bool] = None
    provider: Optional[str] = "user_uploaded"
