from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from config import get_settings  # type: ignore[import]
    from db.connection import close_pool, get_pool  # type: ignore[import]
except ImportError:
    from apps.api.config import get_settings  # type: ignore[import]
    from apps.api.db.connection import close_pool, get_pool  # type: ignore[import]

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Application lifespan: initialize resources on startup, release on shutdown."""
    logger.info("Starting FMDF API...")
    await get_pool()
    logger.info("Database pool ready.")
    yield
    logger.info("Shutting down FMDF API...")
    await close_pool()
    logger.info("Database pool closed.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Florida Multifamily Deal Finder API",
        version="1.0.0",
        description=(
            "Backend API for the FMDF platform — serves deal feed, scoring, "
            "underwriting, and market data for Florida multifamily land opportunities."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers — imported here to avoid circular imports at module load time
    # Each router is expected to be created as the platform grows in Phase 3+
    try:
        try:
            from routers import deals, market, scores, underwriting  # type: ignore[import]
        except ImportError:
            from apps.api.routers import deals, market, scores, underwriting  # type: ignore[import]

        app.include_router(deals.router, prefix="/v1", tags=["deals"])
        app.include_router(scores.router, prefix="/v1", tags=["scores"])
        app.include_router(underwriting.router, prefix="/v1", tags=["underwriting"])
        app.include_router(market.router, prefix="/v1", tags=["market"])
    except ImportError:
        # Routers will be created in Phase 3; app still starts cleanly
        logger.info("Router modules not yet available — skipping router registration.")

    @app.get("/health", tags=["ops"])
    async def health_check() -> dict[str, Any]:
        """Liveness and readiness probe."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
