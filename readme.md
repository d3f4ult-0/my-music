# MyMusic Platform

> Modern, self-hostable music streaming & offline music platform built around local-first playback and direct P2P/LAN music sharing without accounts or registration walls.
> 
> *Product philosophy: Spotify's usability + Apple Music's visual cleanliness + Bandcamp's artist ownership + Local-first peer freedom.*

---

## 🌟 Key Features

- **Zero-Registration & Instant Playback**: No account creation, login screens, or sign-in walls. The player auto-provisions a local peer identity and works immediately upon launching.
- **Spicy Lyrics Experience**:
  - Line-by-line synchronized karaoke lyrics inspired by Spicy Lyrics.
  - Active lyric line glowing highlight, inactive lines soft-blurred and dimmed.
  - Smooth auto-centering scroll and interactive click-to-seek to jump to any timestamp.
  - Auto-searches public lyric databases (LRCLIB) on song upload when online.
  - Support for uploading custom `.lrc`, `.txt` files or pasting timestamped lyrics.
- **Ambient Vinyl & Cover Art Blending**:
  - Dynamic ambient color extraction matching song artwork for subtle background glow.
  - Slowly rotating vinyl artwork (40s/rotation) with hardware GPU acceleration that pauses when playback pauses.
- **Ultra-Lightweight Android Production App (<4 MB APK)**:
  - Engineered for low-end Android devices (1GB–2GB RAM, Android 7.0+).
  - Uses native Android System WebView to keep memory under 60MB RAM.
  - Hardware accelerated animations (`gpu-layer`, `translateZ(0)`) to prevent CPU bottlenecks.
  - Native Android `MediaSession` integration: lockscreen controls, notification drawer, artwork, and Bluetooth media buttons.
  - Local WiFi cleartext streaming enabled for direct LAN P2P music exchange.
  - Built-in Server Connection modal in the top bar to easily connect to your PC's IP address.
- **P2P & LAN Music Network**: Connect to other devices and players on your local WiFi or network via HTTP/P2P endpoints (`/api/v1/p2p/peer`, `/api/v1/p2p/manifest`), browse remote peers' music libraries, and stream their tracks directly.
- **Online & Local Music Streaming**: Centralized HTML5 audio engine with HTTP byte-range request streaming (HTTP 206 Partial Content).
- **Music Discovery & Search**: Global database-layer search across Songs, Albums, Artists, and Playlists.
- **Dynamic Home Feed**: Personalized greetings, Recently Played, Liked Songs, New Releases, Popular Tracks, and Featured Artists.
- **Artist Studio**: Dedicated creator dashboard to upload master recordings (MP3, FLAC, WAV, M4A), extract embedded metadata with Mutagen, upload album artwork, and configure download permissions.
- **Legitimate Gated Downloads**: Downloads strictly governed by artist authorization flags (`download_allowed`).
- **Playlists & Favorites**: Create, edit, and reorder playlist tracks with drag/position persistence; optimistic favorite toggling.
- **Listening History**: Smart listening event recording that only persists meaningful playback (threshold-gated and deduplicated).
- **PWA & Offline Architecture**: Web App Manifest, Service Worker offline app shell, and `DownloadManager` IndexedDB storage for offline playback.
- **S3-Compatible Storage**: Storage abstraction supporting local filesystem storage, AWS S3, Cloudflare R2, and MinIO.
- **Accessibility**: Keyboard navigation shortcuts (Space to Play/Pause, Arrow keys to seek, N/P for next/previous, M to mute).

---

## 🏗️ Architecture

```
my-music/
├── server/               # FastAPI Backend
│   ├── app/
│   │   ├── auth/         # Argon2id hashing & JWT token security
│   │   ├── models/       # Normalized SQLAlchemy schema
│   │   ├── routers/      # Versioned REST API v1 endpoints
│   │   ├── schemas/      # Pydantic validation schemas
│   │   ├── services/     # Mutagen extraction, seeding, artwork
│   │   ├── storage/      # ObjectStorage abstraction (Local & S3/R2/MinIO)
│   │   ├── config.py     # Environment configuration
│   │   ├── database.py   # Database session factory (SQLite & PostgreSQL)
│   │   └── main.py       # FastAPI application entrypoint & SPA static server
│   ├── tests/            # Test verification suites
│   ├── Dockerfile
│   └── requirements.txt
│
├── web/                  # React + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── api/          # Typed API client with token auto-refresh
│   │   ├── components/   # Layout, Player, Queue, Cards, Modals
│   │   ├── hooks/        # Keyboard shortcuts, Offline manager
│   │   ├── pages/        # Home, Search, Album, Artist, Playlist, Studio, Admin
│   │   ├── stores/       # Zustand persistent audio player & auth stores
│   │   └── types/        # TypeScript interfaces
│   ├── public/           # PWA manifest & Service Worker
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml    # Orchestration (PostgreSQL, MinIO, API, Web)
├── .env.example          # Environment variables template
├── Makefile              # Quick commands
└── docs/agent-progress.md
```

