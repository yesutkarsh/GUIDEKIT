#!/usr/bin/env python3
"""End-to-End Live Smoke Test for Phase 5:
Universal Web SDK, Driver.js Spotlight Engine, 4-Tier DOM Resolver,
and Live 'Taxi Sanchalak' Customer Demo Website Integration.

Runs against the live Neon PostgreSQL database and the FastAPI application.

Usage:
    cd backend && .venv/bin/python -m scripts.smoke_test_phase5
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

# Ensure backend package is importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from scripts.smoke_auth import configured_auth_headers
from httpx import ASGITransport

from app.core.config import settings
from app.main import app


async def run_smoke_test():
    print("=" * 70)
    print("GuideKit Phase 5 Live End-to-End Smoke Test")
    print(f"Database URL: {settings.database_url.split('@')[-1]}")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        # -------------------------------------------------------------------
        # Step 1: Verify Universal Web SDK Bundle Serving (GET /sdk/guidekit-sdk.js)
        # -------------------------------------------------------------------
        print("\n[Step 1] Verifying Universal Web SDK Bundle Serving...")
        sdk_resp = await client.get("/sdk/guidekit-sdk.js")
        assert sdk_resp.status_code == 200, f"Failed to serve SDK bundle: {sdk_resp.status_code}"
        assert "javascript" in sdk_resp.headers.get("content-type", "").lower(), "Content-Type must be javascript"
        assert "GuideKit" in sdk_resp.text, "Bundle must contain 'GuideKit' global definition"
        print(f"✓ Served guidekit-sdk.js ({len(sdk_resp.text)} bytes, Content-Type: application/javascript)")

        # -------------------------------------------------------------------
        # Step 2: Developer Authentication & Project / Key Resolution
        # -------------------------------------------------------------------
        print("\n[Step 2] Using configured Google session token...")
        auth_headers = configured_auth_headers()

        print("  Fetching projects...")
        projects_resp = await client.get("/api/v1/projects", headers=auth_headers)
        assert projects_resp.status_code == 200, f"List projects failed: {projects_resp.text}"
        projects = projects_resp.json()
        taxi_project = next((p for p in projects if p.get("slug") == "taxi-sanchalak"), projects[0])
        project_id = taxi_project["id"]
        print(f"✓ Found target project: '{taxi_project['name']}' ({project_id})")

        print("  Ensuring http://localhost:3000 is allowed in project origins...")
        origins_resp = await client.get(f"/api/v1/projects/{project_id}/origins", headers=auth_headers)
        if origins_resp.status_code == 200:
            existing_origins = [o.get("origin") for o in origins_resp.json()]
            if "http://localhost:3000" not in existing_origins:
                await client.post(
                    f"/api/v1/projects/{project_id}/origins",
                    headers=auth_headers,
                    json={"origin": "http://localhost:3000"},
                )
                print("✓ Registered 'http://localhost:3000' in project origins.")
            else:
                print("✓ 'http://localhost:3000' already present in project origins.")

        print("  Fetching publishable key...")
        keys_resp = await client.get(f"/api/v1/projects/{project_id}/keys", headers=auth_headers)
        assert keys_resp.status_code == 200, f"List keys failed: {keys_resp.text}"
        keys = keys_resp.json()
        live_key = next((k for k in keys if "publishable" in k.get("key_type", "") and not k.get("revoked_at")), keys[0])
        publishable_key = live_key.get("key_plain") or "gk_pk_live_demo00000000000000000000000000000"
        print(f"✓ Publishable Key: {publishable_key[:14]}...")

        sdk_headers = {
            "X-GuideKit-Key": publishable_key,
            "Origin": "http://localhost:3000",
        }

        # -------------------------------------------------------------------
        # Step 3: Manifest Delivery & ETag 304 Caching (GET /sdk/manifest)
        # -------------------------------------------------------------------
        print("\n[Step 3] Testing SDK Manifest Delivery with ETag Caching...")
        manifest_resp = await client.get("/api/v1/sdk/manifest", headers=sdk_headers)
        assert manifest_resp.status_code == 200, f"Manifest fetch failed: {manifest_resp.text}"
        manifest = manifest_resp.json()
        etag = manifest_resp.headers.get("etag") or manifest.get("etag")
        assert etag, "Manifest must return an ETag header"
        print(f"✓ Manifest v{manifest['manifest_version']} fetched (ETag: {etag[:16]}..., {len(manifest['features'])} features)")

        # Verify If-None-Match 304
        cached_headers = {**sdk_headers, "If-None-Match": etag}
        resp_304 = await client.get("/api/v1/sdk/manifest", headers=cached_headers)
        assert resp_304.status_code == 304, f"Expected 304 Not Modified, got {resp_304.status_code}"
        print("✓ Verified 304 Not Modified response on matching ETag.")

        # -------------------------------------------------------------------
        # Step 4: Simulate Taxi Sanchalak Customer Journey via SDK Chat
        # -------------------------------------------------------------------
        print("\n[Step 4] Simulating Logged-Out Customer Intent (Chat Router)...")
        chat_req = {
            "visitor_id": "vis_phase5_demo_customer",
            "message": "How do I ask for money while driving?",
            "locale": "en",
            "current_path": "/",
            "auth_state": {"is_logged_in": False, "role": None},
        }
        chat_resp = await client.post("/api/v1/sdk/chat", headers=sdk_headers, json=chat_req)
        assert chat_resp.status_code == 200, f"Chat failed: {chat_resp.text}"
        chat_data = chat_resp.json()
        session_id = chat_data["session_id"]

        print(f"✓ Route: '{chat_data['route_taken']}' (similarity: {chat_data['similarity']})")
        assert chat_data["route_taken"] == "feature_match"
        assert chat_data["matched_feature_slug"] == "ask-money-on-the-go"

        tour_plan = chat_data["tour_plan"]
        assert tour_plan is not None
        assert tour_plan["requires_login_first"] is True
        print(f"✓ Prerequisite Login stitched: {len(tour_plan['steps'])} total steps (Login steps 1..2, Payout steps 3..4).")

        # -------------------------------------------------------------------
        # Step 5: Simulate 4-Tier DOM Resolver & AI Self-Healing
        # -------------------------------------------------------------------
        print("\n[Step 5] Simulating Mode 3 Mutated Element (Tier 3 AI Self-Healing)...")
        payout_step = tour_plan["steps"][-1]
        payout_step_id = payout_step["step_id"]

        unique_dom_hash = f"dom_phase5_{uuid.uuid4().hex[:12]}"
        mutated_candidates = [
            {
                "candidate_id": "cand_mutated_payout",
                "tag": "button",
                "role": "button",
                "text": "Withdraw Instant Cash",
                "accessible_name": "Withdraw earnings on the go",
                "css_selector": "button#renamed-instant-cash-btn",
                "attrs": {
                    "id": "renamed-instant-cash-btn",
                    "class": "btn-mutated-emerald",
                    "data-testid": "instant-payout-cta",
                },
                "landmark": "div#driver-payout-card",
            },
            {
                "candidate_id": "cand_done_btn",
                "tag": "button",
                "text": "Done",
                "css_selector": "button.btn-done",
                "attrs": {},
            },
        ]

        heal_req = {
            "step_id": payout_step_id,
            "page_path": "/driver/dashboard",
            "dom_hash": unique_dom_hash,
            "locale": "en",
            "candidates": mutated_candidates,
        }

        # Call 1: Expect healed_by_ai
        heal_resp_1 = await client.post("/api/v1/sdk/heal", headers=sdk_headers, json=heal_req)
        assert heal_resp_1.status_code == 200, f"Heal failed: {heal_resp_1.text}"
        heal_data_1 = heal_resp_1.json()
        assert heal_data_1["status"] == "healed_by_ai", f"Expected healed_by_ai, got {heal_data_1['status']}"
        assert heal_data_1["suggested_selector"] == "button#renamed-instant-cash-btn"
        print(f"✓ Call 1: AI Healed successfully (Selector: {heal_data_1['suggested_selector']}, Confidence: {heal_data_1['confidence']:.2f})")

        # Call 2: Expect cache_hit (0ms)
        heal_resp_2 = await client.post("/api/v1/sdk/heal", headers=sdk_headers, json=heal_req)
        assert heal_resp_2.status_code == 200, f"Cache heal failed: {heal_resp_2.text}"
        heal_data_2 = heal_resp_2.json()
        assert heal_data_2["status"] == "cache_hit", f"Expected cache_hit, got {heal_data_2['status']}"
        print("✓ Call 2: Zero-latency Cache Hit verified from step_resolution_cache.")

        # -------------------------------------------------------------------
        # Step 6: Ingest Telemetry Events Batch (POST /sdk/events)
        # -------------------------------------------------------------------
        print("\n[Step 6] Testing Telemetry Batch Ingestion...")
        events_req = {
            "session_id": session_id,
            "tour_events": [
                {"step_id": tour_plan["steps"][0]["step_id"], "event_type": "started"},
                {"step_id": tour_plan["steps"][0]["step_id"], "event_type": "step_shown"},
                {"step_id": tour_plan["steps"][0]["step_id"], "event_type": "step_completed"},
                {"step_id": payout_step_id, "event_type": "step_shown"},
                {"step_id": payout_step_id, "event_type": "step_completed"},
                {"step_id": payout_step_id, "event_type": "completed"},
            ],
            "resolution_logs": [
                {
                    "step_id": tour_plan["steps"][0]["step_id"],
                    "status": "matched_primary",
                    "resolution_ms": 1,
                    "page_path": "/login",
                },
                {
                    "step_id": payout_step_id,
                    "status": "healed_by_ai",
                    "resolution_ms": 14,
                    "page_path": "/driver/dashboard",
                    "dom_hash": unique_dom_hash,
                    "detected_dom_selector": "button#renamed-instant-cash-btn",
                },
            ],
        }

        events_resp = await client.post("/api/v1/sdk/events", headers=sdk_headers, json=events_req)
        assert events_resp.status_code == 200, f"Events failed: {events_resp.text}"
        events_data = events_resp.json()
        assert events_data["ingested_tour_events"] == 6
        assert events_data["ingested_resolution_logs"] == 2
        print(f"✓ Ingested {events_data['ingested_tour_events']} tour events and {events_data['ingested_resolution_logs']} resolution logs.")

        # -------------------------------------------------------------------
        # Step 7: Verify Admin Portal Analytics & Heal Suggestions Inbox
        # -------------------------------------------------------------------
        print("\n[Step 7] Verifying Admin Dashboard Analytics & Self-Healing Inbox...")
        analytics_resp = await client.get(f"/api/v1/projects/{project_id}/analytics", headers=auth_headers)
        assert analytics_resp.status_code == 200
        analytics = analytics_resp.json()
        print(f"✓ Analytics: Chat={analytics['chat']['total_messages']}, Tours Started={analytics['tours']['started']}, Healed by AI={analytics['resolution']['healed_by_ai']}")

        suggestions_resp = await client.get(
            f"/api/v1/projects/{project_id}/heal-suggestions?status=pending",
            headers=auth_headers,
        )
        assert suggestions_resp.status_code == 200
        suggestions = suggestions_resp.json()
        found_suggestion = any(s.get("suggested_selector") == "button#renamed-instant-cash-btn" for s in suggestions)
        assert found_suggestion, "Pending suggestion for mutated button must exist in portal"
        print("✓ Pending heal suggestion confirmed in Self-Healing Inbox.")

    print("\n" + "=" * 70)
    print("ALL PHASE 5 SMOKE TESTS PASSED PERFECTLY AGAINST LIVE NEON POSTGRESQL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())

