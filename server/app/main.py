from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine
from app.routers.library import router as library_router 
from app.routers.lyrics import router as lyrics_router


app = FastAPI(
    title="My Music Server",
    version="0.1.0",
)


app.include_router(library_router)
app.include_router(lyrics_router)


@app.get("/")
def root():
    return {
        "name": "My Music Server",
        "version": "0.1.0",
        "status": "online",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/database")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"database": "connected"}
