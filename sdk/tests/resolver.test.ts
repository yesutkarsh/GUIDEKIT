/**
 * Automated Unit Tests for GuideKit 4-Tier DOM Resolver Ladder, Candidate Pruner, and Auth Detector
 */

import { JSDOM } from "jsdom";
import {
  resolveTier1Primary,
  resolveTier2Fingerprint,
  resolveStepElement,
} from "../src/resolver/domResolver";
import {
  pruneInteractiveCandidates,
  computeDomHash,
  generateElementSelector,
} from "../src/resolver/candidatePruner";
import { detectAuthState, getCurrentPagePath } from "../src/state/authDetector";
import { StitchedWorkflowStep } from "../src/types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log("======================================================================");
  console.log("GuideKit Universal Web SDK: 4-Tier Resolver & Auth Detector Tests");
  console.log("======================================================================\n");

  // Setup virtual DOM environment with JSDOM
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html lang="en">
    <body data-guidekit-route="/driver/dashboard">
      <nav class="navbar">
        <a href="/" class="nav-brand">Taxi Sanchalak</a>
        <div id="user-profile" data-user-role="driver">Driver Console</div>
      </nav>

      <main class="dashboard-main">
        <!-- Tier 1 Healthy Element with data-guide-id -->
        <button
          id="btn-healthy"
          data-guide-id="driver-payout-step-1"
          data-testid="instant-payout-cta"
          class="btn-primary"
        >
          Withdraw Instant Cash
        </button>

        <!-- Tier 2 Target (No data-guide-id or data-testid) -->
        <button id="btn-stripped" class="btn-regular">
          Confirm Driver Payout
        </button>

        <!-- Other interactive elements -->
        <input id="payout-amount" type="number" placeholder="Enter amount" />
        <a href="/driver/history" class="history-link">View Past Earnings</a>
      </main>
    </body>
    </html>
  `, { url: "http://localhost:3000/driver/dashboard" });

  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).localStorage = dom.window.localStorage;
  (global as any).sessionStorage = dom.window.sessionStorage;

  // Mock getBoundingClientRect on HTMLElements in JSDOM
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: 120,
      height: 40,
      top: 100,
      left: 100,
      bottom: 140,
      right: 220,
      x: 100,
      y: 100,
      toJSON: () => {},
    };
  };

  // -------------------------------------------------------------------------
  // TEST 1: TIER 1 — PRIMARY LOCATOR (~0ms)
  // -------------------------------------------------------------------------
  console.log("[Test 1] Tier 1: Primary Locator (data-guide-id & data-testid)");

  const stepTier1: StitchedWorkflowStep = {
    execution_index: 1,
    step_id: "step-uuid-1",
    feature_slug: "ask-money-on-the-go",
    step_order: 1,
    guide_id: "driver-payout-step-1",
    route_pattern: "/driver/dashboard",
    action_type: "click",
    advance_on: "click",
    is_optional: false,
    wait_timeout_ms: 5000,
    content: { en: { title: "Instant Payout", description: "Click to cash out" } },
    target_fingerprint: {
      tag: "button",
      guide_id: "driver-payout-step-1",
      attrs: { "data-testid": "instant-payout-cta", id: "btn-healthy" },
    },
  };

  const t1Found = resolveTier1Primary(stepTier1);
  assert(t1Found !== null, "Tier 1 found target element by data-guide-id");
  assert(t1Found?.id === "btn-healthy", `Tier 1 resolved element id='btn-healthy' (got: ${t1Found?.id})`);

  // Test primary locator fallback by data-testid when guide_id is not set
  const stepTier1TestId: StitchedWorkflowStep = {
    ...stepTier1,
    guide_id: undefined,
    target_fingerprint: {
      tag: "button",
      attrs: { "data-testid": "instant-payout-cta" },
    },
  };
  const t1TestIdFound = resolveTier1Primary(stepTier1TestId);
  assert(t1TestIdFound !== null, "Tier 1 found target element by data-testid");

  console.log("✓ Tier 1 Primary Locator tests passed!\n");

  // -------------------------------------------------------------------------
  // TEST 2: TIER 2 — LOCAL CLIENT FINGERPRINT SCORING (~1ms, Zero AI)
  // -------------------------------------------------------------------------
  console.log("[Test 2] Tier 2: Client Fingerprint Scoring (Stripped IDs)");

  // Target btn-stripped has NO data-guide-id and NO data-testid, but has text 'Confirm Driver Payout'
  const stepTier2: StitchedWorkflowStep = {
    execution_index: 2,
    step_id: "step-uuid-2",
    feature_slug: "ask-money-on-the-go",
    step_order: 2,
    guide_id: "missing-guide-id",
    route_pattern: "/driver/dashboard",
    action_type: "click",
    advance_on: "click",
    is_optional: false,
    wait_timeout_ms: 5000,
    content: { en: { title: "Confirm Payout", description: "Confirm transfer" } },
    target_fingerprint: {
      tag: "button",
      role: "button",
      text: "Confirm Driver Payout",
      attrs: { "data-testid": "non-existent-testid" },
    },
  };

  // Tier 1 must fail on this element
  const t1ShouldFail = resolveTier1Primary(stepTier2);
  assert(t1ShouldFail === null, "Tier 1 correctly fails when primary locators are stripped");

  // Tier 2 should resolve it via text and tag/role heuristics
  const t2Result = resolveTier2Fingerprint(stepTier2);
  assert(t2Result.element !== null, `Tier 2 Fingerprint successfully scored and resolved element (score: ${t2Result.score.toFixed(2)})`);
  assert(t2Result.element?.id === "btn-stripped", `Tier 2 resolved element id='btn-stripped' (got: ${t2Result.element?.id})`);
  assert(t2Result.score >= 0.70, `Score exceeds confidence threshold (got: ${t2Result.score})`);

  console.log("✓ Tier 2 Fingerprint tests passed!\n");

  // -------------------------------------------------------------------------
  // TEST 3: CANDIDATE PRUNER & DETERMINISTIC DOM HASHING
  // -------------------------------------------------------------------------
  console.log("[Test 3] Candidate Pruner & Deterministic DOM Hashing");

  const candidates = pruneInteractiveCandidates(20);
  assert(candidates.length >= 3, `Pruned ${candidates.length} visible interactive candidates`);
  assert(candidates.some((c) => c.tag === "button" && c.attrs.id === "btn-healthy"), "Candidate list contains healthy button");
  assert(candidates.some((c) => c.tag === "input"), "Candidate list contains input field");

  const hash1 = await computeDomHash(candidates);
  const hash2 = await computeDomHash(candidates);
  assert(Boolean(hash1), `Generated DOM hash: ${hash1}`);
  assert(hash1 === hash2, "DOM hash is deterministic across calls");

  console.log("✓ Candidate Pruner & DOM Hashing tests passed!\n");

  // -------------------------------------------------------------------------
  // TEST 4: TIER 3 & TIER 4 DOM RESOLVER LADDER
  // -------------------------------------------------------------------------
  console.log("[Test 4] Full 4-Tier Ladder (Mocked Cloud Heal & Graceful Text Fallback)");

  // Mock API client and telemetry
  const mockApiClient: any = {
    heal: async (params: any) => {
      // Simulate AI returning healed selector for a mutated element
      if (params.stepId === "step-healed") {
        return {
          status: "healed_by_ai",
          step_id: params.stepId,
          suggested_selector: "#btn-stripped",
          confidence: 0.88,
        };
      }
      return {
        status: "fallback_to_text",
        step_id: params.stepId,
        confidence: 0.0,
        fallback_text: "Please click the payout button manually.",
      };
    },
  };

  const mockTelemetry: any = {
    trackResolution: (log: any) => {
      console.log(`    [telemetry] resolution logged: status=${log.status}, ms=${log.resolution_ms}`);
    },
  };

  // Test Tier 3 Healed by AI
  const stepTier3: StitchedWorkflowStep = {
    ...stepTier1,
    step_id: "step-healed",
    guide_id: "mutated-guide-id",
    target_fingerprint: {
      tag: "button",
      attrs: { "data-testid": "non-existent-testid" },
    },
  };

  const resolvedT3 = await resolveStepElement(stepTier3, mockApiClient, mockTelemetry);
  assert(resolvedT3.status === "healed_by_ai", `Resolver returned status 'healed_by_ai' (got: ${resolvedT3.status})`);
  assert(resolvedT3.element !== null, "Resolver returned live element from suggested selector");

  // Test Tier 4 Graceful Text Fallback
  const stepTier4: StitchedWorkflowStep = {
    ...stepTier1,
    step_id: "step-completely-deleted",
    guide_id: "deleted-guide-id",
    target_fingerprint: {
      tag: "button",
      attrs: { "data-testid": "deleted-testid" },
    },
    content: {
      en: {
        title: "Deleted Step Guidance",
        description: "This element was deleted but GuideKit gives clear instructions.",
      },
    },
  };

  const resolvedT4 = await resolveStepElement(stepTier4, mockApiClient, mockTelemetry);
  assert(resolvedT4.status === "fallback_to_text", `Resolver returned status 'fallback_to_text' (got: ${resolvedT4.status})`);
  assert(resolvedT4.element === null, "Resolver returned null element for deleted element");
  assert(Boolean(resolvedT4.fallbackText), "Resolver provided localized fallbackText");

  console.log("✓ 4-Tier Ladder tests passed!\n");

  // -------------------------------------------------------------------------
  // TEST 5: BROWSER AUTH DETECTOR & ROUTE DETECTION
  // -------------------------------------------------------------------------
  console.log("[Test 5] Browser Auth & Route Detection");

  const path = getCurrentPagePath();
  assert(path === "/driver/dashboard", `Detected route path: ${path} (from data-guidekit-route)`);

  // 1. Initial State: Logged out
  localStorage.clear();
  const authLoggedOut = detectAuthState();
  assert(!authLoggedOut.is_logged_in, "User initially detected as logged out");
  assert(authLoggedOut.role === null, "Role is null when logged out");

  // 2. Set token in localStorage -> logged in
  localStorage.setItem("driver_token", "driver_jwt_sample_token");
  localStorage.setItem("role", "driver");

  const authDriver = detectAuthState({
    signed_in: { type: "localStorage", key: "driver_token" },
    role_source: { type: "localStorage", key: "role" },
  });
  assert(authDriver.is_logged_in, "User detected as logged in via localStorage config");
  assert(authDriver.role === "driver", `Detected role is 'driver' (got: ${authDriver.role})`);

  // 3. Test DOM-based role detection
  const authDom = detectAuthState({
    signed_in: { type: "dom", selector: "#user-profile" },
    role_source: { type: "dom", selector: "#user-profile", attribute: "data-user-role" },
  });
  assert(authDom.is_logged_in, "User detected as logged in via DOM selector rule");
  assert(authDom.role === "driver", "Role extracted from DOM attribute 'data-user-role'");

  console.log("✓ Auth Detector tests passed!\n");

  console.log("======================================================================");
  console.log("ALL SDK UNIT TESTS PASSED PERFECTLY!");
  console.log("======================================================================");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

