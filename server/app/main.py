from fastapi import FastAPI

app = FastAPI(
    title="My Music Server",
    version="0.1.0",
)


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