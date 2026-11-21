#!/usr/bin/env node
"use strict";
/**
 * GuideKit Headless CLI Runner
 * Can be run standalone or invoked in CI/smoke tests:
 * node dist/cli.js --help
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
const routeScanner_1 = require("./scanner/routeScanner");
const elementExtractor_1 = require("./scanner/elementExtractor");
const flowBuilder_1 = require("./scanner/flowBuilder");
const codemodInjector_1 = require("./scanner/codemodInjector");
const client_1 = require("./api/client");
function parseArgs(args) {
    const options = {
        command: args[0] || "scan",
        dir: path.resolve(process.cwd(), "sample-target-app"),
        apiUrl: process.env.GUIDEKIT_API_URL || "http://127.0.0.1:8000/api/v1",
        token: process.env.GUIDEKIT_TOKEN,
        projectId: process.env.GUIDEKIT_PROJECT_ID,
        projectSlug: process.env.GUIDEKIT_PROJECT_SLUG || "taxi-sanchalak",
        publishableKey: process.env.GUIDEKIT_PUBLISHABLE_KEY,
    };
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--dir" && i + 1 < args.length) {
            options.dir = path.resolve(process.cwd(), args[++i]);
        }
        else if (arg === "--api-url" && i + 1 < args.length) {
            options.apiUrl = args[++i];
        }
        else if (arg === "--token" && i + 1 < args.length) {
            options.token = args[++i];
        }
        else if (arg === "--project-id" && i + 1 < args.length) {
            options.projectId = args[++i];
        }
        else if (arg === "--project-slug" && i + 1 < args.length) {
            options.projectSlug = args[++i];
        }
        else if (arg === "--key" && i + 1 < args.length) {
            options.publishableKey = args[++i];
        }
    }
    return options;
}
async function run() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log(`
GuideKit Headless CLI Runner
============================
Usage:
  node dist/cli.js <command> [options]

Commands:
  scan                 Scan target directory for routes and interactive elements
  codemod              Inject data-guide-id attributes into component templates
  sync                 Scan and sync workflows & knowledge to backend
  publish              Scan, sync, and publish CDN manifest
  full-pipeline        Run scan -> codemod -> sync -> publish -> verify

Options:
  --dir <path>         Target app directory (default: ./sample-target-app)
  --api-url <url>      GuideKit API base URL (default: http://127.0.0.1:8000/api/v1)
  --token <jwt>        Direct JWT bearer token for CI; otherwise browser device login is used
  --project-id <uuid>  Target project UUID
  --project-slug <slug> Target project slug (default: taxi-sanchalak)
  --key <pubkey>       Publishable key for SDK verification
`);
        process.exit(0);
    }
    const opts = parseArgs(args);
    const client = new client_1.GuideKitApiClient(opts.apiUrl);
    console.log(`[GuideKit CLI] Command: ${opts.command}`);
    console.log(`[GuideKit CLI] Target Directory: ${opts.dir}`);
    console.log(`[GuideKit CLI] API Base: ${opts.apiUrl}`);
    if (!fs.existsSync(opts.dir)) {
        console.error(`Error: Target directory does not exist: ${opts.dir}`);
        process.exit(1);
    }
    // Step 1: Scan
    console.log(`\n🔍 Scanning routes in ${opts.dir}...`);
    const routes = await (0, routeScanner_1.scanRoutes)(opts.dir);
    console.log(`✓ Found ${routes.length} routes:`);
    for (const r of routes) {
        const elems = (0, elementExtractor_1.extractElements)(r.filePath);
        console.log(`  - [${r.frameworkHint}] ${r.routePattern} (${elems.length} elements, requiresAuth: ${r.requiresAuth}${r.requiredRole ? `, role: ${r.requiredRole}` : ""})`);
    }
    const buildResult = (0, flowBuilder_1.buildFlowsFromCodebase)(routes);
    const workflows = buildResult.workflowsPayload;
    const knowledge = buildResult.knowledgePayload;
    console.log(`✓ Built ${workflows.features.length} interactive flows:`);
    for (const f of workflows.features) {
        console.log(`  - ${f.slug}: ${f.steps.length} steps (requiresAuth: ${f.requires_auth})`);
    }
    if (opts.command === "scan") {
        console.log("\n[Scan Output JSON Preview]:");
        console.log(JSON.stringify(workflows, null, 2));
        process.exit(0);
    }
    // Step 2: Codemod (if requested)
    const allSteps = workflows.features.flatMap((f) => f.steps);
    if (opts.command === "codemod" || opts.command === "full-pipeline") {
        console.log(`\n🛠️  Injecting data-guide-id attributes into markup...`);
        const results = (0, codemodInjector_1.injectGuideIdsAcrossWorkspace)(routes, allSteps);
        const modifiedCount = results.filter((r) => r.modified).length;
        const totalInjected = results.reduce((acc, r) => acc + r.injectedCount, 0);
        console.log(`✓ Injected ${totalInjected} data-guide-id attributes across ${modifiedCount} files.`);
        if (opts.command === "codemod")
            process.exit(0);
    }
    // Step 3: Authenticate
    let token = opts.token;
    if (!token) {
        console.log(`\n🔐 Starting Google device authorization...`);
        try {
            const request = await client.requestDeviceCode("cli");
            console.log(`Open ${request.verification_uri_complete || request.verification_uri}`);
            console.log(`Confirm code: ${request.user_code}`);
            const loginResp = await client.waitForDeviceToken(request.device_code, request.interval, request.expires_in);
            token = loginResp.access_token;
            console.log(`✓ Authenticated successfully.`);
        }
        catch (e) {
            console.error(`Authentication failed: ${e.message}`);
            process.exit(1);
        }
    }
    // Step 4: Resolve Project ID
    let projectId = opts.projectId;
    let publishableKey = opts.publishableKey;
    if (!projectId) {
        console.log(`\n📂 Resolving project '${opts.projectSlug}'...`);
        const projects = await client.listProjects(token);
        const targetProject = projects.find((p) => p.slug === opts.projectSlug || p.id === opts.projectId) || projects[0];
        if (!targetProject) {
            console.error(`Error: No project found matching slug '${opts.projectSlug}'`);
            process.exit(1);
        }
        projectId = targetProject.id;
        publishableKey = targetProject.publishable_key;
        console.log(`✓ Resolved project: "${targetProject.name}" (${projectId})`);
    }
    // Step 5: Sync Workflows & Knowledge
    console.log(`\n🚀 Syncing workflows to backend...`);
    const wfResult = await client.syncWorkflows(token, projectId, workflows);
    console.log(`✓ Synced ${wfResult.synced_features} features (${wfResult.draft_versions.length} draft versions created/updated).`);
    console.log(`\n📚 Syncing knowledge sources & chunks...`);
    const knResult = await client.syncKnowledge(token, projectId, knowledge);
    console.log(`✓ Synced ${knResult.synced_sources} sources (${knResult.indexed_chunks} chunks indexed, ${knResult.skipped_sources} skipped).`);
    if (opts.command === "sync") {
        console.log("\n✓ Sync completed successfully.");
        process.exit(0);
    }
    // Step 6: Publish Manifest
    console.log(`\n📦 Publishing CDN manifest...`);
    const pubResult = await client.publishManifest(token, projectId);
    console.log(`🎉 Published Manifest v${pubResult.version_number}!`);
    console.log(`  - Manifest ID: ${pubResult.manifest_id}`);
    console.log(`  - ETag: ${pubResult.etag}`);
    console.log(`  - Features: ${pubResult.published_features} (${pubResult.feature_slugs.join(", ")})`);
    console.log(`  - Manifest URL: ${pubResult.manifest_url}`);
    // Step 7: Verify via Public SDK Manifest Endpoint
    if (publishableKey) {
        console.log(`\n🌐 Verifying public SDK delivery (GET /sdk/manifest)...`);
        const sdkResp = await client.getSdkManifest(publishableKey, "https://taxisanchalak.com");
        console.log(`✓ SDK Endpoint 200 OK — ETag: ${sdkResp.etag}`);
        // Verify 304 Not Modified
        const cacheResp = await client.getSdkManifest(publishableKey, "https://taxisanchalak.com", sdkResp.etag);
        if (cacheResp.status === 304) {
            console.log(`✓ SDK Endpoint 304 Not Modified caching verified!`);
        }
        else {
            console.warn(`Warning: Expected 304 with ETag match, got ${cacheResp.status}`);
        }
    }
    console.log("\n========================================");
    console.log("GuideKit Pipeline Completed Successfully!");
    console.log("========================================");
}
run().catch((err) => {
    console.error("\n❌ CLI Error:", err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map