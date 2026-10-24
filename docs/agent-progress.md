# Engineering Progress Journal: MyMusic Platform

## Phase 0: Initial Repository Inspection & Architecture Assessment

### 1. Current Architecture
- **Structure**: Backend-only repository located in `server/`, configured with FastAPI, SQLAlchemy, and Alembic.
- **Orientation**: Originally conceived as a local-first personal audio player scanning a local directory path (`/home/d3f4ult0/Music`) and saving embedded artwork to disk.
- **Frontend**: Non-existent in the initial state.
- **Authentication**: Non-existent; no user security, tokens, or role boundaries.
- **Storage**: Direct local filesystem file paths stored in the database (`tracks.file_path`).

### 2. Existing Technologies
- **Backend**: Python 3.14, FastAPI 0.141.1, SQLAlchemy 2.0.52, Alembic 1.19.2, Mutagen 1.48.1, Uvicorn 0.52.4, Pydantic 2.13.5, Psycopg 3.3.5.
- **Containerization**: `docker-compose.yml` defining PostgreSQL 17.

### 3. Existing Working Functionality
- Mutagen metadata extraction in `app/services/metadata.py` supporting FLAC, MP3 (ID3), and MP4/M4A, extracting titles, artists, albums, genres, audio specs (bitrate, sample rate, channels, bit depth), and embedded artwork.
- Artwork extraction and local disk caching in `app/services/artwork.py` using SHA-256 hashes.
- Streaming route with HTTP byte-range request handling (HTTP 206 / HTTP 200) in `app/routers/library.py`.
- Synced and plain lyrics retrieval via LRCLIB in `app/services/lyrics/`.

### 4. Existing Database Schema
- `users`: `id`, `username`, `display_name` (no password hash, no email, no roles, no timestamps).
- `artists`: `id`, `name`.
- `albums`: `id`, `title`, `album_artist_id`, `year`, `artwork_path`.
- `tracks`: `id`, `title`, `album_id`, `track_number`, `disc_number`, `duration_seconds`, `file_path`, `codec`, `bitrate`, `sample_rate`, `bit_depth`, `channels`.
- `genres`, `track_artists`, `track_genres`, `lyrics`.

### 5. Existing Authentication
- None present.

### 6. Existing Frontend Structure
- None present.

### 7. Existing Dependencies
- See `server/requirements.txt`. Added `argon2-cffi`, `pyjwt`, `python-multipart`, `boto3`, `pytest`, `pytest-asyncio`, `httpx`.
- Installed Node.js LTS v24.19.0 with npm 12.2.0 for the frontend.

### 8. Components Reusable Without Disruption
- Audio file reading and tag extraction (`metadata.py`).
- Synced lyrics parsing and fetching (`lyrics/`).
- Byte-range streaming math and header logic.

### 9. Required Redesigns & Additions
- **Database Schema**: Upgrade to specification with `users` (Argon2id hashes, emails, avatars, roles: USER/ARTIST/ADMIN), `artists` (user FK, bios, images), `albums` (artist FK, descriptions, cover URLs), `songs` (audio object storage keys, genres, download permissions), `playlists`, `playlist_songs`, `favorites`, `listening_history`, `follows`, and `reports`.
- **Storage Subsystem**: ObjectStorage abstraction supporting S3-compatible stores (AWS S3, Cloudflare R2, MinIO) and local filesystem fallback with signed URLs.
- **Security & Auth**: JWT tokens, password hashing, role-based route guards.
- **REST API v1**: Complete `/api/v1/` endpoints for streaming, downloading, library, playlists, favorites, history, follows, artist studio uploads, admin moderation, and health checks.
- **Frontend Web App**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand + HTML5 audio player. Spotify-like dark interface, responsive layout, global persistent player, queue manager, search, and PWA capabilities.

