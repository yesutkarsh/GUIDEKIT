#!/usr/bin/env python3
"""End-to-End Live Smoke Test for Phase 4:
Runtime Chat Router, Prerequisite Flow Stitcher, Knowledge RAG,
Cached AI Self-Healing Resolver, and Telemetry Events Ingestion.

Runs against the live Neon PostgreSQL database and the FastAPI application.

Usage:
    cd backend && .venv/bin/python -m scripts.smoke_test_phase4
"""

from __future__ import annotations

import asyncio
import json
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
    print("GuideKit Phase 4 Live End-to-End Smoke Test")
    print(f"Database URL: {settings.database_url.split('@')[-1]}")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        # -------------------------------------------------------------------
        # Step 1: Developer Login & Project / Key Resolution
        # -------------------------------------------------------------------
        print("\n[Step 1] Using configured Google session token...")
        auth_headers = configured_auth_headers()

        print("  Fetching projects...")
        projects_resp = await client.get("/api/v1/projects", headers=auth_headers)
        assert projects_resp.status_code == 200, f"List projects failed: {projects_resp.text}"
        projects = projects_resp.json()
        taxi_project = next((p for p in projects if p.get("slug") == "taxi-sanchalak"), projects[0])
        project_id = taxi_project["id"]
        print(f"✓ Found target project: '{taxi_project['name']}' ({project_id})")

        print("  Fetching publishable key...")
        keys_resp = await client.get(f"/api/v1/projects/{project_id}/keys", headers=auth_headers)
        assert keys_resp.status_code == 200, f"List keys failed: {keys_resp.text}"
        keys = keys_resp.json()
        live_key = next((k for k in keys if "publishable" in k.get("key_type", "")), keys[0])
        publishable_key = live_key.get("key_plain") or "gk_pk_live_demo00000000000000000000000000000"
        print(f"✓ Publishable Key: {publishable_key[:14]}...")

        sdk_headers = {
            "X-GuideKit-Key": publishable_key,
            "Origin": "https://taxisanchalak.com",
        }

        # -------------------------------------------------------------------
        # Step 2: Test Chat Router - Logged-Out Prerequisite Stitching
        # -------------------------------------------------------------------
        print("\n[Step 2] Testing Chat: Logged-Out Query with Auth Required Flow...")
        chat_req_1 = {
            "visitor_id": "vis_phase4_demo_01",
            "message": "How do I ask for money while driving?",
            "locale": "en",
            "current_path": "/",
            "auth_state": {"is_logged_in": False, "role": None},
        }
        resp1 = await client.post("/api/v1/sdk/chat", headers=sdk_headers, json=chat_req_1)
        assert resp1.status_code == 200, f"Chat failed: {resp1.text}"
        data1 = resp1.json()

        print(f"✓ Route Taken: '{data1['route_taken']}' (similarity: {data1['similarity']})")
        assert data1["route_taken"] == "feature_match", f"Expected feature_match, got {data1['route_taken']}"
        assert data1["matched_feature_slug"] == "ask-money-on-the-go"

        plan1 = data1["tour_plan"]
        assert plan1 is not None, "Tour plan should not be null"
        assert plan1["requires_login_first"] is True, "Must require login first when logged out"
        assert len(plan1["chained_features"]) == 2, "Chained features must include login + target"
        assert plan1["chained_features"][0]["slug"] == "login"
        assert plan1["chained_features"][0]["is_prerequisite"] is True
        assert plan1["chained_features"][1]["slug"] == "ask-money-on-the-go"

        steps1 = plan1["steps"]
        assert len(steps1) >= 3, f"Expected at least 3 stitched steps, got {len(steps1)}"
        assert steps1[0]["feature_slug"] == "login", "Step 1 must be from login prerequisite"
        assert steps1[0]["execution_index"] == 1
        assert steps1[-1]["feature_slug"] == "ask-money-on-the-go", "Final step must be from target flow"
        print(f"✓ Prerequisite Login stitched cleanly ({len(steps1)} total steps, execution_index 1..{len(steps1)}).")
        print(f"  Assistant Reply: \"{data1['reply']}\"")

        # -------------------------------------------------------------------
        # Step 3: Test Chat Router - Logged-In Driver Direct Execution
        # -------------------------------------------------------------------
        print("\n[Step 3] Testing Chat: Logged-In Driver Direct Execution...")
        chat_req_2 = {
            "visitor_id": "vis_phase4_demo_02",
            "session_id": data1["session_id"],
            "message": "Instant driver cash withdrawal",
            "locale": "en",
            "current_path": "/driver/dashboard",
            "auth_state": {"is_logged_in": True, "role": "driver"},
        }
        resp2 = await client.post("/api/v1/sdk/chat", headers=sdk_headers, json=chat_req_2)
        assert resp2.status_code == 200, f"Chat failed: {resp2.text}"
        data2 = resp2.json()

        assert data2["route_taken"] == "feature_match"
        plan2 = data2["tour_plan"]
        assert plan2 is not None
        assert plan2["requires_login_first"] is False, "Logged-in driver should NOT require login first"
        assert len(plan2["chained_features"]) == 1
        assert plan2["chained_features"][0]["slug"] == "ask-money-on-the-go"
        assert all(s["feature_slug"] == "ask-money-on-the-go" for s in plan2["steps"])
        print(f"✓ Direct target execution verified for logged-in driver ({len(plan2['steps'])} steps, requires_login_first=False).")

        # -------------------------------------------------------------------
        # Step 4: Test Chat Router - Hindi Locale Intent Matching
        # -------------------------------------------------------------------
        print("\n[Step 4] Testing Chat: Hindi Query Intent Matching...")
        chat_req_hi = {
            "visitor_id": "vis_phase4_demo_03",
            "message": "चलते-फिरते पैसे कैसे निकालें?",
            "locale": "hi",
            "current_path": "/driver/dashboard",
            "auth_state": {"is_logged_in": True, "role": "driver"},
        }
        resp_hi = await client.post("/api/v1/sdk/chat", headers=sdk_headers, json=chat_req_hi)
        assert resp_hi.status_code == 200, f"Hindi chat failed: {resp_hi.text}"
        data_hi = resp_hi.json()
        assert data_hi["route_taken"] == "feature_match"
        print(f"✓ Hindi Query Matched: '{data_hi['matched_feature_slug']}' (similarity: {data_hi['similarity']})")
        print(f"  Hindi Reply: \"{data_hi['reply']}\"")

        # -------------------------------------------------------------------
        # Step 5: Test Chat Router - Out of Scope Guardrail
        # -------------------------------------------------------------------
        print("\n[Step 5] Testing Chat: Out-of-Scope Guardrail...")
        chat_req_oos = {
            "visitor_id": "vis_phase4_demo_04",
            "message": "What is the atmospheric composition of Jupiter's moons?",
            "locale": "en",
        }
        resp_oos = await client.post("/api/v1/sdk/chat", headers=sdk_headers, json=chat_req_oos)
        assert resp_oos.status_code == 200, f"OOS chat failed: {resp_oos.text}"
        data_oos = resp_oos.json()
        assert data_oos["route_taken"] == "out_of_scope"
        assert data_oos["tour_plan"] is None
        print(f"✓ Out-of-scope guardrail triggered correctly: \"{data_oos['reply']}\"")

        # -------------------------------------------------------------------
        # Step 6: Test Self-Healing Resolver - AI Heal (Call 1) & Cache Hit (Call 2)
        # -------------------------------------------------------------------
        print("\n[Step 6] Testing Self-Healing DOM Resolver...")
        # Get target step ID from Step 2's payout steps
        target_step = next(s for s in steps1 if s["feature_slug"] == "ask-money-on-the-go" and (s["action_type"] == "click" or "button" in str(s["target_fingerprint"]).lower()))
        test_step_id = target_step["step_id"]
        print(f"  Target Step selected: {target_step['guide_id']} ({test_step_id})")
        print(f"  Target Step fingerprint: {target_step['target_fingerprint']}")

        mutated_candidates = [
            {
                "candidate_id": "cand_renamed_cta",
                "tag": "button",
                "role": "button",
                "text": "Withdraw Instant Cash",
                "accessible_name": "Instant Driver Earnings Payout",
                "css_selector": "button#renamed-instant-cash-btn",
                "attrs": {
                    "id": "renamed-instant-cash-btn",
                    "data-testid": "instant-payout-cta",
                    "class": "btn-emerald-cta-payout",
                },
                "landmark": "section#driver-payout-hub",
            },
            {
                "candidate_id": "cand_unrelated_nav",
                "tag": "a",
                "role": "link",
                "text": "Back to Home",
                "css_selector": "a.nav-link-home",
                "attrs": {"href": "/"},
            },
        ]

        # Call 1: Misses cache -> healed_by_ai
        print("  Call 1: Sending mutated candidates (expect healed_by_ai)...")
        test_dom_hash = f"dom_hash_{uuid.uuid4().hex[:12]}"
        heal_req_1 = {
            "step_id": test_step_id,
            "page_path": "/driver/dashboard?tab=earnings",
            "dom_hash": test_dom_hash,
            "candidates": mutated_candidates,
            "locale": "en",
        }
        heal_resp_1 = await client.post("/api/v1/sdk/heal", headers=sdk_headers, json=heal_req_1)
        assert heal_resp_1.status_code == 200, f"Heal Call 1 failed: {heal_resp_1.text}"
        heal_data_1 = heal_resp_1.json()

        print(f"  Heal response: {heal_data_1}")
        assert heal_data_1["status"] == "healed_by_ai", f"Expected healed_by_ai, got {heal_data_1}"
        assert heal_data_1["suggested_selector"] == "button#renamed-instant-cash-btn"
        assert heal_data_1["confidence"] >= 0.50
        print(f"✓ Call 1: AI Healed successfully (Selector: {heal_data_1['suggested_selector']}, Confidence: {heal_data_1['confidence']})")

        # Call 2: Same candidates -> cache_hit
        print("  Call 2: Repeating identical request (expect cache_hit)...")
        heal_resp_2 = await client.post("/api/v1/sdk/heal", headers=sdk_headers, json=heal_req_1)
        assert heal_resp_2.status_code == 200, f"Heal Call 2 failed: {heal_resp_2.text}"
        heal_data_2 = heal_resp_2.json()

        assert heal_data_2["status"] == "cache_hit"
        assert heal_data_2["suggested_selector"] == "button#renamed-instant-cash-btn"
        assert heal_data_2["confidence"] == 1.0
        print("✓ Call 2: Zero-AI Cache Hit verified (Confidence: 1.0).")

        # Verify suggestion populated in heal-suggestions endpoint
        print("  Checking heal suggestions inbox...")
        sugg_resp = await client.get(f"/api/v1/projects/{project_id}/heal-suggestions", headers=auth_headers)
        assert sugg_resp.status_code == 200, f"Get suggestions failed: {sugg_resp.text}"
        suggestions = sugg_resp.json()
        matching_sugg = next((s for s in suggestions if s.get("suggested_selector") == "button#renamed-instant-cash-btn"), None)
        assert matching_sugg is not None, "New heal suggestion must appear in Developer Inbox"
        print(f"✓ Heal suggestion confirmed in developer portal (status: {matching_sugg['status']}, occurrences: {matching_sugg['occurrences']}).")

        # -------------------------------------------------------------------
        # Step 7: Test Telemetry Events Batch Ingestion
        # -------------------------------------------------------------------
        print("\n[Step 7] Testing Telemetry Batch Ingestion (POST /sdk/events)...")
        events_payload = {
            "session_id": data1["session_id"],
            "tour_events": [
                {"event_type": "started", "step_id": test_step_id},
                {"event_type": "step_completed", "step_id": test_step_id},
                {"event_type": "completed"},
            ],
            "resolution_logs": [
                {
                    "step_id": test_step_id,
                    "status": "matched_primary",
                    "resolution_ms": 2,
                    "page_path": "/driver/dashboard",
                    "detected_dom_selector": "#payout-amount",
                }
            ],
        }
        events_resp = await client.post("/api/v1/sdk/events", headers=sdk_headers, json=events_payload)
        assert events_resp.status_code == 200, f"Events batch failed: {events_resp.text}"
        events_data = events_resp.json()
        assert events_data["ingested_tour_events"] == 3
        assert events_data["ingested_resolution_logs"] == 1
        print(f"✓ Ingested {events_data['ingested_tour_events']} tour events and {events_data['ingested_resolution_logs']} resolution logs.")

        # Check analytics endpoint
        print("  Verifying project analytics aggregation...")
        analytics_resp = await client.get(f"/api/v1/projects/{project_id}/analytics", headers=auth_headers)
        assert analytics_resp.status_code == 200, f"Analytics failed: {analytics_resp.text}"
        analytics = analytics_resp.json()
        print(f"✓ Analytics verified: {analytics['chat']['total_messages']} total chat messages, {analytics['tours']['started']} tours started, {analytics['resolution']['healed_by_ai']} healed by AI.")

    print("\n" + "=" * 70)
    print("ALL PHASE 4 SMOKE TESTS PASSED AGAINST LIVE NEON POSTGRESQL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
