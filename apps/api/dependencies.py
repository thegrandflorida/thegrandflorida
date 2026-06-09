from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

import asyncpg
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

try:
    from config import get_settings  # type: ignore[import]
    from db.connection import get_connection  # type: ignore[import]
except ImportError:
    from apps.api.config import get_settings  # type: ignore[import]
    from apps.api.db.connection import get_connection  # type: ignore[import]

logger = logging.getLogger(__name__)

_security = HTTPBearer()

# Cache for Supabase JWKS
_jwks_cache: dict[str, Any] = {}


async def _get_supabase_jwks() -> dict[str, Any]:
    """Fetch JWKS from Supabase JWT endpoint with in-process caching."""
    if _jwks_cache:
        return _jwks_cache

    settings = get_settings()
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        _jwks_cache.update(data)
        return _jwks_cache


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency that yields a database connection."""
    async with get_connection() as conn:
        yield conn


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict[str, Any]:
    """Validate a Supabase-issued JWT and return the decoded user claims."""
    from jose import JWTError, jwk, jwt

    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Fetch JWKS and verify
        jwks = await _get_supabase_jwks()
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")

        signing_key: str | None = None
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == kid:
                public_key = jwk.construct(key_data)
                signing_key = public_key.to_pem().decode("utf-8")
                break

        if signing_key is None:
            # Fall back to Supabase service role key for server-side tokens
            settings = get_settings()
            signing_key = settings.supabase_service_role_key

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "HS256"],
            options={"verify_aud": False},
        )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "viewer"),
            "app_metadata": payload.get("app_metadata", {}),
            "user_metadata": payload.get("user_metadata", {}),
        }

    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise credentials_exception from exc
    except Exception as exc:
        logger.error("Unexpected error during JWT validation: %s", exc)
        raise credentials_exception from exc
