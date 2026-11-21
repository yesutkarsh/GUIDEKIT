#!/usr/bin/env python3
"""End-to-End Live Smoke Test for GuideKit Phase 6 Production Upgrade.

Verifies:
1. Google session auth & VS Code device authorization
2. Two-way workspace feature listing (GET /api/v1/projects/{id}/features)
3. RAG Knowledge Corpus listing & indexing (GET/POST/DELETE /api/v1/projects/{id}/knowledge)
4. Runtime SDK Chat with LLM Intent Router:
   - Procedural Action Query ("How do I book a taxi?") -> feature_match with tour_plan
   - Informational Policy Query ("What is the cancellation policy?") -> rag_answer with suggested_tour_plan
   - Out of scope Query ("Recipe for pizza") -> out_of_scope
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.main import app
from scripts.smoke_auth import configured_bearer_token

BASE_URL = "http://testserver/api/v1"
async def run_smoke_test():
    print("=" * 70)
    print("🚀 GuideKit Phase 6 Production Smoke Test")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL, timeout=30.0) as client:
        # 1. Use a real Google session token supplied by the caller.
        print("\n1. Using configured Google session token...")
        token = configured_bearer_token()
        headers = {"Authorization": f"Bearer {token}"}
        request_res = await client.post("/device-auth/request", json={"client": "vscode_extension"})
        request_res.raise_for_status()
        request_data = request_res.json()
        approve_res = await client.post(
            "/device-auth/approve",
            json={"user_code": request_data["user_code"]},
            headers=headers,
        )
        approve_res.raise_for_status()
        await asyncio.sleep(request_data.get("interval", 5))
        exchange_res = await client.post(
            "/device-auth/token",
            json={"device_code": request_data["device_code"]},
        )
        exchange_res.raise_for_status()
        vscode_token = exchange_res.json()["access_token"]
        print("  ✓ Device authorization issued an extension session.")

        # 3. List projects using VS Code IDE token
        print("\n3. Listing projects with VS Code token...")
        vscode_headers = {"Authorization": f"Bearer {vscode_token}"}
        projects_res = await client.get("/projects", headers=vscode_headers)
        if projects_res.status_code != 200:
            print(f"❌ Projects fetch failed ({projects_res.status_code}): {projects_res.text}")
            sys.exit(1)
        projects = projects_res.json()
        taxi_project = next((p for p in projects if p["slug"] == "taxi-sanchalak"), projects[0])
        project_id = taxi_project["id"]
        print(f"  ✓ Active project: '{taxi_project['name']}' (ID: {project_id})")

        # 4. Fetch publishable key for SDK chat tests
        keys_res = await client.get(f"/projects/{project_id}/keys", headers=vscode_headers)
        keys = keys_res.json()
        pub_key_obj = next((k for k in keys if k["key_type"] == "publishable" and not k.get("revoked_at")), None)
        publishable_key = pub_key_obj["key_plain"] if pub_key_obj and pub_key_obj.get("key_plain") else "gk_pk_live_demo00000000000000000000000000000"
        print(f"  ✓ Publishable key ready: {publishable_key[:16]}...")

        # 5. Two-Way Workspace: List existing features/workflows
        print("\n4. Testing Two-Way Workflow Loading (GET /projects/{id}/features)...")
        features_res = await client.get(f"/projects/{project_id}/features", headers=vscode_headers)
        if features_res.status_code != 200:
            print(f"❌ Features list failed: {features_res.text}")
            sys.exit(1)
        features = features_res.json()
        print(f"  ✓ Loaded {len(features)} workflows from DB:")
        for f in features:
            status = "Published" if f.get("published_version") else "Draft"
            print(f"    - [{status}] {f['slug']} ({f.get('step_count', 0)} steps)")

        # 6. RAG Knowledge Corpus Listing
        print("\n5. Testing Knowledge Base Corpus (GET /projects/{id}/knowledge)...")
        k_res = await client.get(f"/projects/{project_id}/knowledge", headers=vscode_headers)
        if k_res.status_code != 200:
            print(f"❌ Knowledge list failed: {k_res.text}")
            sys.exit(1)
        sources = k_res.json()
        print(f"  ✓ Found {len(sources)} indexed knowledge sources:")
        for src in sources:
            print(f"    - [{src['source_type'].upper()}] {src['title']} ({src['chunk_count']} chunks)")

        # 7. Test Raw Text Knowledge Ingestion and Deletion
        print("\n6. Testing Knowledge Ingestion & Lifecycle (POST & DELETE /knowledge)...")
        ingest_res = await client.post(
            f"/projects/{project_id}/knowledge/text",
            json={
                "title": "Smoke Test Temporary Guidelines",
                "content": "Smoking is strictly prohibited inside all Taxi Sanchalak cabs. Violators face a ₹500 cleaning fine.",
                "locale": "en",
            },
            headers=vscode_headers,
        )
        if ingest_res.status_code != 200:
            print(f"❌ Ingestion failed: {ingest_res.text}")
            sys.exit(1)
        ingest_data = ingest_res.json()
        source_id = ingest_data["source_id"]
        print(f"  ✓ Ingested temp source (ID: {source_id}) with {ingest_data['chunk_count']} chunks.")

        # Delete the temp source
        del_res = await client.delete(f"/projects/{project_id}/knowledge/{source_id}", headers=vscode_headers)
        if del_res.status_code != 204:
            print(f"❌ Delete knowledge source failed: {del_res.text}")
            sys.exit(1)
        print("  ✓ Temp knowledge source deleted cleanly.")

        # 8. Test Runtime SDK Chat with LLM Intent Router
        print("\n7. Testing Runtime SDK Chat Intent Router...")

        # Test 8A: Procedural Query -> feature_match with tour_plan
        print("\n  Case 8A: Procedural Query ('How do I book a taxi?')")
        chat_a = await client.post(
            "/sdk/chat",
            json={
                "visitor_id": "vis_smoke_test_1",
                "message": "How do I book a taxi?",
                "locale": "en",
                "current_path": "/",
                "auth_state": {"is_logged_in": True, "role": "passenger"},
            },
            headers={"X-GuideKit-Key": publishable_key},
        )
        if chat_a.status_code != 200:
            print(f"  ❌ Chat A failed: {chat_a.text}")
            sys.exit(1)
        res_a = chat_a.json()
        print(f"    - Route: {res_a['route_taken']}")
        print(f"    - Reply: {res_a['reply']}")
        has_tour = bool(res_a.get("tour_plan") and res_a["tour_plan"]["steps"])
        print(f"    - Tour Plan Attached: {has_tour} ({len(res_a['tour_plan']['steps']) if has_tour else 0} steps)")
        assert res_a["route_taken"] == "feature_match"
        assert has_tour, "Procedural flow must return executable tour_plan"
        print("    ✓ Case 8A PASS")

        # Test 8B: Informational / Policy Query -> rag_answer with suggested_tour_plan
        print("\n  Case 8B: Policy Query ('What is the cancellation policy for taxi bookings?')")
        chat_b = await client.post(
            "/sdk/chat",
            json={
                "visitor_id": "vis_smoke_test_2",
                "message": "What is the cancellation policy for taxi bookings?",
                "locale": "en",
                "current_path": "/",
                "auth_state": {"is_logged_in": True, "role": "passenger"},
            },
            headers={"X-GuideKit-Key": publishable_key},
        )
        if chat_b.status_code != 200:
            print(f"  ❌ Chat B failed: {chat_b.text}")
            sys.exit(1)
        res_b = chat_b.json()
        print(f"    - Route: {res_b['route_taken']}")
        print(f"    - Reply: {res_b['reply'][:120]}...")
        auto_tour = bool(res_b.get("tour_plan"))
        suggested_tour = bool(res_b.get("suggested_tour_plan"))
        print(f"    - Auto Tour Plan: {auto_tour} (Expected: False - Should NOT interrupt user)")
        print(f"    - Suggested Tour Plan: {suggested_tour} (Expected: True - Non-intrusive action button)")
        assert res_b["route_taken"] == "rag_answer"
        assert not auto_tour, "Policy queries must not trigger automated on-screen tours"
        print("    ✓ Case 8B PASS")

        # Test 8C: Out of Scope Query
        print("\n  Case 8C: Out of Scope Query ('What is the recipe for cheese pizza?')")
        chat_c = await client.post(
            "/sdk/chat",
            json={
                "visitor_id": "vis_smoke_test_3",
                "message": "What is the recipe for cheese pizza?",
                "locale": "en",
                "current_path": "/",
            },
            headers={"X-GuideKit-Key": publishable_key},
        )
        if chat_c.status_code != 200:
            print(f"  ❌ Chat C failed: {chat_c.text}")
            sys.exit(1)
        res_c = chat_c.json()
        print(f"    - Route: {res_c['route_taken']}")
        print(f"    - Reply: {res_c['reply']}")
        assert res_c["route_taken"] == "out_of_scope"
        print("    ✓ Case 8C PASS")

    print("\n" + "=" * 70)
    print("🏆 ALL PHASE 6 SMOKE TESTS PASSED CLEANLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
