from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from config import ASYNC_DATABASE_URL

engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    from models.base import Base
    import models.report  # noqa: F401
    import models.user    # noqa: F401
    import models.admin   # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
