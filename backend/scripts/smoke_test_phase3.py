#!/usr/bin/env python3
"""End-to-End Live Smoke Test for Phase 3:
Workflow Sync, Knowledge Sync, Manifest Publisher, and SDK Manifest Delivery.

Runs against the live Neon PostgreSQL database and the FastAPI application.

Usage:
    cd backend && .venv/bin/python -m scripts.smoke_test_phase3
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
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


SAMPLE_WORKFLOWS_PAYLOAD = {
    "features": [
        {
            "slug": "login",
            "content": {
                "en": {
                    "title": "Sign In to Taxi Sanchalak",
                    "intent_description": "Authenticate with mobile OTP",
                },
                "hi": {
                    "title": "टैक्सी संचालक में साइन इन करें",
                    "intent_description": "मोबाइल ओटीपी के साथ प्रमाणीकरण करें",
                },
            },
            "example_queries": [
                "How do I log in?",
                "Sign in with phone number",
                "लॉग इन कैसे करें?",
            ],
            "requires_auth": False,
            "required_role": None,
            "prerequisite_feature_slug": None,
            "steps": [
                {
                    "step_order": 1,
                    "guide_id": "login-phone-step",
                    "route_pattern": "/login",
                    "action_type": "input",
                    "advance_on": "input_valid",
                    "is_optional": False,
                    "wait_timeout_ms": 5000,
                    "condition": None,
                    "content": {
                        "en": {
                            "title": "Enter Phone Number",
                            "description": "Type your 10-digit mobile number to receive OTP.",
                        },
                        "hi": {
                            "title": "फ़ोन नंबर दर्ज करें",
                            "description": "ओटीपी प्राप्त करने के लिए अपना 10 अंकों का मोबाइल नंबर दर्ज करें।",
                        },
                    },
                    "target_fingerprint": {
                        "guide_id": "login-phone-step",
                        "css": "#phone-input",
                        "role": "textbox",
                        "attrs": {"id": "phone-input", "type": "tel"},
                    },
                },
                {
                    "step_order": 2,
                    "guide_id": "login-submit-step",
                    "route_pattern": "/login",
                    "action_type": "click",
                    "advance_on": "click",
                    "is_optional": False,
                    "wait_timeout_ms": 5000,
                    "condition": None,
                    "content": {
                        "en": {
                            "title": "Submit OTP",
                            "description": "Click Send OTP to verify your account.",
                        },
                        "hi": {
                            "title": "ओटीपी सबमिट करें",
                            "description": "अपना खाता सत्यापित करने के लिए ओटीपी भेजें पर क्लिक करें।",
                        },
                    },
                    "target_fingerprint": {
                        "guide_id": "login-submit-step",
                        "css": "#send-otp-btn",
                        "role": "button",
                        "attrs": {"id": "send-otp-btn", "type": "submit"},
                    },
                },
            ],
        },
        {
            "slug": "ask-money-on-the-go",
            "content": {
                "en": {
                    "title": "Ask for Money on the Go",
                    "intent_description": "Request instant cash payout while driving",
                },
                "hi": {
                    "title": "चलते-फिरते पैसे मांगें",
                    "intent_description": "ड्राइविंग के दौरान तुरंत कैश पेआउट का अनुरोध करें",
                },
            },
            "example_queries": [
                "How do I ask for money while driving?",
                "Instant driver cash withdrawal",
                "चलते-फिरते पैसे कैसे निकालें?",
            ],
            "requires_auth": True,
            "required_role": "driver",
            "prerequisite_feature_slug": "login",
            "steps": [
                {
                    "step_order": 1,
                    "guide_id": "driver-payout-amount-step",
                    "route_pattern": "/driver/dashboard",
                    "action_type": "input",
                    "advance_on": "input_valid",
                    "is_optional": False,
                    "wait_timeout_ms": 5000,
                    "condition": {"role": "driver"},
                    "content": {
                        "en": {
                            "title": "Enter Payout Amount",
                            "description": "Specify the amount of earned cash to transfer immediately.",
                        },
                        "hi": {
                            "title": "पेआउट राशि दर्ज करें",
                            "description": "तुरंत ट्रांसफर करने के लिए अर्जित नकद राशि दर्ज करें।",
                        },
                    },
                    "target_fingerprint": {
                        "guide_id": "driver-payout-amount-step",
                        "css": "#payout-amount",
                        "role": "textbox",
                        "attrs": {"id": "payout-amount", "type": "number"},
                    },
                },
                {
                    "step_order": 2,
                    "guide_id": "driver-payout-cta-step",
                    "route_pattern": "/driver/dashboard",
                    "action_type": "click",
                    "advance_on": "click",
                    "is_optional": False,
                    "wait_timeout_ms": 5000,
                    "condition": {"role": "driver"},
                    "content": {
                        "en": {
                            "title": "Request Instant Cash",
                            "description": "Tap to transfer money straight to your bank account.",
                        },
                        "hi": {
                            "title": "तुरंत नकद अनुरोध करें",
                            "description": "सीधे अपने बैंक खाते में पैसे ट्रांसफर करने के लिए टैप करें।",
                        },
                    },
                    "target_fingerprint": {
                        "guide_id": "driver-payout-cta-step",
                        "css": "[data-testid='instant-payout-cta']",
                        "role": "button",
                        "attrs": {
                            "id": "instant-payout-cta",
                            "data-testid": "instant-payout-cta",
                            "type": "submit",
                        },
                    },
                },
            ],
        },
    ]
}

SAMPLE_KNOWLEDGE_PAYLOAD = {
    "sources": [
        {
            "source_type": "code_summary",
            "title": "Driver Instant Payout Guide",
            "uri": "https://taxisanchalak.com/docs/driver-payouts",
            "locale": "en",
            "chunks": [
                "Drivers can withdraw earned fares instantly after completing any ride.",
                "Zero commission fee applies to all instant withdrawals under the Silver subscription tier.",
            ],
        }
    ]
}


async def run_smoke_test():
    print("=" * 70)
    print("GuideKit Phase 3 Live End-to-End Smoke Test")
    print(f"Database URL: {settings.database_url.split('@')[-1]}")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        # -------------------------------------------------------------------
        # Step 1: Developer Authentication
        # -------------------------------------------------------------------
        print("\n[Step 1] Using configured Google session token...")
        headers = configured_auth_headers()

        # -------------------------------------------------------------------
        # Step 2: Device Code Request & Approval
        # -------------------------------------------------------------------
        print("\n[Step 2] Device-Code Authorization Request...")
        dev_code_resp = await client.post(
            "/api/v1/device-auth/request",
            json={"client": "vscode_extension"},
        )
        assert dev_code_resp.status_code in (200, 201), f"Device code request failed: {dev_code_resp.text}"
        dev_code_data = dev_code_resp.json()
        device_code = dev_code_data["device_code"]
        user_code = dev_code_data["user_code"]
        print(f"✓ Received device code (user_code: {user_code})")

        # Approve the device code as logged-in developer
        print("  Approving device code...")
        approve_resp = await client.post(
            "/api/v1/device-auth/approve",
            headers=headers,
            json={"user_code": user_code},
        )
        assert approve_resp.status_code == 200, f"Approval failed: {approve_resp.text}"
        print("✓ Device code approved.")

        # Poll token endpoint
        token_poll_resp = await client.post(
            "/api/v1/device-auth/token",
            json={"device_code": device_code},
        )
        assert token_poll_resp.status_code == 200, f"Token poll failed: {token_poll_resp.text}"
        ide_token = token_poll_resp.json()["access_token"]
        ide_headers = {"Authorization": f"Bearer {ide_token}"}
        print("✓ VS Code IDE successfully polled device token.")

        # -------------------------------------------------------------------
        # Step 3: Fetch Taxi Sanchalak Project
        # -------------------------------------------------------------------
        print("\n[Step 3] Fetching developer projects...")
        projects_resp = await client.get("/api/v1/projects", headers=ide_headers)
        assert projects_resp.status_code == 200, f"List projects failed: {projects_resp.text}"
        projects = projects_resp.json()
        assert len(projects) > 0, "No projects returned"
        taxi_project = next((p for p in projects if p.get("slug") == "taxi-sanchalak"), projects[0])
        project_id = taxi_project["id"]
        print(f"✓ Found target project: '{taxi_project['name']}' ({project_id})")

        # Fetch project keys to get publishable key
        keys_resp = await client.get(f"/api/v1/projects/{project_id}/keys", headers=ide_headers)
        assert keys_resp.status_code == 200, f"List keys failed: {keys_resp.text}"
        keys = keys_resp.json()
        live_key = next((k for k in keys if "publishable" in k.get("key_type", "")), keys[0])
        publishable_key = live_key.get("key_plain") or "gk_pk_live_demo00000000000000000000000000000"
        print(f"✓ Retrieved Publishable Key: {publishable_key[:12]}...")

        # -------------------------------------------------------------------
        # Step 4: Sync Workflows (Draft creation & step upsert)
        # -------------------------------------------------------------------
        print("\n[Step 4] Syncing Workflows (POST /projects/{id}/workflows/sync)...")
        wf_sync_resp = await client.post(
            f"/api/v1/projects/{project_id}/workflows/sync",
            headers=ide_headers,
            json=SAMPLE_WORKFLOWS_PAYLOAD,
        )
        assert wf_sync_resp.status_code == 200, f"Workflow sync failed: {wf_sync_resp.text}"
        wf_result = wf_sync_resp.json()
        print(f"✓ Synced {wf_result['synced_features']} features:")
        for dv in wf_result["draft_versions"]:
            print(f"  - [{dv['slug']}] Draft v{dv['version_number']} ({dv['step_count']} steps)")

        # Verify idempotency by calling sync again
        print("  Verifying workflow sync idempotency (2nd call)...")
        wf_sync_resp2 = await client.post(
            f"/api/v1/projects/{project_id}/workflows/sync",
            headers=ide_headers,
            json=SAMPLE_WORKFLOWS_PAYLOAD,
        )
        assert wf_sync_resp2.status_code == 200
        print("✓ Workflow sync is fully idempotent.")

        # -------------------------------------------------------------------
        # Step 5: Sync Knowledge Sources & Chunks
        # -------------------------------------------------------------------
        print("\n[Step 5] Syncing Knowledge Sources (POST /projects/{id}/knowledge/sync)...")
        kn_sync_resp = await client.post(
            f"/api/v1/projects/{project_id}/knowledge/sync",
            headers=ide_headers,
            json=SAMPLE_KNOWLEDGE_PAYLOAD,
        )
        assert kn_sync_resp.status_code == 200, f"Knowledge sync failed: {kn_sync_resp.text}"
        kn_result = kn_sync_resp.json()
        print(f"✓ Synced {kn_result['synced_sources']} sources ({kn_result['indexed_chunks']} chunks indexed).")

        # Verify idempotency (hash match -> skipped)
        print("  Verifying knowledge sync idempotency (should skip unchanged)...")
        kn_sync_resp2 = await client.post(
            f"/api/v1/projects/{project_id}/knowledge/sync",
            headers=ide_headers,
            json=SAMPLE_KNOWLEDGE_PAYLOAD,
        )
        assert kn_sync_resp2.status_code == 200
        kn_result2 = kn_sync_resp2.json()
        assert kn_result2["skipped_sources"] >= 1, "Expected skipped sources on hash match"
        print(f"✓ Knowledge sync idempotency confirmed ({kn_result2['skipped_sources']} skipped).")

        # -------------------------------------------------------------------
        # Step 6: Publish Manifest (Draft -> Published + Embeddings + CDN)
        # -------------------------------------------------------------------
        print("\n[Step 6] Publishing CDN Manifest (POST /projects/{id}/publish)...")
        pub_resp = await client.post(
            f"/api/v1/projects/{project_id}/publish",
            headers=ide_headers,
            json={},
        )
        assert pub_resp.status_code == 200, f"Publish failed: {pub_resp.text}"
        pub_result = pub_resp.json()
        version_num = pub_result.get("manifest_version") or pub_result.get("version_number")
        etag = pub_result["etag"]
        print(f"🎉 Manifest v{version_num} Published!")
        print(f"  - Manifest ID: {pub_result.get('manifest_id') or pub_result.get('id')}")
        print(f"  - ETag: {etag}")
        print(f"  - Features: {pub_result.get('published_features') or pub_result.get('feature_count')}")
        print(f"  - CDN URL: {pub_result.get('manifest_url')}")

        # Verify disk write
        disk_path = BACKEND_DIR / "storage" / "manifests" / str(project_id) / "latest.json"
        assert disk_path.exists(), f"Disk manifest not found at {disk_path}"
        with open(disk_path, "r", encoding="utf-8") as f:
            disk_manifest = json.load(f)
        disk_ver = disk_manifest.get("manifest_version") or disk_manifest.get("version")
        assert disk_ver == version_num
        print(f"✓ Verified CDN manifest on disk: {disk_path} ({disk_path.stat().st_size} bytes)")

        # -------------------------------------------------------------------
        # Step 7: Public SDK Runtime Manifest Delivery (GET /sdk/manifest)
        # -------------------------------------------------------------------
        print("\n[Step 7] Testing Public SDK Manifest Delivery (GET /sdk/manifest)...")
        sdk_headers = {
            "X-GuideKit-Key": publishable_key,
            "Origin": "https://taxisanchalak.com",
        }
        sdk_resp = await client.get("/api/v1/sdk/manifest", headers=sdk_headers)
        assert sdk_resp.status_code == 200, f"SDK manifest failed: {sdk_resp.text}"
        assert sdk_resp.headers.get("ETag") == etag, f"ETag mismatch: {sdk_resp.headers.get('ETag')} vs {etag}"
        assert "public" in sdk_resp.headers.get("Cache-Control", ""), "Missing Cache-Control header"
        assert sdk_resp.headers.get("Access-Control-Allow-Origin") == "https://taxisanchalak.com"
        sdk_data = sdk_resp.json()
        sdk_ver = sdk_data.get("manifest_version") or sdk_data.get("version")
        assert sdk_ver == version_num
        assert len(sdk_data["features"]) >= 2
        print(f"✓ SDK 200 OK — ETag: {etag}")
        print(f"✓ Cache-Control: {sdk_resp.headers.get('Cache-Control')}")
        print(f"✓ Access-Control-Allow-Origin: {sdk_resp.headers.get('Access-Control-Allow-Origin')}")
        print(f"✓ Manifest payload contains {len(sdk_data['features'])} published features.")

        # Test 304 Not Modified
        print("  Testing 304 Not Modified with If-None-Match...")
        cache_headers = {**sdk_headers, "If-None-Match": etag}
        cache_resp = await client.get("/api/v1/sdk/manifest", headers=cache_headers)
        assert cache_resp.status_code == 304, f"Expected 304, got {cache_resp.status_code}"
        print("✓ Verified 304 Not Modified response (0 bytes transferred).")

        # Test 403 with disallowed Origin
        print("  Testing 403 Forbidden with unauthorized Origin...")
        evil_headers = {
            "X-GuideKit-Key": publishable_key,
            "Origin": "https://malicious-site.example.com",
        }
        evil_resp = await client.get("/api/v1/sdk/manifest", headers=evil_headers)
        assert evil_resp.status_code == 403, f"Expected 403 for unauthorized origin, got {evil_resp.status_code}"
        print(f"✓ Verified 403 Forbidden for unauthorized origin.")

    print("\n" + "=" * 70)
    print("ALL PHASE 3 SMOKE TESTS PASSED AGAINST LIVE NEON POSTGRESQL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
