from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("database")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_with_tenant(request=None) -> AsyncSession:
    """DB session that automatically sets tenant context for RLS.

    Usage as FastAPI dependency:
        db: AsyncSession = Depends(get_db_with_tenant)
    """
    async with AsyncSessionLocal() as session:
        try:
            # Set tenant context from request state (set by TenantMiddleware)
            org_id = None
            if request and hasattr(request, "state"):
                org_id = getattr(request.state, "org_id", None)
            if org_id:
                from sqlalchemy import text
                await session.execute(
                    text("SET LOCAL app.current_tenant = :org_id"), {"org_id": org_id}
                )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
