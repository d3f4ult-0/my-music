import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from fastapi import Request
from starlette.datastructures import Headers

from app.database import engine, SessionLocal, Base
from app.models.user import User, UserRole
from app.models.song import Song
from app.models.album import Album
from app.models.artist import Artist
from app.models.playlist import Playlist
from app.models.favorite import Favorite
from app.models.listening_history import ListeningHistory
from app.models.report import Report, ReportReason, ReportStatus
from app.schemas.auth import UserRegisterRequest, UserLoginRequest
from app.schemas.music import (
    PlaylistCreateRequest,
    PlaylistAddSongRequest,
    PlaylistReorderRequest,
    ListeningHistoryCreateRequest,
    ReportCreateRequest,
)
from app.routers.auth import register, login, get_current_user_profile
from app.routers.songs import get_songs, get_song, stream_song, download_song
from app.routers.albums import get_albums, get_album
from app.routers.artists import get_artists, get_artist, follow_artist, unfollow_artist
from app.routers.playlists import (
    get_playlists,
    create_playlist,
    get_playlist,
    add_song_to_playlist,
    remove_song_from_playlist,
    reorder_playlist,
)
from app.routers.favorites import add_favorite, remove_favorite, check_favorite, get_user_favorites
from app.routers.history import record_listening_event, get_listening_history
from app.routers.search import search_catalog
from app.routers.p2p import (
    get_node_peer_info,
    get_shared_library_manifest,
    list_connected_peers,
    connect_peer,
    ConnectPeerRequest,
)
from app.routers.home import get_home_feed
from app.routers.reports import create_report, get_reports, resolve_report
from app.routers.admin import get_system_stats, list_users, toggle_user_active
from app.storage import get_storage


def make_dummy_request(headers=None):
    raw_headers = []
    if headers:
        for k, v in headers.items():
            raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": raw_headers,
    }
    return Request(scope)


