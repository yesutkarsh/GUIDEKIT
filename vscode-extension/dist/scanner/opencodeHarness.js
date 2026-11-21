"use strict";
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
exports.OpenCodeProcessManager = exports.DEFAULT_OPENCODE_CONFIG = void 0;
exports.resolveOpenCodeBinary = resolveOpenCodeBinary;
exports.generateOpenCodeConfigJson = generateOpenCodeConfigJson;
exports.buildOpenCodeFlowPrompt = buildOpenCodeFlowPrompt;
exports.extractFlowJsonFromOutput = extractFlowJsonFromOutput;
const child_process = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.DEFAULT_OPENCODE_CONFIG = {
    providerPreset: "openrouter",
    providerName: "customprovider",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    modelId: "deepseek/deepseek-chat-v3.1",
    binaryPath: "opencode",
};
/**
 * Locate opencode binary on the local machine
 */
function resolveOpenCodeBinary(configuredPath) {
    if (configuredPath && configuredPath !== "opencode" && fs.existsSync(configuredPath)) {
        return configuredPath;
    }
    const searchPaths = [
        configuredPath || "opencode",
        path.join(os.homedir(), ".opencode", "bin", "opencode"),
        "/opt/homebrew/bin/opencode",
        "/usr/local/bin/opencode",
        "/usr/bin/opencode",
    ];
    for (const p of searchPaths) {
        if (p && p !== "opencode" && fs.existsSync(p)) {
            return p;
        }
    }
    return configuredPath || "opencode";
}
/**
 * Build dynamic opencode.json config object using @ai-sdk/openai-compatible provider
 */
function generateOpenCodeConfigJson(config) {
    const providerKey = config.providerName || "customprovider";
    const modelId = config.modelId || "deepseek/deepseek-chat-v3.1";
    return {
        $schema: "https://opencode.ai/config.json",
        model: `${providerKey}/${modelId}`,
        provider: {
            [providerKey]: {
                npm: "@ai-sdk/openai-compatible",
                name: config.providerPreset === "openrouter"
                    ? "OpenRouter"
                    : config.providerPreset === "groq"
                        ? "Groq"
                        : "Custom OpenAI-compatible provider",
                options: {
                    baseURL: config.baseUrl,
                    apiKey: config.apiKey,
                },
                models: {
                    [modelId]: {
                        name: modelId,
                    },
                },
            },
        },
        // OpenCode V2 rules. The extension, never the agent, applies approved edits.
        permissions: [
            { action: "*", resource: "*", effect: "deny" },
            { action: "read", resource: "*", effect: "allow" },
            { action: "glob", resource: "*", effect: "allow" },
            { action: "grep", resource: "*", effect: "allow" },
            { action: "list", resource: "*", effect: "allow" },
            { action: "edit", resource: "*", effect: "deny" },
            { action: "shell", resource: "*", effect: "deny" },
            { action: "subagent", resource: "*", effect: "deny" },
            { action: "external_directory", resource: "*", effect: "deny" },
        ],
        // V1 compatibility for currently installed OpenCode builds.
        permission: {
            read: "allow",
            glob: "allow",
            grep: "allow",
            list: "allow",
            edit: "deny",
            bash: "deny",
            task: "deny",
            external_directory: "deny",
        },
        tools: {
            write: false,
            edit: false,
            patch: false,
            bash: false,
        },
    };
}
/**
 * Constructs the structured prompt for OpenCode CLI with strict scope guardrails
 */
