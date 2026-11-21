"""FastAPI application factory for the GuideKit backend.

The app is deliberately lazy about the database: importing or constructing it
never opens a connection. The async engine is created on first use (see
:mod:`app.db.session`), so the app boots and serves ``/health`` without a
configured ``DATABASE_URL``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pathlib import Path

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import get_engine

logger = logging.getLogger("guidekit")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle: release the engine pool on shutdown."""
    yield
    engine = get_engine()
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="GuideKit Phase 1: database foundation, unified auth, device-code IDE login, project/key provisioning.",
        lifespan=lifespan,
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["health"], summary="Liveness probe (no database access)")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name, "environment": settings.environment}

    @app.get("/sdk/guidekit-sdk.js", tags=["sdk"], summary="Serve GuideKit Universal Web SDK bundle")
    async def serve_sdk() -> Response:
        # Check sdk/dist then frontend/public/sdk
        candidates = [
            Path(__file__).resolve().parents[2] / "sdk" / "dist" / "guidekit-sdk.iife.js",
            Path(__file__).resolve().parents[2] / "frontend" / "public" / "sdk" / "guidekit-sdk.js",
        ]
        for p in candidates:
            if p.exists():
                content = p.read_text(encoding="utf-8")
                return Response(
                    content=content,
                    media_type="application/javascript",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600",
                    },
                )
        return Response(
            content="/* GuideKit SDK bundle not found. Run npm run build in sdk/ */",
            media_type="application/javascript",
            status_code=404,
            headers={"Access-Control-Allow-Origin": "*"},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    return app


app = create_app()
