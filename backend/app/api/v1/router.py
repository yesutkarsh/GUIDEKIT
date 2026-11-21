"""API v1 router: aggregates all Phase 1, Phase 2, and Phase 3 endpoint groups."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, device_auth, inspector, projects, publisher, sdk_guard, sdk_runtime

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(device_auth.router)
api_router.include_router(projects.router)
api_router.include_router(sdk_guard.router)
api_router.include_router(inspector.router)
api_router.include_router(publisher.router)
api_router.include_router(sdk_runtime.router)
