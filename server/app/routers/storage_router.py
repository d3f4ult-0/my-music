import mimetypes
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, FileResponse
from app.storage import get_storage
from app.storage.local import LocalStorage

router = APIRouter(
    prefix="/api/v1/storage",
    tags=["Storage"],
)


@router.get("/file")
def get_file(key: str = Query(...)):
    storage = get_storage()
    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="File not found")

    if isinstance(storage, LocalStorage):
        path = storage._resolve_path(key)
        mime, _ = mimetypes.guess_type(path.name)
        return FileResponse(path=path, media_type=mime or "application/octet-stream")

    chunks, _, size, mime = storage.get_stream(key)
    return StreamingResponse(chunks, media_type=mime)


@router.get("/stream")
def stream_file(key: str = Query(...), request: Request = None):
    storage = get_storage()
    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="File not found")

    total_size = storage.get_file_size(key)
    range_header = request.headers.get("range") if request else None

    if not range_header:
        chunks, _, _, mime = storage.get_stream(key, start=0)
        return StreamingResponse(
            chunks,
            media_type=mime,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(total_size),
                "Content-Type": mime,
            },
        )

    if not range_header.startswith("bytes="):
        raise HTTPException(status_code=416, detail="Invalid Range header")

    range_val = range_header.replace("bytes=", "", 1).strip()
    try:
        parts = range_val.split("-", 1)
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else total_size - 1
    except (ValueError, IndexError):
        raise HTTPException(status_code=416, detail="Invalid Range header")

    if start < 0 or start >= total_size or start > end:
        raise HTTPException(status_code=416, detail="Range not satisfiable")

    end = min(end, total_size - 1)
    content_length = end - start + 1
    chunks, _, _, mime = storage.get_stream(key, start=start, length=content_length)

    return StreamingResponse(
        chunks,
        status_code=206,
        media_type=mime,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{total_size}",
            "Content-Length": str(content_length),
            "Content-Type": mime,
        },
    )


@router.get("/download")
def download_file(key: str = Query(...), filename: str = Query(None)):
    storage = get_storage()
    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="File not found")

    total_size = storage.get_file_size(key)
    chunks, _, _, mime = storage.get_stream(key, start=0)
    dl_name = filename or key.split("/")[-1]

    return StreamingResponse(
        chunks,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{dl_name}"',
            "Content-Length": str(total_size),
        },
    )
