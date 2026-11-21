"use strict";
/**
 * Automated Test Suite for GuideKit Special Phase 4.5:
 * 1. Method 1: Manual Hotkey Flow Builder & Selection Extractor (selectionExtractor.ts)
 * 2. Method 2: BYOK OpenCode CLI Harness & Guaranteed Unspawn (opencodeHarness.ts)
 * 3. End-to-End Sync & Publish Pipeline against Live Neon DB (GuideKitApiClient)
 *
 * Usage:
 *   cd vscode-extension && npm run compile && node dist/testPhase45.js
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const vm = __importStar(require("vm"));
const selectionExtractor_1 = require("./scanner/selectionExtractor");
const opencodeHarness_1 = require("./scanner/opencodeHarness");
const client_1 = require("./api/client");
const studioHtml_1 = require("./webview/studioHtml");
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ Assertion failed: ${message}`);
        process.exit(1);
    }
    console.log(`  ✓ ${message}`);
}
async function runPhase45Tests() {
    console.log("======================================================================");
    console.log("GuideKit Special Phase 4.5: Manual Hotkey Flow + OpenCode Harness Tests");
    console.log("======================================================================\n");
    // =========================================================================
    // TEST SUITE 1: METHOD 1 — CODE SELECTION & HOTKEY FLOW BUILDER
    // =========================================================================
    console.log("[Suite 1] Method 1: Smart Code Selection Parser & Hotkey Recorder");
    const sampleButtonSnippet = `
    <main>
      <button
        type="submit"
        data-testid="confirm-booking-btn"
        id="confirm-booking-btn"
        class="book-btn primary">
        Book Taxi Now
      </button>
    </main>
  `;
    // 1.1 Test tag selection expansion
    const btnOffset = sampleButtonSnippet.indexOf("Book Taxi Now");
    const extractedBtn = (0, selectionExtractor_1.expandTagSelection)(sampleButtonSnippet, btnOffset, btnOffset + 5);
    assert(extractedBtn !== null, "expandTagSelection successfully located button element");
    assert(extractedBtn.tag === "button", `Extracted tag is 'button' (got ${extractedBtn?.tag})`);
    assert(extractedBtn.innerText === "Book Taxi Now", `Extracted innerText is 'Book Taxi Now' (got ${extractedBtn?.innerText})`);
    assert(extractedBtn.attributes["id"] === "confirm-booking-btn", "Parsed id='confirm-booking-btn'");
    assert(extractedBtn.attributes["data-testid"] === "confirm-booking-btn", "Parsed data-testid");
    // 1.2 Test input selection
    const sampleInputSnippet = `
    <div class="field">
      <input id="pickup-location" type="text" placeholder="e.g. Connaught Place" class="loc-input" />
    </div>
  `;
    const inputOffset = sampleInputSnippet.indexOf("Connaught Place");
    const extractedInput = (0, selectionExtractor_1.expandTagSelection)(sampleInputSnippet, inputOffset, inputOffset + 5);
    assert(extractedInput !== null, "expandTagSelection located input element");
    assert(extractedInput.tag === "input", "Extracted tag is 'input'");
    assert(extractedInput.attributes["placeholder"] === "e.g. Connaught Place", "Parsed placeholder attribute");
    // 1.3 Test Step Construction
    const mockFilePath = "/workspace/sample-target-app/src/routes/book/+page.svelte";
    const step1 = (0, selectionExtractor_1.createStepFromTagInfo)(extractedBtn, mockFilePath, "book-taxi", 1);
    assert(step1.guide_id === "book-taxi-step-1", `Generated guide_id: ${step1.guide_id}`);
    assert(step1.action_type === "click", "Action type inferred as 'click' for button");
    assert(step1.advance_on === "click", "Advance on inferred as 'click' for button");
    assert(step1.route_pattern === "/book", `Route correctly inferred as '/book' from SvelteKit path (got ${step1.route_pattern})`);
    assert(!step1.route_needs_confirmation, "SvelteKit route is not ambiguous");
    const inputStep = (0, selectionExtractor_1.createStepFromTagInfo)(extractedInput, mockFilePath, "book-taxi", 2);
    assert(inputStep.action_type === "input", "Action type inferred as 'input' for <input>");
    assert(inputStep.advance_on === "input_valid", "Advance on inferred as 'input_valid' for <input>");
    // 1.4 Test Route Inference and Ambiguity Handling
    const appRouterPath = "src/app/(dashboard)/driver/dashboard/page.tsx";
    const appRoute = (0, selectionExtractor_1.inferRouteFromFilePath)(appRouterPath);
    assert(appRoute.route === "/driver/dashboard", `Next.js App router route resolved to '/driver/dashboard' (got ${appRoute.route})`);
    assert(!appRoute.isAmbiguous, "Next.js App route is unambiguous");
    const sharedComponentPath = "src/components/HeaderNav.tsx";
    const sharedRoute = (0, selectionExtractor_1.inferRouteFromFilePath)(sharedComponentPath);
    assert(sharedRoute.isAmbiguous, "Shared component path correctly flagged as ambiguous");
    // Manual route override test
    const overriddenStep = (0, selectionExtractor_1.createStepFromTagInfo)(extractedBtn, sharedComponentPath, "custom-flow", 1, "/custom/manual-route");
    assert(overriddenStep.route_pattern === "/custom/manual-route", "Manual route override cleanly honored");
    assert(!overriddenStep.route_needs_confirmation, "Overridden step has route_needs_confirmation=false");
    // 1.5 Test data-guide-id injection
    const openingTagWithoutGuideId = `<button id="test-btn" class="cta">`;
    const injectedTag = (0, selectionExtractor_1.injectGuideIdIntoOpeningTag)(openingTagWithoutGuideId, "flow-step-1");
    assert(injectedTag.includes('data-guide-id="flow-step-1"'), "Injected data-guide-id into opening tag");
    assert(injectedTag.endsWith(">"), "Injected tag ends cleanly with >");
    const selfClosingTag = `<input id="test-input" type="text" />`;
    const injectedSelfClosing = (0, selectionExtractor_1.injectGuideIdIntoOpeningTag)(selfClosingTag, "flow-step-2");
    assert(injectedSelfClosing.includes('data-guide-id="flow-step-2"'), "Injected data-guide-id into self-closing tag");
    assert(injectedSelfClosing.endsWith("/>"), "Self closing tag ends cleanly with />");
    // 1.6 Test TypeScript generic resilience
    const snippetWithGeneric = `
    const map = new Map<string, number>();
    return <button id="pay-btn">Pay Now</button>;
  `;
    const genericOffset = snippetWithGeneric.indexOf("Pay Now");
    const extractedWithGeneric = (0, selectionExtractor_1.expandTagSelection)(snippetWithGeneric, genericOffset, genericOffset + 5);
    assert(extractedWithGeneric !== null, "expandTagSelection succeeds despite preceding TypeScript generics");
    assert(extractedWithGeneric?.tag === "button", "Extracted tag is button despite generic");
    console.log("✓ Method 1 tests passed successfully!\n");
    const studioHtml = (0, studioHtml_1.getStudioHtml)("", "test-nonce");
    const studioScript = studioHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
    assert(Boolean(studioScript), "Studio webview includes its interaction script");
    new vm.Script(studioScript);
    assert(true, "Generated Studio webview script parses successfully");
    // Verify n8n-style Flow UI features in Studio HTML
    assert(studioHtml.includes("canvas-svg"), "Studio includes SVG connection canvas");
    assert(studioHtml.includes("btn-back-to-flow"), "Studio inspector includes Back to Flow button");
    assert(studioHtml.includes("btn-step-done"), "Studio modal includes Done button");
    assert(studioHtml.includes("step-pager"), "Studio inspector includes Step Pager navigation");
    assert(studioHtml.includes("btn-layout-toggle"), "Studio includes Horizontal/Vertical layout switcher");
    assert(studioHtml.includes("btn-zoom-fit"), "Studio includes Zoom to Fit control for 13-inch and large displays");
    assert(studioHtml.includes("flows-screen-container"), "Studio includes dedicated Flows management screen");
    assert(studioHtml.includes("btn-toolbar-add-step"), "Studio toolbar includes Add Step button");
    // Verify DESIGN.md Minimalism & Split Screen Prevention in Studio HTML
    assert(studioHtml.includes(".view:not(.active) { display: none !important; }"), "Guaranteed no inactive views display");
    assert(!studioHtml.includes(".agent {\n      min-height: 0;\n      width: 100%;\n      height: 100%;\n      display: grid !important;"), "Agent view does not force display:grid when inactive");
    assert(!studioHtml.includes("chat-avatar"), "No AI avatars or badge slop");
    assert(!studioHtml.includes("✨") && !studioHtml.includes("💳") && !studioHtml.includes("🔑") && !studioHtml.includes("⚙️") && !studioHtml.includes("⚲"), "No decorative emojis or icons");
    assert(studioHtml.includes("chat-input-box"), "Open Code includes modern unified input box");
    assert(studioHtml.includes("chat-send-btn"), "Open Code includes minimal primary send button");
    // =========================================================================
    // TEST SUITE 2: METHOD 2 — BYOK OPENCODE CLI HARNESS & UNSPAWN
    // =========================================================================
    console.log("[Suite 2] Method 2: BYOK OpenCode CLI Harness & Guaranteed Unspawn");
    const testConfig = {
        providerPreset: "openrouter",
        providerName: "customprovider",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "test_openrouter_api_key_12345",
        modelId: "deepseek/deepseek-chat-v3.1",
        binaryPath: "opencode",
    };
    // 2.1 Dynamic opencode.json Generation
    const configJson = (0, opencodeHarness_1.generateOpenCodeConfigJson)(testConfig);
    assert(configJson.model === "customprovider/deepseek/deepseek-chat-v3.1", `Config model uses the configured OpenRouter model`);
    assert(configJson.provider.customprovider.options.baseURL === "https://openrouter.ai/api/v1", "Provider baseURL matches OpenRouter");
    assert(configJson.provider.customprovider.options.apiKey === "test_openrouter_api_key_12345", "Provider apiKey matches");
    assert(configJson.tools.write === false && configJson.tools.bash === false, "Agent mutation tools are disabled");
    assert(configJson.permissions.some((rule) => rule.action === "edit" && rule.effect === "deny"), "V2 edit permission is denied");
    assert(configJson.permissions.some((rule) => rule.action === "external_directory" && rule.effect === "deny"), "External directory access is denied");
    // 2.2 JSON Block Extraction
    const sampleAgentOutput = `
    I am inspecting the codebase for the Ask for Money on the Go flow.
    Found route /driver/dashboard with button instant-payout-cta.
    Here is the synthesized GuideKit workflow:

    <<<GUIDEKIT_FLOW_JSON_START>>>
    {
      "slug": "ask-money-on-the-go",
      "content": {
        "en": {
          "title": "Ask for Money on the Go",
          "description": "Withdraw driver earnings on demand."
        }
      },
      "example_queries": ["How do I ask for money?"],
      "requires_auth": true,
      "required_role": "driver",
      "prerequisite_feature_slug": "login",
      "steps": [
        {
          "step_order": 1,
          "guide_id": "driver-payout-cta-step",
          "route_pattern": "/driver/dashboard",
          "action_type": "click",
          "advance_on": "click",
          "content": {
            "en": {
              "title": "Instant Cash Out",
              "description": "Click to withdraw funds."
            }
          },
          "target_fingerprint": {
            "tag": "button",
            "css": "button#instant-payout-cta",
            "attrs": { "id": "instant-payout-cta" }
          }
        }
      ]
    }
    <<<GUIDEKIT_FLOW_JSON_END>>>

    Finished flow synthesis.
  `;
    const extractedFlow = (0, opencodeHarness_1.extractFlowJsonFromOutput)(sampleAgentOutput);
    assert(extractedFlow !== null, "extractFlowJsonFromOutput extracted flow from delimiters");
    assert(extractedFlow.slug === "ask-money-on-the-go", "Extracted flow slug matches");
    assert(extractedFlow.requires_auth === true, "requires_auth is true");
    assert(extractedFlow.required_role === "driver", "required_role is 'driver'");
    assert(extractedFlow.prerequisite_feature_slug === "login", "prerequisite_feature_slug is 'login'");
    assert(extractedFlow.steps.length === 1, "Extracted 1 step");
    assert(extractedFlow.steps[0].guide_id === "driver-payout-cta-step", "Step guide_id matches");
    // 2.3 Spawn Mock Agent & Verify Guaranteed Process Unspawn
    console.log("  Testing OpenCodeProcessManager lifecycle & guaranteed unspawn...");
    const mockScriptPath = path.join(__dirname, "mock-opencode.js");
    const mockScriptContent = `#!/usr/bin/env node
console.log(JSON.stringify({ type: "tool_call", tool: "glob", args: { pattern: "**/*.svelte" } }));
console.log(JSON.stringify({ type: "reasoning", thinking: "Analyzing interactive elements in routes/driver" }));
setTimeout(() => {
  console.log('<<<GUIDEKIT_FLOW_JSON_START>>>');
  console.log(JSON.stringify(${JSON.stringify(extractedFlow)}));
  console.log('<<<GUIDEKIT_FLOW_JSON_END>>>');
}, 150);
`;
    fs.writeFileSync(mockScriptPath, mockScriptContent, { mode: 0o755 });
    const manager = opencodeHarness_1.OpenCodeProcessManager.getInstance();
    let receivedFlow = null;
    let receivedLogs = [];
    let statusChanges = [];
    const mockConfig = {
        ...testConfig,
        binaryPath: mockScriptPath,
    };
    const mockWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "guidekit-opencode-test-"));
    try {
        receivedFlow = await manager.spawnAgent(mockWorkspace, "Detect Ask for Money", mockConfig, {
            onStatusChange: (status) => statusChanges.push(status),
            onLog: (line) => receivedLogs.push(line),
            onFlowDetected: (flow) => {
                receivedFlow = flow;
            },
        });
    }
    finally {
        assert(!fs.existsSync(path.join(mockWorkspace, "opencode.json")), "Agent never writes opencode.json into the workspace");
        fs.rmdirSync(mockWorkspace);
        if (fs.existsSync(mockScriptPath)) {
            try {
                fs.unlinkSync(mockScriptPath);
            }
            catch { }
        }
    }
    assert(receivedFlow !== null, "Process manager received flow from agent stream");
    assert(receivedFlow.slug === "ask-money-on-the-go", "Received flow slug matches mock");
    assert(!manager.isRunning(), "Process manager marked isRunning = false after completion");
    assert(statusChanges.includes("running"), "Status transitioned through 'running'");
    assert(statusChanges.includes("unspawned"), "Status transitioned to 'unspawned' (Guaranteed Unspawn verified)");
    console.log("✓ Method 2 tests passed successfully!\n");
    // =========================================================================
    // TEST SUITE 3: END-TO-END SYNC & PUBLISH AGAINST BACKEND API / LIVE DB
    // =========================================================================
    console.log("[Suite 3] End-to-End Workflow Sync & Manifest Publish Pipeline");
    const apiUrl = process.env.GUIDEKIT_API_URL || "http://127.0.0.1:8000/api/v1";
    const client = new client_1.GuideKitApiClient(apiUrl);
    console.log(`  Connecting to GuideKit API at ${apiUrl}...`);
    const liveToken = process.env.GUIDEKIT_TOKEN;
    if (!liveToken) {
        console.log("  - Skipped live API suite (set GUIDEKIT_TOKEN to enable it).\n");
        console.log("======================================================================");
        console.log("ALL LOCAL GUIDEKIT EXTENSION TESTS PASSED");
        console.log("======================================================================");
        return;
    }
    try {
        // Authenticate with an explicitly supplied CI token. Interactive runs use
        // the CLI/device flow instead of embedding demo credentials.
        const token = liveToken;
        // List projects
        const projects = await client.listProjects(token);
        assert(projects.length > 0, `Found ${projects.length} project(s)`);
        const project = projects.find((p) => p.slug === "taxi-sanchalak") || projects[0];
        console.log(`  Target Project: '${project.name}' (${project.id})`);
        // Prepare Combined Payload (Method 1 Manual Flow + Method 2 OpenCode Flow)
        const combinedPayload = {
            features: [
                {
                    slug: "book-taxi-manual-flow",
                    content: {
                        en: {
                            title: "Book a Taxi (Manual Hotkey Flow)",
                            description: "Interactive tour authored with Cmd+Shift+G selection recorder.",
                        },
                    },
                    example_queries: ["How do I book a taxi manually?", "Book cab tour"],
                    requires_auth: false,
                    required_role: null,
                    steps: [
                        {
                            step_order: 1,
                            guide_id: "book-pickup-step",
                            route_pattern: "/book",
                            action_type: "input",
                            advance_on: "input_valid",
                            content: {
                                en: {
                                    title: "Enter Pickup Location",
                                    description: "Specify where you want to be picked up.",
                                },
                            },
                            target_fingerprint: {
                                tag: "input",
                                css: "input#pickup-location",
                                guide_id: "book-pickup-step",
                                attrs: { id: "pickup-location" },
                            },
                        },
                        {
                            step_order: 2,
                            guide_id: "book-confirm-step",
                            route_pattern: "/book",
                            action_type: "click",
                            advance_on: "click",
                            content: {
                                en: {
                                    title: "Confirm Booking",
                                    description: "Click to book your ride.",
                                },
                            },
                            target_fingerprint: {
                                tag: "button",
                                css: "button#confirm-booking-btn",
                                guide_id: "book-confirm-step",
                                attrs: { id: "confirm-booking-btn" },
                            },
                        },
                    ],
                },
                {
                    slug: "driver-payout-opencode-flow",
                    content: {
                        en: {
                            title: "Driver Instant Payout (OpenCode Agent)",
                            description: "Workflow synthesized by OpenCode Mercury 2.5 agent.",
                        },
                    },
                    example_queries: ["How do I cash out driver earnings?", "Instant payout guide"],
                    requires_auth: true,
                    required_role: "driver",
                    prerequisite_feature_slug: "login",
                    steps: [
                        {
                            step_order: 1,
                            guide_id: "driver-payout-step-1",
                            route_pattern: "/driver/dashboard",
                            action_type: "click",
                            advance_on: "click",
                            content: {
                                en: {
                                    title: "Click Instant Payout",
                                    description: "Open the payout modal.",
                                },
                            },
                            target_fingerprint: {
                                tag: "button",
                                css: "button#instant-payout-cta",
                                guide_id: "driver-payout-step-1",
                                attrs: { id: "instant-payout-cta" },
                            },
                        },
                    ],
                },
            ],
        };
        console.log("  Syncing Method 1 + Method 2 workflows to backend...");
        const syncResp = await client.syncWorkflows(token, project.id, combinedPayload);
        assert(syncResp.synced_features >= 2, `Synced features count: ${syncResp.synced_features} (>= 2)`);
        assert(syncResp.draft_versions.length >= 2, `Draft versions created/updated: ${syncResp.draft_versions.length}`);
        assert(syncResp.draft_versions.some((d) => d.slug === "book-taxi-manual-flow"), "Synced features include 'book-taxi-manual-flow'");
        assert(syncResp.draft_versions.some((d) => d.slug === "driver-payout-opencode-flow"), "Synced features include 'driver-payout-opencode-flow'");
        console.log("  Publishing Manifest to CDN...");
        const pubResp = await client.publishManifest(token, project.id);
        const manifestId = pubResp.manifest_id || pubResp.id;
        const versionNum = pubResp.version_number || pubResp.manifest_version;
        const featureCount = pubResp.published_features || pubResp.feature_count;
        assert(manifestId !== undefined, `Manifest published with ID: ${manifestId}`);
        assert(versionNum >= 1, `Manifest version number: v${versionNum}`);
        assert(Boolean(pubResp.etag), `Manifest ETag generated: ${pubResp.etag}`);
        assert(featureCount >= 2, `Manifest includes ${featureCount} features`);
        console.log("✓ Live DB Sync & Manifest Publish verified successfully!\n");
    }
    catch (err) {
        console.error(`❌ Live DB sync test failed: ${err.message}`);
        process.exit(1);
    }
    console.log("======================================================================");
    console.log("ALL PHASE 4.5 TESTS PASSED PERFECTLY!");
    console.log("======================================================================");
}
runPhase45Tests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
//# sourceMappingURL=testPhase45.js.map