def run_all_tests():
    print("==================================================")
    print("   RUNNING PLATFORM VERIFICATION TEST SUITE       ")
    print("==================================================")

    db = SessionLocal()
    storage = get_storage()

    try:
        # TEST 1: User Registration
        print("\n[1] Testing User Registration...")
        uid = uuid.uuid4().hex[:6]
        uname = f"auditor_{uid}"
        uemail = f"auditor_{uid}@test.com"
        reg_req = UserRegisterRequest(
            username=uname,
            email=uemail,
            password="StrongPassword123!",
            display_name="Auditor Alpha",
            role=UserRole.USER,
        )
        token_resp = register(reg_req, db)
        assert token_resp.access_token is not None
        assert token_resp.user.username == uname
        print("  -> Passed! Registered user ID:", token_resp.user.id)

        user_id = token_resp.user.id
        test_user = db.scalar(select(User).where(User.id == user_id))

        # TEST 2: User Login
        print("\n[2] Testing Authentication Login...")
        login_req = UserLoginRequest(username_or_email=uemail, password="StrongPassword123!")
        login_resp = login(login_req, db)
        assert login_resp.access_token is not None
        assert login_resp.user.email == uemail
        print("  -> Passed! Token verified.")

        # TEST 3: Catalog & Song Retrieval
        print("\n[3] Testing Song & Album Retrieval...")
        songs = get_songs(limit=10, offset=0, db=db, current_user=test_user)
        assert len(songs) >= 5
        first_song = songs[0]
        print(f"  -> Found {len(songs)} songs. First: '{first_song.title}' (ID: {first_song.id})")

        albums = get_albums(limit=5, offset=0, db=db)
        assert len(albums) >= 2
        print(f"  -> Found {len(albums)} albums. First: '{albums[0].title}'")

        album_detail = get_album(albums[0].id, db=db, current_user=test_user)
        assert len(album_detail.tracks) > 0
        print(f"  -> Album '{album_detail.title}' has {len(album_detail.tracks)} tracks.")

        # TEST 4: Streaming with HTTP Range
        print("\n[4] Testing Audio Streaming with HTTP Range...")
        req_range = make_dummy_request({"range": "bytes=0-1023"})
        stream_resp = stream_song(first_song.id, req_range, db)
        assert stream_resp.status_code == 206
        assert stream_resp.headers["Content-Length"] == "1024"
        assert "Content-Range" in stream_resp.headers
        print(f"  -> Stream partial content response: status {stream_resp.status_code}, Range: {stream_resp.headers['Content-Range']}")

        # TEST 5: Download Authorization & Permission Gate
        print("\n[5] Testing Download Permissions...")
        # A song with download allowed:
        dl_allowed_song = next(s for s in songs if s.download_allowed)
        dl_resp = download_song(dl_allowed_song.id, db, test_user)
        assert "Content-Disposition" in dl_resp.headers or dl_resp.status_code == 307
        print(f"  -> Download permitted for song '{dl_allowed_song.title}'.")

        # A song with download restricted:
        restricted_song = db.scalar(select(Song).where(Song.download_allowed == False))
        assert restricted_song is not None
        try:
            download_song(restricted_song.id, db, test_user)
            assert False, "Should have failed with 403 Forbidden!"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 403
            print(f"  -> Correctly blocked download for '{restricted_song.title}': 403 Forbidden.")

        # TEST 6: Favorites Flow
        print("\n[6] Testing Favorites Flow...")
        fav_status = check_favorite(first_song.id, test_user, db)
        assert fav_status["is_favorite"] is False

        add_favorite(first_song.id, test_user, db)
        fav_status_after = check_favorite(first_song.id, test_user, db)
        assert fav_status_after["is_favorite"] is True

        user_favs = get_user_favorites(test_user, db)
        assert any(f.id == first_song.id for f in user_favs)

        remove_favorite(first_song.id, test_user, db)
        assert check_favorite(first_song.id, test_user, db)["is_favorite"] is False
        print("  -> Passed! Added, verified, and removed favorite.")

        # TEST 7: Playlist Management
        print("\n[7] Testing Playlists...")
        pl_create = PlaylistCreateRequest(name="Auditor Playlist", description="Created by automated test", is_public=True)
        pl = create_playlist(pl_create, test_user, db)
        assert pl.name == "Auditor Playlist"

        # Add 2 songs
        add_song_to_playlist(pl.id, PlaylistAddSongRequest(song_id=songs[0].id), test_user, db)
        add_song_to_playlist(pl.id, PlaylistAddSongRequest(song_id=songs[1].id), test_user, db)

        detail = get_playlist(pl.id, db, test_user)
        assert len(detail.songs) == 2
        assert detail.songs[0].id == songs[0].id

        # Reorder
        reorder_playlist(pl.id, PlaylistReorderRequest(song_ids=[songs[1].id, songs[0].id]), test_user, db)
        detail_reordered = get_playlist(pl.id, db, test_user)
        assert detail_reordered.songs[0].id == songs[1].id
        print("  -> Passed! Created playlist, added tracks, and reordered successfully.")

        # TEST 8: Listening History Tracking
        print("\n[8] Testing Listening History...")
        # Below threshold:
        res_sub = record_listening_event(
            ListeningHistoryCreateRequest(song_id=first_song.id, progress_seconds=10.0, duration=200.0, completed=False),
            test_user,
            db,
        )
        assert res_sub["recorded"] is False

        # Meaningful threshold:
        res_ok = record_listening_event(
            ListeningHistoryCreateRequest(song_id=first_song.id, progress_seconds=45.0, duration=200.0, completed=False),
            test_user,
            db,
        )
        assert res_ok["recorded"] is True

        history = get_listening_history(10, test_user, db)
        assert any(h.song.id == first_song.id for h in history)
        print("  -> Passed! Threshold gate enforced and history recorded.")

        # TEST 9: Global Search
        print("\n[9] Testing Global Search...")
        search_res = search_catalog(q="Neon", limit=5, db=db, current_user=test_user)
        assert len(search_res.artists) > 0 or len(search_res.songs) > 0
        print(f"  -> Search 'Neon' found: {len(search_res.songs)} songs, {len(search_res.artists)} artists.")

        # TEST 10: Content Moderation & Reporting
        print("\n[10] Testing Content Reporting...")
        rep_req = ReportCreateRequest(
            song_id=first_song.id,
            reason=ReportReason.COPYRIGHT,
            description="Automated compliance check report.",
        )
        rep = create_report(rep_req, test_user, db)
        assert rep.reason == "COPYRIGHT"
        assert rep.status == ReportStatus.PENDING

        admin_user = db.scalar(select(User).where(User.role == UserRole.ADMIN))
        assert admin_user is not None
        reports_list = get_reports(status_filter=ReportStatus.PENDING, limit=10, current_admin=admin_user, db=db)
        assert any(r.id == rep.id for r in reports_list)

        resolved = resolve_report(rep.id, action="resolve", current_admin=admin_user, db=db)
        assert resolved.status == ReportStatus.RESOLVED
        print("  -> Passed! Reported track and resolved as admin.")

        # TEST 11: Admin Statistics
        print("\n[11] Testing Admin Dashboard Stats...")
        stats = get_system_stats(admin_user, db)
        assert stats["songs"] >= 15
        assert stats["users"] >= 3
        print(f"  -> System Stats: {stats}")

        # TEST 12: P2P & LAN Node Discovery & Manifest Export
        print("\n[12] Testing P2P / LAN Sharing Endpoints...")
        peer_info = get_node_peer_info(db)
        assert peer_info.peer_id is not None
        assert peer_info.track_count >= 15
        print(f"  -> Local Peer Node: ID={peer_info.peer_id}, IP={peer_info.local_ip}, Tracks={peer_info.track_count}")

        manifest = get_shared_library_manifest(db)
        assert len(manifest) >= 15
        assert manifest[0].stream_url is not None
        print(f"  -> Shared Library Manifest: exported {len(manifest)} playable tracks.")

        conn_res = connect_peer(ConnectPeerRequest(peer_url="http://192.168.1.55:8000", name="Living Room Player"))
        assert conn_res["peer_url"] == "http://192.168.1.55:8000"
        peers_list = list_connected_peers()
        assert any(p["peer_url"] == "http://192.168.1.55:8000" for p in peers_list["peers"])
        print(f"  -> Connected Peers registry: {len(peers_list['peers'])} peer(s) tracked.")

        print("\n==================================================")
        print("   ALL 12 BACKEND API SUITES PASSED FLAWLESSLY!   ")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    run_all_tests()
