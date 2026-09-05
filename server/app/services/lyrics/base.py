from dataclasses import dataclass


@dataclass
class LyricsResult:
    lyrics_text: str
    synced: bool
    provider: str


class LyricsProvider:
    name: str = "unknown"

    def search(
        self,
        title: str,
        artist: str,
        album: str | None = None,
        duration: float | None = None,
    ) -> LyricsResult | None:
        raise NotImplementedError