---

## 🚀 Quick Start

### Option 1: Local Development

#### Prerequisites
- Python 3.10+
- Node.js 18+

#### 1. Setup Backend
```bash
# In the root directory
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r server/requirements.txt
pip install argon2-cffi pyjwt python-multipart boto3 pytest httpx

# Run seed data to populate artists, albums, songs, and users
python server/app/services/seed.py

# Start FastAPI server
PYTHONPATH=server uvicorn app.main:app --reload --port 8000
```

#### 2. Setup Frontend
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Option 2: Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-username/my-music.git
cd my-music

# Copy environment variables
cp .env.example .env

# Start all services (PostgreSQL, MinIO, API, Web)
docker compose up -d --build
```
- Web Application: [http://localhost:3000](http://localhost:3000)
- API & Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- MinIO Console: [http://localhost:9001](http://localhost:9001)

---

## 🔑 Pre-seeded Demo Accounts

| Role | Username / Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Listener** | `listener@mymusic.dev` | `DemoPassword123!` | Streaming, Playlists, Favorites, Downloads |
| **Artist** | `artist@mymusic.dev` | `DemoArtist123!` | Music uploads, Album management, Permissions |
| **Admin** | `admin@mymusic.dev` | `DemoAdmin123!` | Content moderation, User management, Stats |

---

## 📱 Android App (Production & Low-End Optimization)

The Android app is engineered for maximum performance and minimal storage footprint on budget devices:
- **Tiny APK Size (< 4 MB)**: Leverages Capacitor with Android's built-in System WebView. Unlike React Native or Flutter, it avoids bundling a separate 50–80 MB engine.
- **Low Memory Overhead (< 60 MB RAM)**: Perfect for budget phones with 1 GB or 2 GB RAM.
- **Hardware Acceleration**: Transitions, rotating vinyl art, and lyrics auto-scrolling utilize CSS `transform: translateZ(0)` and offscreen canvas cleanup to eliminate garbage collection pauses.
- **Background Audio & Media Notification**: Native `navigator.mediaSession` integration surfaces lockscreen controls, notification drawer playback status, album art, and Bluetooth controls.
- **LAN P2P Streaming**: Configured with `usesCleartextTraffic="true"` to effortlessly stream lossless audio across local WiFi without HTTPS friction.

### Building the Android APK

#### Method 1: Using the Automated Script
- **Windows (PowerShell)**:
  ```powershell
  .\build_android.ps1
  ```
- **macOS / Linux**:
  ```bash
  chmod +x ./build_android.sh
  ./build_android.sh
  ```

#### Method 2: Android Studio (Recommended for first run)
1. Build and sync web assets:
   ```bash
   cd web
   npm run build
   npx cap sync android
   ```
2. Open native project in Android Studio:
   ```bash
   npx cap open android
   ```
3. In Android Studio:
   - Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - APK output location: `web/android/app/build/outputs/apk/debug/app-debug.apk` (or `release/`).
   - Or click the green **Play** button to install directly onto a plugged-in USB Android phone or emulator.

#### Connecting Android Device to Your Music Server
1. Ensure your phone and computer are on the same WiFi network.
2. In the MyMusic app, tap the **Settings** (gear) icon in the top navigation bar.
3. Enter your computer's IP address (e.g., `http://192.168.1.15:8000`) and tap **Save & Connect**.
4. You can now stream your complete music library, view synced Spicy Lyrics, and share with local peers!

---

## 🎤 Spicy Lyrics & Public Auto-Search

MyMusic incorporates a karaoke-style lyrics engine inspired by Spicy Lyrics:
1. **Automatic Online Search**: When an audio track is uploaded via the Studio, the backend automatically queries the public LRCLIB database (`https://lrclib.net`) by track title and artist. If found, synced timestamps are saved automatically.
2. **Interactive Sync**: Click the microphone icon (`Mic2`) in the bottom player bar or on any track to open Spicy Lyrics. Click any lyric line to jump the audio playback directly to that timestamp.
3. **Custom Upload**: Tap the upload button in the lyrics panel to attach your own `.lrc` or `.txt` file, or paste raw lyrics directly.

---

## ⌨️ Global Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause |
| **←** | Seek backward 5 seconds |
| **→** | Seek forward 5 seconds |
| **N** | Skip to next track |
| **P** | Return to previous track |
| **M** | Mute / Unmute audio |

*Shortcuts automatically disengage when typing inside text inputs, search fields, or textareas.*

---

## 🧪 Testing

Run the automated platform test suite covering all 11 core subsystems:

```bash
PYTHONPATH=server python server/tests/test_platform.py
```

Tests verify:
1. User registration with Argon2id password hashing
2. Token generation and login authentication
3. Song and album retrieval
4. Audio streaming with HTTP 206 Range headers
5. Download authorization & artist permission gates
6. Favorites flow with optimistic status
7. Playlist CRUD and track reordering
8. Listening history recording with threshold gates
9. Database-layer global search
10. Content reporting and admin moderation
11. Admin dashboard statistics
