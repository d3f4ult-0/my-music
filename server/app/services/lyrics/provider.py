import requests

from app.services.lyrics.base import LyricsProvider, LyricsResult


class LRCLIBProvider(LyricsProvider):
    name = "lrclib"

    BASE_URL = "https://lrclib.net/api/get"

    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    def search(
        self,
        title: str,
        artist: str,
        album: str | None = None,
        duration: float | None = None,
    ) -> LyricsResult | None:

        params = {
            "track_name": title,
            "artist_name": artist,
        }

        if album:
            params["album_name"] = album

        if duration is not None:
            params["duration"] = round(duration)

        try:
            response = requests.get(
                self.BASE_URL,
                params=params,
                timeout=self.timeout,
                headers={
                    "User-Agent": "MyMusic/0.1.0"
                },
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()

            data = response.json()

        except requests.RequestException:
            return None

        plain_lyrics = data.get("plainLyrics")
        synced_lyrics = data.get("syncedLyrics")

        if synced_lyrics:
            return LyricsResult(
                lyrics_text=synced_lyrics,
                synced=True,
                provider=self.name,
            )

        if plain_lyrics:
            return LyricsResult(
                lyrics_text=plain_lyrics,
                synced=False,
                provider=self.name,
            )

        return None