function buildOpenCodeFlowPrompt(flowDescription) {
    return `You are GuideKit Open Code, an AI codebase scanner and interactive product tour builder.

STRICT SCOPE AND GUARDRAILS:
1. SCOPE: You are exclusively designed to analyze this codebase and synthesize interactive product tours, onboarding walkthroughs, feature steps, and UI flows.
2. REFUSE OUT-OF-SCOPE REQUESTS: If the user asks you to perform tasks unrelated to application workflows, UI steps, codebase tours, or feature walkthroughs (such as writing general essays, creative stories, poetry, math homework, general trivia, or unrelated general chat), you MUST REFUSE politely and concisely:
   "I am GuideKit Open Code, specialized exclusively in analyzing your codebase to synthesize interactive product tours and flows. Please ask me to detect or build a tour for your application (e.g., checkout walkthrough, login flow, or onboarding tour)."
   Do NOT output any JSON block when declining out-of-scope requests.
3. SELF-IDENTITY: If the user asks about your identity or name (e.g. "Who are you?", "What is your name?"), answer briefly:
   "I am GuideKit Open Code, your automated codebase flow synthesizer and walkthrough builder."
4. SAFETY: Never edit files, write files, or execute shell commands. Use only read-only search tools (grep, glob, read) to inspect files in this workspace.

FLOW SYNTHESIS OBJECTIVE:
When the user requests to detect, synthesize, or inspect a flow matching:
"${flowDescription}"

Follow these steps:
1. Search and inspect the workspace routes and components (e.g. Next.js, SvelteKit, React, Vue, HTML).
2. Identify the exact chronological sequence of interactive steps (buttons, inputs, links, forms) that an end-user performs to complete this workflow.
3. Check if this flow requires authentication (e.g. checks token, redirects to /login) or requires a specific role (e.g. driver, admin, passenger).
4. If authentication is required, identify the prerequisite flow slug (e.g. "login").
5. For each step, determine:
   - step_order (1-indexed: 1, 2, 3...)
   - guide_id (e.g. "<slug>-step-1")
   - route_pattern (e.g. "/driver/dashboard", "/book")
   - action_type ("click" | "input" | "select" | "navigate")
   - advance_on ("click" | "input_valid" | "route_change" | "manual_next")
   - content: English { title, description } and optional Hindi { title, description }
   - target_fingerprint: { tag, text, css, guide_id, attrs: { id, class, data-testid, ... } }
   - source_file and source_line when the exact source element is known
6. Provide a concise conversational response describing what you found in the codebase.
7. OUTPUT FORMAT:
Output your final synthesized workflow strictly enclosed within <<<GUIDEKIT_FLOW_JSON_START>>> and <<<GUIDEKIT_FLOW_JSON_END>>> as valid JSON matching this exact structure:

<<<GUIDEKIT_FLOW_JSON_START>>>
{
  "slug": "flow-slug-here",
  "content": {
    "en": {
      "title": "Human Readable Flow Title",
      "description": "Clear overview of what this workflow guides the user through."
    },
    "hi": {
      "title": "वैकल्पिक शीर्षक",
      "description": "वैकल्पिक विवरण"
    }
  },
  "example_queries": [
    "How do I do X?",
    "Where is the button for Y?"
  ],
  "requires_auth": true,
  "required_role": "driver",
  "prerequisite_feature_slug": "login",
  "steps": [
    {
      "step_order": 1,
      "guide_id": "flow-slug-here-step-1",
      "route_pattern": "/example/route",
      "action_type": "input",
      "advance_on": "input_valid",
      "content": {
        "en": {
          "title": "Enter Details",
          "description": "Fill out the required information."
        }
      },
      "target_fingerprint": {
        "tag": "input",
        "css": "input#example-input",
        "attrs": {
          "id": "example-input",
          "data-testid": "example-input"
        }
      },
      "source_file": "src/routes/example/+page.svelte",
      "source_line": 24
    }
  ]
}
<<<GUIDEKIT_FLOW_JSON_END>>>
`;
}
/**
 * Extracts and parses the JSON block between <<<GUIDEKIT_FLOW_JSON_START>>> and <<<GUIDEKIT_FLOW_JSON_END>>>
 */
function extractFlowJsonFromOutput(output) {
    const startMarker = "<<<GUIDEKIT_FLOW_JSON_START>>>";
    const endMarker = "<<<GUIDEKIT_FLOW_JSON_END>>>";
    const startIdx = output.indexOf(startMarker);
    const endIdx = output.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const rawJson = output.substring(startIdx + startMarker.length, endIdx).trim();
        try {
            const parsed = JSON.parse(rawJson);
            if (parsed.slug && Array.isArray(parsed.steps)) {
                return parsed;
            }
        }
        catch (err) {
            console.error("GuideKit: Failed to parse extracted flow JSON:", err);
        }
    }
    // Fallback: Check if there's a JSON block enclosed in markdown ```json ... ```
    const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        try {
            const parsed = JSON.parse(codeBlockMatch[1]);
            if (parsed.slug && Array.isArray(parsed.steps)) {
                return parsed;
            }
        }
        catch {
            // ignore
        }
    }
    return null;
}
/**
 * Singleton Process Manager for OpenCode CLI
 */
