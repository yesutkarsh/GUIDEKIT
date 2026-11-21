# 🚀 GuideKit — Quick Start & Testing Guide

This guide contains all commands to start the backend, frontend, and extension, along with all URLs to test and instructions to reload VS Code.

Installing GuideKit in your own website? Follow the [SDK setup guide](sdk/README.md) for project creation, publishable keys, origins, auth detection, and copy-paste installation examples.

---

## ⚡ 1. Start the Servers

Open **two terminal windows or tabs**:

### Terminal 1 — Start the Backend (FastAPI + Neon PostgreSQL + Mercury 3 LLM)
```bash
cd "/Users/apple/Desktop/project bot/backend"
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
> **Backend runs at:** `http://127.0.0.1:8000`  
> Automatically connected to your live **Neon PostgreSQL** database and **Inception Labs Mercury 3 LLM**.

---

### Terminal 2 — Start the Frontend (Next.js 15 + Clerk Auth)
```bash
cd "/Users/apple/Desktop/project bot/frontend"
npm run dev
```
> **Frontend runs at:** `http://localhost:3000`  
> Configured with Clerk authentication ("Continue with Google") and the interactive Taxi Sanchalak demo.

Development uses `.next-dev`; production builds use `.next`, so building cannot overwrite the JavaScript used by an open dev session. If a page remains frozen and its JavaScript returns 404, restart `npm run dev` once and reload the page.

---

## 🛠️ 2. Build & Reload the VS Code Extension

Your extension is already symlinked directly into your editor extensions directory (`~/.vscode/extensions/guidekit-vscode` and `~/.cursor/extensions/guidekit-vscode`).

### Step A: Recompile the Extension Code
Whenever you make changes to extension files:
```bash
cd "/Users/apple/Desktop/project bot/vscode-extension"
npm run compile
```
*(Tip: Or run `npm run watch` to automatically recompile in the background whenever you save a file).*

### Step B: How to Reload Window in VS Code / Cursor
To instantly activate the latest compiled extension code:
1. In your VS Code or Cursor editor, press:
   - **Mac:** `Cmd + Shift + P`
   - **Windows/Linux:** `Ctrl + Shift + P`
2. Type: **`Developer: Reload Window`** and press **Enter**.
3. The editor will flash briefly and reload.
4. Click the **GuideKit ("G") icon** on the left Activity Bar — you now have the latest version running!

---

## 🌐 3. Important URLs to Visit & Test

