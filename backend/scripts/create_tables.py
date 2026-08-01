"""Create all database tables - one-time migration script."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import get_settings
from app.models import *
from app.core.database import Base

settings = get_settings()

async def create_tables():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("All tables created successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
