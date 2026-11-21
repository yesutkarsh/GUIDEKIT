"""Smoke test for Phase 2 backend endpoints against the live database."""

from __future__ import annotations

import asyncio
import json
from app.main import app
from httpx import ASGITransport, AsyncClient
from scripts.smoke_auth import configured_auth_headers

API_BASE = "/api/v1"
async def main():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=15.0) as client:
        # Check health
        h = await client.get("/health")
        print(f"[1] /health: {h.status_code} -> {h.json()}")
        assert h.status_code == 200

        # Google-authenticated developer token supplied by the caller.
        headers = configured_auth_headers()

        # /auth/me
        me_res = await client.get(f"{API_BASE}/auth/me", headers=headers)
        print(f"[3] /auth/me: {me_res.status_code} -> {me_res.json()['developer']['email']}")
        assert me_res.status_code == 200

        # /projects
        proj_res = await client.get(f"{API_BASE}/projects", headers=headers)
        print(f"[4] /projects: {proj_res.status_code} -> found {len(proj_res.json())} projects")
        assert proj_res.status_code == 200
        projects = proj_res.json()
        taxi = next((p for p in projects if p["name"] == "Taxi Sanchalak"), None)
        assert taxi is not None, "Taxi Sanchalak project not found!"
        project_id = taxi["id"]
        print(f"    Taxi Sanchalak ID: {project_id}")

        # GET /projects/{id}/features
        feat_res = await client.get(f"{API_BASE}/projects/{project_id}/features", headers=headers)
        print(f"[5] /projects/{project_id}/features: {feat_res.status_code} -> {len(feat_res.json())} features")
        assert feat_res.status_code == 200
        features = feat_res.json()
        for f in features:
            print(f"    - {f['slug']}: draft={f['draft_version'] is not None}, published={f['published_version'] is not None}, steps={f['step_count']}")

        # GET /projects/{id}/features/{fid} (detail for login)
        login_feat = next(f for f in features if f["slug"] == "login")
        detail_res = await client.get(f"{API_BASE}/projects/{project_id}/features/{login_feat['id']}", headers=headers)
        print(f"[6] /projects/{project_id}/features/{login_feat['id']}: {detail_res.status_code} -> {len(detail_res.json()['steps'])} steps")
        assert detail_res.status_code == 200

        # GET /projects/{id}/heal-suggestions
        heal_res = await client.get(f"{API_BASE}/projects/{project_id}/heal-suggestions", headers=headers)
        print(f"[7] /projects/{project_id}/heal-suggestions: {heal_res.status_code} -> {len(heal_res.json())} suggestions")
        assert heal_res.status_code == 200
        for s in heal_res.json():
            print(f"    - {s['suggested_selector']} (confidence={s['confidence']}, status={s['status']})")

        # GET /projects/{id}/analytics
        analytics_res = await client.get(f"{API_BASE}/projects/{project_id}/analytics", headers=headers)
        print(f"[8] /projects/{project_id}/analytics: {analytics_res.status_code}")
        assert analytics_res.status_code == 200
        adata = analytics_res.json()
        print(f"    Tours: {adata['tours']}")
        print(f"    Daily rows: {len(adata['usage_daily'])}")
        print(f"    Latest manifest: {adata['latest_manifest']}")

        print("\n✨ ALL LIVE ENDPOINTS VERIFIED SUCCESSFULLY! ✨")


if __name__ == "__main__":
    asyncio.run(main())
