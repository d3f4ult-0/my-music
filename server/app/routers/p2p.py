import os
import socket
import uuid
import json
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.song import Song
from app.models.artist import Artist
from app.models.album import Album
from app.models.user import User
from app.schemas.music import SongResponse
from app.routers.songs import format_song

router = APIRouter(
    prefix="/api/v1/p2p",
    tags=["P2P & LAN Library Sharing"],
)


class PeerInfo(BaseModel):
    peer_id: str
    device_name: str
    local_ip: str
    port: int = 8000
    track_count: int
    album_count: int
    artist_count: int
    version: str = "1.0.0"


class ConnectPeerRequest(BaseModel):
    peer_url: str  # e.g. "http://192.168.1.100:8000"
    name: Optional[str] = None


class DisconnectPeerRequest(BaseModel):
    peer_url: str


_NODE_PEER_ID = str(uuid.uuid4())[:8]
_CONNECTED_PEERS: Dict[str, Dict[str, Any]] = {}


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@router.get("/peer", response_model=PeerInfo)
def get_node_peer_info(db: Session = Depends(get_db)):
    """Returns local peer node identity and library statistics for P2P discovery."""
    track_count = db.scalar(select(func.count(Song.id))) or 0
    album_count = db.scalar(select(func.count(Album.id))) or 0
    artist_count = db.scalar(select(func.count(Artist.id))) or 0

    return PeerInfo(
        peer_id=_NODE_PEER_ID,
        device_name=socket.gethostname(),
        local_ip=get_local_ip(),
        port=8000,
        track_count=track_count,
        album_count=album_count,
        artist_count=artist_count,
    )


@router.get("/manifest", response_model=List[SongResponse])
def get_shared_library_manifest(db: Session = Depends(get_db)):
    """Exports this node's track catalog so peers can stream music directly over LAN/P2P."""
    songs = db.scalars(
        select(Song)
        .options(selectinload(Song.artist), selectinload(Song.album))
        .order_by(Song.title.asc())
    ).all()
    return [format_song(s) for s in songs]


@router.get("/peers")
def list_connected_peers():
    """Lists all remote peers this player is connected with."""
    return {
        "local_node": _NODE_PEER_ID,
        "local_ip": get_local_ip(),
        "peers": list(_CONNECTED_PEERS.values()),
    }


@router.post("/peers/connect")
def connect_peer(request: ConnectPeerRequest):
    """Registers a remote peer URL, verifies connectivity, and retrieves peer info."""
    clean_url = request.peer_url.strip().rstrip("/")
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = f"http://{clean_url}"

    peer_data = {
        "peer_url": clean_url,
        "name": request.name or clean_url,
        "peer_id": "remote-peer",
        "device_name": "LAN Peer",
        "track_count": 0,
        "status": "connected",
    }

    # Attempt to probe remote peer's /api/v1/p2p/peer endpoint
    try:
        req = urllib.request.Request(
            f"{clean_url}/api/v1/p2p/peer",
            headers={"User-Agent": "MyMusic-P2P/1.0"},
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            if resp.status == 200:
                remote_info = json.loads(resp.read().decode("utf-8"))
                peer_data["peer_id"] = remote_info.get("peer_id", "remote-peer")
                peer_data["device_name"] = remote_info.get("device_name", "Remote Peer")
                peer_data["track_count"] = remote_info.get("track_count", 0)
                peer_data["album_count"] = remote_info.get("album_count", 0)
                peer_data["status"] = "online"
    except Exception:
        # If offline or manual entry, still save it as reachable later
        peer_data["status"] = "unverified"

    _CONNECTED_PEERS[clean_url] = peer_data
    return peer_data


@router.post("/peers/disconnect")
def disconnect_peer(request: DisconnectPeerRequest):
    """Disconnects from a remote peer."""
    clean_url = request.peer_url.strip().rstrip("/")
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = f"http://{clean_url}"
    _CONNECTED_PEERS.pop(clean_url, None)
    return {"status": "disconnected", "peer_url": clean_url}


@router.get("/peers/manifest")
def fetch_remote_peer_manifest(peer_url: str = Query(..., description="Target peer URL")):
    """Fetches and rewrites stream/cover URLs of a remote peer's shared library manifest for seamless playback."""
    clean_url = peer_url.strip().rstrip("/")
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = f"http://{clean_url}"

    try:
        req = urllib.request.Request(
            f"{clean_url}/api/v1/p2p/manifest",
            headers={"User-Agent": "MyMusic-P2P/1.0"},
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            if resp.status == 200:
                tracks = json.loads(resp.read().decode("utf-8"))
                # Rewrite track stream_url & cover_url to point to the remote peer's host if relative
                for t in tracks:
                    if t.get("stream_url") and t["stream_url"].startswith("/"):
                        t["stream_url"] = f"{clean_url}{t['stream_url']}"
                    if t.get("cover_url") and t["cover_url"].startswith("/"):
                        t["cover_url"] = f"{clean_url}{t['cover_url']}"
                    if t.get("album") and t["album"].get("cover_url") and t["album"]["cover_url"].startswith("/"):
                        t["album"]["cover_url"] = f"{clean_url}{t['album']['cover_url']}"
                return {"peer_url": clean_url, "tracks": tracks}
            raise HTTPException(status_code=502, detail="Peer returned non-200 status")
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach remote peer at {clean_url}: {str(e)}",
        )
