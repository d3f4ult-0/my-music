from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.database import engine, Base
import app.models  # Register all models with Base.metadata
from app.config import settings

# API Routers
from app.routers.auth import router as auth_router
from app.routers.songs import router as songs_router
from app.routers.albums import router as albums_router
from app.routers.artists import router as artists_router
from app.routers.playlists import router as playlists_router
from app.routers.favorites import router as favorites_router
from app.routers.history import router as history_router
from app.routers.search import router as search_router
from app.routers.home import router as home_router
from app.routers.artist_studio import router as artist_studio_router
from app.routers.reports import router as reports_router
from app.routers.storage_router import router as storage_router
from app.routers.admin import router as admin_router
from app.routers.p2p import router as p2p_router

# Legacy Routers
from app.routers.library import router as library_router
from app.routers.lyrics import router as lyrics_router

# Ensure tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MyMusic Platform API",
    description="Modern, self-hostable music streaming & offline music platform",
    version="1.0.0",
)

# CORS Middleware - allows LAN peers, mobile Capacitor app, and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*|^capacitor://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register versioned routers
app.include_router(auth_router)
app.include_router(songs_router)
app.include_router(albums_router)
app.include_router(artists_router)
app.include_router(playlists_router)
app.include_router(favorites_router)
app.include_router(history_router)
app.include_router(search_router)
app.include_router(home_router)
app.include_router(artist_studio_router)
app.include_router(reports_router)
app.include_router(storage_router)
app.include_router(admin_router)
app.include_router(p2p_router)

# Legacy routers
app.include_router(library_router)
app.include_router(lyrics_router)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "storage": settings.storage_provider,
        "environment": settings.environment,
    }


@app.get("/ready")
@app.get("/health/database")
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "not_ready", "database": f"error: {str(e)}"}


# SPA Frontend Static Serving
frontend_dist = Path(__file__).resolve().parents[2] / "web" / "dist"
if frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Allow API, docs, openapi to pass through
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Strict asset check: never return index.html for missing assets
        if full_path.startswith("assets/"):
            target_asset = frontend_dist / full_path
            if target_asset.is_file():
                return FileResponse(target_asset)
            raise HTTPException(status_code=404, detail="Static asset not found")

        target_file = frontend_dist / full_path
        if full_path and target_file.is_file():
            return FileResponse(target_file)
        
        index_file = frontend_dist / "index.html"
        if index_file.is_file():
            return FileResponse(
                index_file,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
        raise HTTPException(status_code=404, detail="Frontend build not found")
else:
    @app.get("/")
    def root():
        return {
            "name": "MyMusic Platform API",
            "version": "1.0.0",
            "status": "online",
            "environment": settings.environment,
            "docs_url": "/docs",
        }
