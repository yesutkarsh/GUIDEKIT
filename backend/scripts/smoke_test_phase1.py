#!/usr/bin/env python3
"""End-to-end smoke test for all GuideKit Phase 1 flows.

Run AFTER ``scripts/init_db.py`` has applied the schema and the API server is
running (``uvicorn app.main:app --reload``).

Usage::

    # from the backend/ directory
    BASE_URL=http://127.0.0.1:8000 python scripts/smoke_test_phase1.py

Requires a live database and server. Uses a unique email per run so it can be
re-run without cleaning up.
"""

from __future__ import annotations

import asyncio
import os
import sys

import httpx
from scripts.smoke_auth import configured_bearer_token

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api/v1"

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


async def main() -> int:
    origin = "https://example.com"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Health -------------------------------------------------------
        try:
            resp = await client.get(f"{BASE_URL}/health")
            record("GET /health", resp.status_code == 200, f"status={resp.status_code}")
        except Exception as exc:  # noqa: BLE001
            record("GET /health", False, str(exc))

        # 2. Google session ----------------------------------------------
        access = configured_bearer_token()
        headers = {"Authorization": f"Bearer {access}"}

        # 3. Me -----------------------------------------------------------
        resp = await client.get(f"{API}/auth/me", headers=headers)
        ok = resp.status_code == 200 and bool(resp.json()["developer"]["email"])
        record("GET /auth/me", ok, f"status={resp.status_code}")
        if not ok:
            print(resp.text)

        # 6. Organizations ------------------------------------------------
        resp = await client.get(f"{API}/orgs", headers=headers)
        ok = resp.status_code == 200 and len(resp.json()) >= 1
        record("GET /orgs", ok, f"status={resp.status_code} count={len(resp.json()) if resp.status_code == 200 else '?'}")
        personal_org_id = resp.json()[0]["id"] if resp.status_code == 200 and resp.json() else None

        resp = await client.post(f"{API}/orgs", headers=headers, json={"name": "Acme Smoke"})
        ok = resp.status_code == 201
        record("POST /orgs", ok, f"status={resp.status_code}")

        # 7. Project ------------------------------------------------------
        if personal_org_id:
            resp = await client.post(
                f"{API}/orgs/{personal_org_id}/projects",
                headers=headers,
                json={"name": "Taxi Central", "framework": "sveltekit", "supported_locales": ["en", "hi"]},
            )
            ok = resp.status_code == 201
            record("POST /orgs/{id}/projects", ok, f"status={resp.status_code}")
            if not ok:
                print(resp.text)
                return 1
            project_id = resp.json()["id"]
        else:
            record("POST /orgs/{id}/projects", False, "no personal org found")
            return 1

        resp = await client.get(f"{API}/projects", headers=headers)
        record("GET /projects", resp.status_code == 200, f"status={resp.status_code}")

        # 8. Origins ------------------------------------------------------
        resp = await client.post(
            f"{API}/projects/{project_id}/origins",
            headers=headers,
            json={"origin": origin, "environment": "production"},
        )
        ok = resp.status_code == 201
        record("POST /projects/{id}/origins", ok, f"status={resp.status_code}")

        # 9. Keys ---------------------------------------------------------
        resp = await client.post(
            f"{API}/projects/{project_id}/keys",
            headers=headers,
            json={"key_type": "publishable", "label": "smoke-pk"},
        )
        ok = resp.status_code == 201
        record("POST /projects/{id}/keys (publishable)", ok, f"status={resp.status_code}")
        if not ok:
            print(resp.text)
            return 1
        publishable_key = resp.json()["full_key"]

        resp = await client.post(
            f"{API}/projects/{project_id}/keys",
            headers=headers,
            json={"key_type": "secret", "label": "smoke-sk"},
        )
        ok = resp.status_code == 201 and resp.json()["key"]["key_plain"] is None
        record("POST /projects/{id}/keys (secret)", ok, f"status={resp.status_code}")

        resp = await client.get(f"{API}/projects/{project_id}/keys", headers=headers)
        ok = resp.status_code == 200 and len(resp.json()) >= 2
        record("GET /projects/{id}/keys", ok, f"status={resp.status_code}")

        # 10. SDK verify --------------------------------------------------
        resp = await client.post(
            f"{API}/sdk/verify",
            json={"publishable_key": publishable_key},
            headers={"Origin": origin},
        )
        ok = resp.status_code == 200 and resp.json().get("valid") is True
        record("POST /sdk/verify (allowed origin)", ok, f"status={resp.status_code}")

        resp = await client.post(
            f"{API}/sdk/verify",
            json={"publishable_key": publishable_key},
            headers={"Origin": "https://evil.example.com"},
        )
        ok = resp.status_code == 403
        record("POST /sdk/verify (forbidden origin)", ok, f"status={resp.status_code}")

        # 11. Device-code flow --------------------------------------------
        resp = await client.post(
            f"{API}/device-auth/request", json={"client": "vscode_extension"}
        )
        ok = resp.status_code == 201
        record("POST /device-auth/request", ok, f"status={resp.status_code}")
        if not ok:
            print(resp.text)
            return 1
        device_code = resp.json()["device_code"]
        user_code = resp.json()["user_code"]

        resp = await client.post(
            f"{API}/device-auth/token", json={"device_code": device_code}
        )
        record(
            "POST /device-auth/token (pending)",
            resp.status_code == 200 and resp.json()["status"] == "pending",
            f"status={resp.status_code}",
        )

        resp = await client.post(
            f"{API}/device-auth/approve", headers=headers, json={"user_code": user_code}
        )
        record("POST /device-auth/approve", resp.status_code == 200, f"status={resp.status_code}")

        await asyncio.sleep(resp.json().get("interval", 5) if resp.status_code == 201 else 5)
        resp = await client.post(
            f"{API}/device-auth/token", json={"device_code": device_code}
        )
        ok = resp.status_code == 200 and resp.json().get("status") == "approved"
        record("POST /device-auth/token (exchange)", ok, f"status={resp.status_code}")
        if ok and resp.json().get("access_token"):
            device_access = resp.json()["access_token"]
            refresh = resp.json()["refresh_token"]
            resp = await client.get(
                f"{API}/auth/me", headers={"Authorization": f"Bearer {device_access}"}
            )
            ok = resp.status_code == 200
            record("GET /auth/me (device token)", ok, f"status={resp.status_code}")

        # 12. Logout ------------------------------------------------------
        resp = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
        record("POST /auth/refresh", resp.status_code == 200, f"status={resp.status_code}")
        if resp.status_code == 200:
            refresh = resp.json()["refresh_token"]

        resp = await client.post(f"{API}/auth/logout", json={"refresh_token": refresh})
        record("POST /auth/logout", resp.status_code == 204, f"status={resp.status_code}")

        # Revoked refresh must no longer work.
        resp = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
        record("POST /auth/refresh (revoked)", resp.status_code == 401, f"status={resp.status_code}")

    failed = [name for name, ok, _ in results if not ok]
    print("\n" + "=" * 60)
    print(f"Smoke test complete: {len(results) - len(failed)} passed, {len(failed)} failed")
    if failed:
        print("Failed steps: " + ", ".join(failed))
        return 1
    print("All Phase 1 flows verified successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
