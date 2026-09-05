import re


TIMESTAMP_PATTERN = re.compile(
    r"\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)"
)


def parse_lrc(lyrics_text: str) -> list[dict]:
    """
    Parse LRC-style synchronized lyrics.

    Returns:
        [
            {
                "time": 59.64,
                "text": "..."
            },
            ...
        ]
    """

    lines = []

    for raw_line in lyrics_text.splitlines():
        match = TIMESTAMP_PATTERN.match(raw_line.strip())

        if not match:
            continue

        minutes = int(match.group(1))
        seconds = float(match.group(2))
        text = match.group(3).strip()

        timestamp = (
            minutes * 60 + seconds, 3,
        )

        lines.append(
            {
                "time": timestamp,
                "text": text,
            }
        )

    lines.sort(
        key=lambda line: line["time"]
    )

    return lines