class OpenCodeProcessManager {
    static _instance;
    _activeProcess = null;
    _isRunning = false;
    _outputBuffer = "";
    constructor() { }
    static getInstance() {
        if (!OpenCodeProcessManager._instance) {
            OpenCodeProcessManager._instance = new OpenCodeProcessManager();
        }
        return OpenCodeProcessManager._instance;
    }
    isRunning() {
        return this._isRunning;
    }
    getActivePid() {
        return this._activeProcess?.pid;
    }
    /**
     * Spawn opencode CLI agent and stream execution
     */
    async spawnAgent(workspaceRoot, flowDescription, config, callbacks) {
        if (this._isRunning) {
            throw new Error("An OpenCode process is already running. Please terminate it first.");
        }
        this._isRunning = true;
        this._outputBuffer = "";
        callbacks.onStatusChange?.("spawning");
        try {
            // Supply an inline, read-only config. Never write configuration into the user's workspace.
            const binary = resolveOpenCodeBinary(config.binaryPath);
            const prompt = buildOpenCodeFlowPrompt(flowDescription);
            const modelFlag = `${config.providerName || "customprovider"}/${config.modelId || "deepseek/deepseek-chat-v3.1"}`;
            const args = ["run", "--format", "json", "--model", modelFlag, prompt];
            const env = {
                ...process.env,
                INCEPTION_API_KEY: config.apiKey,
                OPENAI_API_KEY: config.apiKey,
                OPENAI_BASE_URL: config.baseUrl,
                OPENCODE_CONFIG_CONTENT: JSON.stringify(generateOpenCodeConfigJson(config)),
            };
            callbacks.onLog?.(`[guidekit] Spawning: ${binary} run --format json --model ${modelFlag}`);
            const child = child_process.spawn(binary, args, {
                cwd: workspaceRoot,
                env,
                stdio: ["ignore", "pipe", "pipe"],
            });
            this._activeProcess = child;
            callbacks.onStatusChange?.("running", child.pid, `Analyzing codebase for '${flowDescription}'`);
            let detectedFlow = null;
            // Handle stdout JSONL stream
            let lineBuffer = "";
            child.stdout?.on("data", (chunk) => {
                const text = chunk.toString("utf-8");
                this._outputBuffer += text;
                lineBuffer += text;
                const lines = lineBuffer.split("\n");
                lineBuffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    // Attempt to parse JSONL
                    try {
                        const json = JSON.parse(trimmed);
                        this.handleJsonlEvent(json, callbacks);
                    }
                    catch {
                        // Raw text line
                        callbacks.onLog?.(trimmed);
                    }
                }
                // Check if output buffer contains completed flow JSON
                if (!detectedFlow) {
                    const extracted = extractFlowJsonFromOutput(this._outputBuffer);
                    if (extracted) {
                        detectedFlow = extracted;
                        callbacks.onFlowDetected?.(extracted);
                        // Let the read-only process exit normally so its final JSONL events are not truncated.
                    }
                }
            });
            // Handle stderr
            child.stderr?.on("data", (chunk) => {
                const errText = chunk.toString("utf-8").trim();
                if (errText) {
                    callbacks.onLog?.(`[stderr] ${errText}`);
                }
            });
            // Handle exit
            return new Promise((resolve) => {
                child.on("error", (err) => {
                    callbacks.onError?.(err);
                    this.cleanup();
                    resolve(null);
                });
                child.on("close", (code, signal) => {
                    callbacks.onExit?.(code, signal);
                    if (!detectedFlow) {
                        detectedFlow = extractFlowJsonFromOutput(this._outputBuffer);
                        if (detectedFlow) {
                            callbacks.onFlowDetected?.(detectedFlow);
                        }
                    }
                    this.cleanup();
                    callbacks.onStatusChange?.("unspawned");
                    resolve(detectedFlow);
                });
            });
        }
        catch (err) {
            this.cleanup();
            callbacks.onError?.(err);
            throw err;
        }
    }
    /**
     * Helper to format human-readable JSONL logs from OpenCode
     */
    handleJsonlEvent(json, callbacks) {
        if (json.type === "tool_call" || json.tool) {
            const toolName = json.tool || json.name || "tool";
            const args = json.args ? JSON.stringify(json.args) : "";
            callbacks.onLog?.(`🔧 [tool: ${toolName}] ${args}`, json);
        }
        else if (json.type === "reasoning" || json.thinking) {
            const thought = json.thinking || json.text || "";
            callbacks.onLog?.(`🧠 [reasoning] ${thought.substring(0, 140)}...`, json);
        }
        else if (json.type === "message" || json.content) {
            const content = json.content || json.text || "";
            callbacks.onLog?.(`💬 ${content.substring(0, 140)}`, json);
        }
        else {
            callbacks.onLog?.(`[agent] ${JSON.stringify(json)}`, json);
        }
    }
    /**
     * Guaranteed Unspawn: SIGTERM, then SIGKILL if still alive after 1 second
     */
    async unspawnCleanly(child = this._activeProcess, callbacks) {
        if (!child || child.killed) {
            await this.cleanup();
            callbacks?.onStatusChange?.("unspawned");
            return;
        }
        callbacks?.onStatusChange?.("unspawning", child.pid, "Terminating agent process...");
        try {
            child.kill("SIGTERM");
            setTimeout(() => {
                if (!child.killed) {
                    try {
                        child.kill("SIGKILL");
                    }
                    catch {
                        // ignore
                    }
                }
            }, 1000);
        }
        catch {
            // ignore
        }
        await this.cleanup();
        callbacks?.onStatusChange?.("unspawned");
    }
    /**
     * Force stop method exposed to sidebar button
     */
    async forceStop() {
        if (this._activeProcess) {
            await this.unspawnCleanly(this._activeProcess);
        }
        else {
            await this.cleanup();
        }
    }
    async cleanup() {
        this._isRunning = false;
        this._activeProcess = null;
    }
}
exports.OpenCodeProcessManager = OpenCodeProcessManager;
//# sourceMappingURL=opencodeHarness.js.map