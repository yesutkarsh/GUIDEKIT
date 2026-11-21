"""Application bootstrap tests: the app imports and serves without a database."""

from __future__ import annotations

import httpx

from app.main import app


async def test_health_endpoint(client: httpx.AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_all_phase1_routes_registered(client: httpx.AsyncClient) -> None:
    # Enumerate the resolved endpoint paths via the OpenAPI schema, which is
    # robust across FastAPI versions (nested routers are resolved lazily).
    paths = set(app.openapi()["paths"].keys())
    expected = {
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
        "/api/v1/device-auth/request",
        "/api/v1/device-auth/approve",
        "/api/v1/device-auth/deny",
        "/api/v1/device-auth/token",
        "/api/v1/device-auth/requests/{user_code}",
        "/api/v1/orgs",
        "/api/v1/orgs/{org_id}/projects",
        "/api/v1/projects",
        "/api/v1/projects/{project_id}",
        "/api/v1/projects/{project_id}/origins",
        "/api/v1/projects/{project_id}/keys",
        "/api/v1/sdk/verify",
    }
    missing = expected - paths
    assert not missing, f"routes not registered: {missing}"


async def test_password_routes_are_removed(client: httpx.AsyncClient) -> None:
    assert (await client.post("/api/v1/auth/login", json={})).status_code == 404
    assert (await client.post("/api/v1/auth/signup", json={})).status_code == 404


async def test_unknown_route_returns_404(client: httpx.AsyncClient) -> None:
    resp = await client.get("/api/v1/nope")
    assert resp.status_code == 404
