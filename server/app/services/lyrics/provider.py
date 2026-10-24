import urllib.request
import urllib.parse
import json
from typing import Optional
from app.services.lyrics.base import LyricsProvider, LyricsResult


class LRCLIBProvider(LyricsProvider):
    """
    LRCLIB is a free, public, and open database of synced and plain lyrics.
    No API key required.
    """
    name = "lrclib"
    BASE_URL = "https://lrclib.net/api/get"
    SEARCH_URL = "https://lrclib.net/api/search"

    def __init__(self, timeout: float = 4.0):
        self.timeout = timeout

    def search(
        self,
        title: str,
        artist: str,
        album: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> Optional[LyricsResult]:
        if not title or not artist:
            return None

        # 1. First try exact get: /api/get?track_name=...&artist_name=...
        params = {
            "track_name": title.strip(),
            "artist_name": artist.strip(),
        }
        if album:
            params["album_name"] = album.strip()
        if duration is not None and duration > 0:
            params["duration"] = round(duration)

        headers = {
            "User-Agent": "MyMusic-Platform/1.0 (https://github.com/my-music)",
            "Accept": "application/json",
        }

        query_str = urllib.parse.urlencode(params)
        url = f"{self.BASE_URL}?{query_str}"

        data = None
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            data = None

        # 2. Fallback to /api/search?q=title+artist if exact get didn't match
        if not data or (not data.get("syncedLyrics") and not data.get("plainLyrics")):
            try:
                search_q = urllib.parse.urlencode({"q": f"{title} {artist}"})
                req = urllib.request.Request(f"{self.SEARCH_URL}?{search_q}", headers=headers)
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status == 200:
                        results = json.loads(resp.read().decode("utf-8"))
                        if results and isinstance(results, list) and len(results) > 0:
                            # Prefer result with syncedLyrics
                            best = next((r for r in results if r.get("syncedLyrics")), results[0])
                            data = best
            except Exception:
                pass

        if not data:
            return None

        synced_lyrics = data.get("syncedLyrics")
        plain_lyrics = data.get("plainLyrics")

        if synced_lyrics and synced_lyrics.strip():
            return LyricsResult(
                lyrics_text=synced_lyrics.strip(),
                synced=True,
                provider=self.name,
            )

        if plain_lyrics and plain_lyrics.strip():
            return LyricsResult(
                lyrics_text=plain_lyrics.strip(),
                synced=False,
                provider=self.name,
            )

        return None