### 10. Phase 1 Implementation Plan
1. Project foundation: Standardize monorepo directory layout (`server/` as API, `web/` as React frontend).
2. Database schema: Implement comprehensive SQLAlchemy models and database connection with SQLite/Postgres flexibility.
3. Authentication & Security: Implement Argon2id password hashing, JWT generation/verification, and FastAPI dependency guards (`get_current_user`, `require_role`).
4. Configuration: Enhanced `Settings` class in `config.py` loading from `.env` with secure defaults.
5. Automated tests: Implement comprehensive pytest test suite covering auth, password hashing, and user roles.
6. Verify Phase 1 completion and record deliverables.

## Phase 1: Foundation, Security & Database Schema
- **Implemented**:
  - Unified configuration in `server/app/config.py` and `.env.example`.
  - Database engine in `server/app/database.py` with dynamic SQLite and PostgreSQL support.
  - Normalized database models in `server/app/models/`:
    - `User`: Roles (`USER`, `ARTIST`, `ADMIN`), Argon2id password hash, email, timestamps.
    - `Artist`: Linked user account, name, bio, image_url.
    - `Album`: Artist reference, cover_url, release_date, year.
    - `Song`: Object storage key, duration, genre, download_allowed permission flag.
    - `Playlist` & `PlaylistSong`: Explicit position ordering.
    - `Favorite`: Unique constraint on `(user_id, song_id)`.
    - `ListeningHistory`: Meaningful event tracking (`progress_seconds`, `completed`).
    - `Follow`: Artist following.
    - `Report`: Moderation reports (`reason`, `status`, `resolved_at`).
    - `Lyrics`: Synchronized and plain text lyrics.
  - Security subsystem in `server/app/auth/security.py` using Argon2id and PyJWT.
  - Role guards and authentication dependencies in `server/app/auth/dependencies.py`.
  - Auth routes in `server/app/routers/auth.py` (`/register`, `/login`, `/refresh`, `/me`).
  - System health and readiness probes in `server/app/main.py`.

## Phase 2 & 3: Object Storage & Streaming Architecture
- **Implemented**:
  - `ObjectStorage` abstraction in `server/app/storage/base.py`.
  - `LocalStorage` provider in `server/app/storage/local.py` with directory traversal protection and chunked byte-range streaming.
  - `S3ObjectStorage` provider in `server/app/storage/s3.py` with presigned URLs for MinIO, Cloudflare R2, and AWS S3.
  - Storage router in `server/app/routers/storage_router.py` serving streams and file downloads.
  - Streaming endpoint in `server/app/routers/songs.py` (`GET /api/v1/songs/{id}/stream`) with full HTTP 206 Range support.
  - Gated download endpoint (`GET /api/v1/songs/{id}/download`) validating `song.download_allowed` and user authorization.

## Phase 4: Discovery, Library & User Interaction
- **Implemented**:
  - Dynamic personalized Home feed in `server/app/routers/home.py`.
  - Database-layer global search across songs, albums, artists, and playlists in `server/app/routers/search.py`.
  - Playlist CRUD with explicit position reordering in `server/app/routers/playlists.py`.
  - Favorites system in `server/app/routers/favorites.py` with optimistic checking and unique constraints.
  - Listening history engine in `server/app/routers/history.py` enforcing duration thresholds and deduplication within 2 minutes.
  - Artist following in `server/app/routers/artists.py`.

## Phase 5: Artist Studio & Upload System
- **Implemented**:
  - Artist Studio endpoints in `server/app/routers/artist_studio.py`.
  - Master audio upload (MP3, FLAC, WAV, M4A, OGG) with size validation and Mutagen tag inspection.
  - Album creation with cover art upload to object storage.
  - Artist download permission control (`download_allowed` toggle).