| Destination | URL | What to Test Here |
| :--- | :--- | :--- |
| 🚕 **Customer Demo (Taxi Sanchalak)** | [`http://localhost:3000/demo/taxi-sanchalak`](http://localhost:3000/demo/taxi-sanchalak) | **Interactive App & Spotlight Tours.** Test floating GuideBot chat widget, `/book` and `/driver/dashboard` routes, and test the 4 Chaos Modes (Tier 1 Healthy, Tier 2 Stripped, Tier 3 AI Mutated Heal, Tier 4 Text Fallback). |
| 📊 **Developer Web Console** | [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard) | View published workflows, project analytics, and registered client origins. |
| 📚 **Knowledge Base & RAG Ingestion** | [`http://localhost:3000/dashboard/knowledge`](http://localhost:3000/dashboard/knowledge) | Ingest PDFs, markdown docs, and FAQs for instant Mercury 3 retrieval. |
| 🩺 **Self-Healing Inbox** | [`http://localhost:3000/dashboard/healing`](http://localhost:3000/dashboard/healing) | Inspect and 1-click approve DOM selector changes detected by the AI self-healer. |
| 🔐 **Sign In with Google** | [`http://localhost:3000/login`](http://localhost:3000/login) | The only account sign-in path. New users are sent to workspace setup. |
| 🔌 **Connect VS Code** | [`http://localhost:3000/device`](http://localhost:3000/device) | Confirm the prefilled device code opened by the extension. No tokens are passed through browser URLs. |
| 🏢 **Workspace Setup** | [`http://localhost:3000/onboarding`](http://localhost:3000/onboarding) | Required one-time workspace naming for new Google accounts. |
| 📖 **FastAPI Swagger API Docs** | [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs) | Interactive OpenAPI documentation for all 31+ REST endpoints. |
| ❤️ **Backend Healthcheck** | [`http://127.0.0.1:8000/api/v1/health`](http://127.0.0.1:8000/api/v1/health) | Verifies database connectivity and API status. |

---

## 🧪 4. Complete End-to-End Testing Walkthrough

Follow these steps to see the entire IDE-to-DOM-to-AI loop in action:

### Step 1: Sign In from VS Code
1. Open the **GuideKit ("G")** sidebar tab in VS Code.
2. In the **Developer Account** card:
   - Click **"Continue with Google"**.
   - The browser opens with a prefilled device code. Sign in with Google if needed.
   - New accounts name their workspace, then return to the confirmation screen.
   - Confirm the displayed account and code. The browser will try to focus VS Code again.
3. The sidebar changes to the authenticated account. If there are no projects yet, use **Create a project in the dashboard**.

The website and extension keep separate sessions. Signing into the website alone does not launch or connect VS Code, and signing out of one client does not sign out the other.

The code in `/device?code=...` links the browser approval to the requesting editor. It is prefilled automatically; Google is the only account authentication method, and no manual code entry is needed when starting from VS Code.

### Step 2: Capture a Step from Source Code
1. Open [`vscode-extension/sample-target-app/src/routes/book/+page.svelte`](file:///Users/apple/Desktop/project%20bot/vscode-extension/sample-target-app/src/routes/book/+page.svelte).
2. Highlight an element in the file, for example:
   ```svelte
   <option value="suv">SUV XL (6 seats)</option>
   ```
3. Press **`Cmd + Shift + G`** (or right-click and select **"GuideKit: Add Selected Code as Workflow Step"**).
4. The step will appear in your GuideKit sidebar under **CAPTURED STEPS**.

### Step 3: Save & Publish Workflow
1. In the sidebar:
   - Uncheck *"Requires Authentication"* (if you want the tour to run without forcing a login first).
   - Click **"💾 Save Flow to Workspace Drafts"**.
   - Notice it is added to **STAGED WORKFLOWS**.
2. Click **"🚀 Sync Workflows & Publish Manifest to CDN"**.
3. A notification will confirm: *Workflows synced and published!*

### Step 4: Test in the Browser Customer Demo
1. Open [`http://localhost:3000/demo/taxi-sanchalak`](http://localhost:3000/demo/taxi-sanchalak) in Google Chrome.
2. Click the floating **GuideBot** widget in the bottom-right corner.
3. **Test Procedural Tour (Workflow Trigger):**
   - Type: `"How do I book a taxi?"`
   - GuideBot starts the interactive tour and Driver.js highlights the booking step on your screen!
4. **Test RAG Policy Q&A (Mercury 3 LLM):**
   - Type: `"What is the cancellation policy for taxi bookings?"`
   - GuideKit searches the pgvector knowledge base and Inception Labs **Mercury 3** instantly answers with the 5-minute free cancellation rule and an action button to start the tour.
5. **Test Tier 3 AI Self-Healing:**
   - In the top bar of the demo page, switch from **Mode 1** to **Mode 3 (Mutated DOM)**.
   - Run the Driver Instant Payout tour.
   - Notice the amber badge `Tier 3 · ⚡ Auto-Healed` appear — GuideKit healed the mutated selector live via AI!

---

## 🛠️ Helpful Commands

| Action | Command |
| :--- | :--- |
| **Run Phase 6 Smoke Test** | `cd backend && .venv/bin/python -m scripts.smoke_test_phase6` |
| **Run Backend Test Suite** | `cd backend && .venv/bin/pytest -v` |
| **Re-seed Demo Data** | `cd backend && .venv/bin/python -m scripts.seed_demo_project` |
| **Build Frontend Production** | `cd frontend && npm run build` |
| **Test Frontend Auth States** | `cd frontend && npm test` |
| **Test Device → Google in Chrome** | With the frontend running and Google Chrome installed: `cd frontend && npm run test:browser` |
| **Build Extension** | `cd vscode-extension && npm run compile` |
| **Build Web SDK Bundle** | `cd sdk && npm run build` |

