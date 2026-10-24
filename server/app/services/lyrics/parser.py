import re
from typing import List, Dict, Any

TIMESTAMP_PATTERN = re.compile(
    r"\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]"
)


def parse_lrc(lyrics_text: str) -> List[Dict[str, Any]]:
    """
    Parse LRC-style synchronized lyrics.
    Supports single or multiple timestamps per line.

    Returns:
        [
            {"time": 12.34, "text": "First line"},
            {"time": 16.50, "text": "Second line"},
        ]
    """
    if not lyrics_text:
        return []

    lines: List[Dict[str, Any]] = []

    for raw_line in lyrics_text.splitlines():
        trimmed = raw_line.strip()
        if not trimmed:
            continue

        # Find all timestamps in this line
        matches = list(TIMESTAMP_PATTERN.finditer(trimmed))
        if not matches:
            continue

        # The text is everything after the last timestamp
        last_match = matches[-1]
        text = trimmed[last_match.end():].strip()

        # If it's metadata tag like [ar: Artist] or [al: Album], ignore
        for match in matches:
            try:
                minutes = int(match.group(1))
                seconds = float(match.group(2))
                timestamp = round(minutes * 60 + seconds, 3)

                lines.append(
                    {
                        "time": timestamp,
                        "text": text,
                    }
                )
            except (ValueError, IndexError):
                continue

    lines.sort(key=lambda line: line["time"])
    return lines


def is_synced_lrc(lyrics_text: str) -> bool:
    """Checks if lyrics text contains valid LRC timestamp patterns."""
    if not lyrics_text:
        return False
    return bool(TIMESTAMP_PATTERN.search(lyrics_text))