## Phase 6 & 7: Modern Consumer Web Interface & PWA
- **Implemented**:
  - React + TypeScript + Vite + Tailwind CSS application in `web/`.
  - Spotify/Apple Music-inspired dark interface with custom color palette and typography.
  - Centralized persistent HTML5 Audio Player in `web/src/components/player/GlobalAudioPlayer.tsx`.
  - Queue drawer with track reordering and removal in `web/src/components/player/QueueDrawer.tsx`.
  - Global accessibility keyboard shortcuts in `web/src/hooks/useKeyboardShortcuts.ts` (Space, Arrows, N, P, M).
  - PWA Web Manifest (`manifest.json`) and Service Worker (`sw.js`).
  - Future offline architecture abstraction (`useOfflineManager.ts`) utilizing IndexedDB for offline blobs.
  - Complete page suite:
    - `HomePage`: Dynamic greeting, Recently Played, Liked Songs, New Releases, Popular Tracks, Featured Artists.
    - `SearchPage`: Instant database search with category tabs.
    - `AlbumPage`: Album artwork banner, track list, play & shuffle.
    - `ArtistPage`: Artist hero, follow/unfollow, popular tracks, discography.
    - `PlaylistPage`: Playlist management, track ordering up/down, deletion.
    - `FavoritesPage`: User's liked tracks collection.
    - `HistoryPage`: Listening activity log.
    - `OfflinePage`: Offline library with stored songs and disk usage.
    - `StudioPage`: Creator upload hub for audio and artwork.
    - `AdminPage`: Moderation review and account controls.
    - `LoginPage`: Listener & Creator account registration/sign-in.

## Phase 8: Verification & DevOps Infrastructure
- **Tests Added & Verified**:
  - `server/tests/test_platform.py`: Automated end-to-end verification suite testing all 12 core subsystems (Registration, Login, Catalog, 206 Streaming, Download Permission Gates, Favorites, Playlists Reorder, History Threshold Gates, Search, Moderation, Admin Stats, and P2P/LAN discovery). All 12 suites passed with zero errors.
- **Docker & Infrastructure**:
  - Production-ready `docker-compose.yml` orchestrating PostgreSQL 17, MinIO S3, FastAPI API, and Nginx Web.
  - Multi-stage `server/Dockerfile` and `web/Dockerfile`.
  - Development task runner in `Makefile` and `run_dev.ps1`.
  - Comprehensive documentation in `readme.md`.

## Phase 9: Local-First Zero-Registration & P2P / LAN Sharing Architecture
- **Elimination of Auth Walls**:
  - Cut all registration and login walls across the player.
  - Removed `LoginPage.tsx` and all authentication gate prompts in Favorites, History, Playlists, Studio, and Topbar.
  - Default user dependencies automatically provision and link to local device peer identity (`local_peer` with `ADMIN` role).
  - All streaming, playlists, favorites, studio uploads, and downloads function out-of-the-box on launch.
- **P2P & LAN Music Network**:
  - Backend endpoints in `server/app/routers/p2p.py`:
    - `GET /api/v1/p2p/peer`: Node identity, local IP, device name, catalog track/album counts.
    - `GET /api/v1/p2p/manifest`: Export shared library catalog with playable stream URLs.
    - `GET /api/v1/p2p/peers` & `POST /api/v1/p2p/peers/connect`: Register and track connected LAN peers.
    - `POST /api/v1/p2p/peers/disconnect`: Unregister remote peers.
    - `GET /api/v1/p2p/peers/manifest`: Query remote peer library catalog and rewrite URLs for streaming.
  - Frontend dashboard in `web/src/pages/PeersPage.tsx`:
    - Displays node identity, LAN IP, and track counts.
    - Copy LAN address button for sharing with friends and local devices on WiFi.
    - Connect to peer input form with address validation.
    - Connected peers card deck with online status badges.
    - Interactive peer music explorer to browse and stream tracks directly from remote peers.
    - Global persistent audio player updated with P2P peer origin badge.
- **Verification**:
  - All 12 backend test suites pass with 100% success.
  - React/TypeScript production build completed with 0 errors across 1,624 modules.
