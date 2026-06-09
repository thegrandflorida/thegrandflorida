"""
Redis cache layer — async client wrapper with namespaced keys and TTL support.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_NAMESPACE = "fmdf"

# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

_redis_client: Optional[aioredis.Redis] = None


def get_redis_client() -> aioredis.Redis:
    """Return a shared async Redis client (created once at startup)."""
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
    return _redis_client


# ---------------------------------------------------------------------------
# Key builder
# ---------------------------------------------------------------------------


def cache_key(*parts: str) -> str:
    """
    Build a namespaced cache key.

    Example:
        cache_key("feed", "daily", "2025-01-15")
        → "fmdf:feed:daily:2025-01-15"
    """
    return ":".join([_NAMESPACE] + list(parts))


# ---------------------------------------------------------------------------
# Cache operations
# ---------------------------------------------------------------------------


async def get_cached(redis: aioredis.Redis, key: str) -> Optional[Any]:
    """
    Fetch a value from Redis.

    Returns the deserialized Python object, or None on cache miss or error.
    """
    try:
        raw = await redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Cache GET failed for key %r: %s", key, exc)
        return None


async def set_cached(
    redis: aioredis.Redis,
    key: str,
    value: Any,
    ttl_seconds: int = 300,
) -> None:
    """
    Serialize and store a value in Redis with a TTL.

    Silently logs and swallows errors so cache failures never crash the API.
    """
    try:
        serialized = json.dumps(value, default=str)
        await redis.set(key, serialized, ex=ttl_seconds)
    except Exception as exc:
        logger.warning("Cache SET failed for key %r: %s", key, exc)


async def invalidate(redis: aioredis.Redis, key: str) -> None:
    """
    Delete a single cache entry.

    Silently swallows errors.
    """
    try:
        await redis.delete(key)
    except Exception as exc:
        logger.warning("Cache DELETE failed for key %r: %s", key, exc)


async def invalidate_pattern(redis: aioredis.Redis, pattern: str) -> int:
    """
    Delete all keys matching a glob pattern (e.g. "fmdf:feed:*").

    Uses SCAN to avoid blocking the Redis server.
    Returns the number of keys deleted.
    """
    deleted = 0
    try:
        async for key in redis.scan_iter(match=pattern, count=100):
            await redis.delete(key)
            deleted += 1
    except Exception as exc:
        logger.warning("Cache invalidate_pattern failed for %r: %s", pattern, exc)
    return deleted
