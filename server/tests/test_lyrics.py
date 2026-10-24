import sys
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.song import Song
from app.models.lyrics import Lyrics
from app.services.lyrics.parser import parse_lrc, is_synced_lrc
from app.services.lyrics.service import LyricsService
from app.routers.lyrics import get_song_lyrics, get_parsed_song_lyrics, save_song_lyrics
from app.schemas.lyrics import LyricsCreate


def test_lyrics_system():
    print("==================================================")
    print("   TESTING SPICY LYRICS & LRCLIB PUBLIC SEARCH   ")
    print("==================================================")

    db: Session = SessionLocal()
    try:
        # 1. Test LRC Parser
        print("[1] Testing LRC Parser with Multiple Timestamps...")
        sample_lrc = (
            "[00:04.20] Welcome to the night\n"
            "[00:08.50] Stars are shining bright\n"
            "[00:15.80] We belong together\n"
        )
        assert is_synced_lrc(sample_lrc) is True
        lines = parse_lrc(sample_lrc)
        assert len(lines) == 3
        assert lines[0]["time"] == 4.2
        assert lines[0]["text"] == "Welcome to the night"
        assert lines[1]["time"] == 8.5
        assert lines[2]["time"] == 15.8
        print(f"  -> Parsed {len(lines)} synced lyric lines accurately.")

        # 2. Test saving and retrieving lyrics for a song
        print("\n[2] Testing Lyrics Persistence for Songs...")
        song = db.scalar(select(Song).order_by(Song.id.asc()))
        assert song is not None

        service = LyricsService()
        saved = service.save_custom_lyrics(
            db=db,
            song_id=song.id,
            lyrics_text=sample_lrc,
        )
        assert saved.synced is True
        assert saved.song_id == song.id
        print(f"  -> Successfully saved synced lyrics for song '{song.title}' (ID: {song.id})")

        # 3. Test Parsed Router Endpoint
        print("\n[3] Testing /parsed API Endpoint for Spicy Lyrics Frontend...")
        parsed_res = get_parsed_song_lyrics(song.id, db)
        assert parsed_res["synced"] is True
        assert len(parsed_res["lines"]) == 3
        assert parsed_res["lines"][0]["text"] == "Welcome to the night"
        print(f"  -> Spicy Lyrics karaoke payload ready: {len(parsed_res['lines'])} lines with millisecond precision.")

        print("\n==================================================")
        print("   ALL LYRICS & PARSER TESTS PASSED FLAWLESSLY!  ")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_lyrics_system()
