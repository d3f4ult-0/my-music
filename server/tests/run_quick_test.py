import asyncio
import httpx
from app.main import app

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        print("AsyncClient Response:", res.status_code, res.json())

if __name__ == "__main__":
    asyncio.run(main())
