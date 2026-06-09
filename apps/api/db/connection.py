from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

try:
    from config import get_settings  # type: ignore[import]
except ImportError:
    from apps.api.config import get_settings  # type: ignore[import]

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Return the connection pool, initializing it if necessary."""
    global _pool
    if _pool is None:
        await _init_pool()
    assert _pool is not None
    return _pool


async def _init_pool() -> None:
    """Initialize the asyncpg connection pool with retry logic."""
    global _pool
    settings = get_settings()

    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((OSError, asyncpg.PostgresConnectionError)),
        reraise=True,
    ):
        with attempt:
            logger.info("Initializing database connection pool...")
            _pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=2,
                max_size=10,
                command_timeout=60,
                server_settings={"application_name": "fmdf-api"},
            )
            logger.info("Database connection pool initialized.")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Async context manager that yields a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed.")
