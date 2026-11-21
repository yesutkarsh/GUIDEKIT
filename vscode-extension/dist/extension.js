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
exports.GuideKitSidebarProvider = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const client_1 = require("./api/client");
const routeScanner_1 = require("./scanner/routeScanner");
const elementExtractor_1 = require("./scanner/elementExtractor");
const flowBuilder_1 = require("./scanner/flowBuilder");
const codemodInjector_1 = require("./scanner/codemodInjector");
const selectionExtractor_1 = require("./scanner/selectionExtractor");
const opencodeHarness_1 = require("./scanner/opencodeHarness");
const sidebarHtml_1 = require("./webview/sidebarHtml");
const studioHtml_1 = require("./webview/studioHtml");
const SESSION_SECRET_KEY = "guidekit_session_v2";
const PENDING_AUTH_SECRET_KEY = "guidekit_pending_device_auth";
const LEGACY_TOKEN_SECRET_KEY = "guidekit_developer_token";
const ACTIVE_PROJECT_KEY = "guidekit_active_project_id";
const ACTIVE_WORKSPACE_KEY = "guidekit_active_workspace_id";
const OPENCODE_CONFIG_KEY = "guidekit_opencode_config";
const OPENCODE_API_KEY_SECRET = "guidekit_opencode_api_key";
class GuideKitSidebarProvider {
    _context;
    _apiBaseUrl;
    static viewType = "guidekit.sidebarView";
    _view;
    _apiClient;
    _token = null;
    _session = null;
    _pendingAuth = null;
    _authFlowPromise = null;
    _refreshPromise = null;
    _authCancelled = false;
    _projects = [];
    _activeProjectId = null;
    _organizations = [];
    _activeWorkspaceId = null;
    _opencodeConfig = { ...opencodeHarness_1.DEFAULT_OPENCODE_CONFIG };
    _studioPanel;
    _studioMode = "studio";
    _studioFlowSlug = "untitled-flow";
    _studioFlowTitle = "Untitled flow";
    _studioStepCount = 0;
    _lastActiveEditor;
    onDecorationsRefresh;
    _studioAgentHistory = [];
    getActiveFlowSlug() {
        return this._studioFlowSlug;
    }
    getActiveFlowTitle() {
        return this._studioFlowTitle || this._studioFlowSlug;
    }
    getNextStepOrder() {
        return this._studioStepCount + 1;
    }
    setLastActiveEditor(editor) {
        if (editor && editor.document.uri.scheme === "file") {
            this._lastActiveEditor = editor;
        }
    }
    getLastActiveEditor() {
        return this._lastActiveEditor;
    }
    refreshEditorDecorations() {
        if (this.onDecorationsRefresh) {
            this.onDecorationsRefresh();
        }
    }
    postStudioMessage(message) {
        this._studioPanel?.webview.postMessage(message);
    }
    constructor(_context, _apiBaseUrl = "http://127.0.0.1:8000/api/v1") {
        this._context = _context;
        this._apiBaseUrl = _apiBaseUrl;
        this._apiClient = new client_1.GuideKitApiClient(this._apiBaseUrl);
    }
    async resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };
        const sidebarStyles = fs.readFileSync(path.join(this._context.extensionPath, "media", "sidebar.css"), "utf8");
        webviewView.webview.html = (0, sidebarHtml_1.getSidebarHtml)(sidebarStyles);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case "ready":
                    await this.restoreSession();
                    break;
                case "requestDeviceAuth":
                    await this.startDeviceAuthFlow();
                    break;
                case "cancelDeviceAuth":
                    await this.cancelDeviceAuth();
                    break;
                case "reopenDeviceAuth":
                    await this.reopenDeviceAuth();
                    break;
                case "openDashboard":
                    await vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/dashboard"));
                    break;
                case "openWorkspaceSetup":
                    await vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/onboarding?return_to=%2Fdashboard"));
                    break;
                case "openWorkspaceManagement":
                    await vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/dashboard/settings#workspace"));
                    break;
                case "openProfile":
                    await vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/dashboard/settings#account"));
                    break;
                case "openKnowledgeDashboard":
                    await vscode.env.openExternal(vscode.Uri.parse("http://localhost:3000/dashboard/knowledge"));
                    break;
                case "signOut":
                    await this.signOut();
                    break;
                case "loadProjects":
                    await this.loadProjects();
                    break;
                case "loadWorkspaces":
                    await this.loadWorkspaces();
                    break;
                case "selectWorkspace":
                    await this.setActiveWorkspace(data.workspaceId);
                    break;
                case "selectProject":
                    await this.setActiveProject(data.projectId);
                    break;
                case "captureActiveSelection":
                    await this.captureActiveSelection(data.flowSlug, data.stepOrder);
                    break;
                case "openStudio":
                    await this.openStudio(data.mode || "studio");
                    break;
                case "saveOpenCodeConfig":
                    await this.saveOpenCodeConfig(data.config);
                    break;
                case "spawnOpenCode":
                    await this.spawnOpenCode(data.flowDescription);
                    break;
                case "stopOpenCode":
                    await this.stopOpenCode();
                    break;
                case "acceptDetectedFlow":
                    await this.acceptDetectedFlow(data.flow);
                    break;
                case "syncAndPublishStaged":
                    await this.syncAndPublishStaged(data.flows);
                    break;
                case "scanWorkspace":
                    await this.runScanner();
                    break;
                case "injectCodemods":
                    await this.runCodemods();
                    break;
                case "startGoogleAuth":
                    await this.startDeviceAuthFlow();
                    break;
                case "loadExistingFlows":
                    await this.loadExistingFlows();
                    break;
                case "editExistingFlow":
                    await this.editExistingFlow(data.featureId);
                    break;
                case "deleteExistingFlow":
                    await this.deleteExistingFlow(data.featureId);
                    break;
                case "loadKnowledge":
                    await this.loadKnowledge();
                    break;
                case "uploadKnowledgeFile":
                    await this.uploadKnowledgeFile();
                    break;
                case "indexKnowledgeText":
                    await this.indexKnowledgeText(data.title, data.content);
                    break;
                case "deleteKnowledge":
                    await this.deleteKnowledge(data.sourceId);
                    break;
            }
        });
    }
    async restoreSession() {
        this._activeProjectId = this._context.globalState.get(ACTIVE_PROJECT_KEY) || null;
        this._activeWorkspaceId = this._context.globalState.get(ACTIVE_WORKSPACE_KEY) || null;
        await this._context.secrets.delete(LEGACY_TOKEN_SECRET_KEY);
        await this._context.secrets.delete("guidekit_refresh_token");
        const savedSession = await this._context.secrets.get(SESSION_SECRET_KEY);
        const savedPending = await this._context.secrets.get(PENDING_AUTH_SECRET_KEY);
        try {
            this._session = savedSession ? JSON.parse(savedSession) : null;
            this._token = this._session?.accessToken || null;
        }
        catch {
            this._session = null;
            this._token = null;
            await this._context.secrets.delete(SESSION_SECRET_KEY);
        }
        try {
            this._pendingAuth = savedPending ? JSON.parse(savedPending) : null;
        }
        catch {
            this._pendingAuth = null;
            await this._context.secrets.delete(PENDING_AUTH_SECRET_KEY);
        }
        // Load OpenCode config from globalState & secrets
        const savedConfig = this._context.globalState.get(OPENCODE_CONFIG_KEY);
        const savedApiKey = (await this._context.secrets.get(OPENCODE_API_KEY_SECRET)) || "";
        this._opencodeConfig = {
            ...opencodeHarness_1.DEFAULT_OPENCODE_CONFIG,
            ...(savedConfig || {}),
            apiKey: savedApiKey,
        };
        if (this._session) {
            try {
                const me = await this.withAccessToken((token) => this._apiClient.getMe(token));
                this._view?.webview.postMessage({
                    type: "authState",
                    isAuthenticated: true,
                    developer: { email: me.developer.email },
                });
                await this.loadWorkspaces();
            }
            catch (error) {
                if (error instanceof client_1.GuideKitApiError && error.status === 401) {
                    await this.clearSession();
                    this._view?.webview.postMessage({ type: "authState", isAuthenticated: false });
                }
                else {
                    this._view?.webview.postMessage({
                        type: "authProgress",
                        state: "offline",
                        message: "Session saved. The local API is unavailable; retry when it is running.",
                    });
                }
            }
        }
        else {
            this._view?.webview.postMessage({ type: "authState", isAuthenticated: false });
            if (this._pendingAuth && this._pendingAuth.expiresAt > Date.now()) {
                this.postPendingAuth();
                void this.resumePendingAuth();
            }
            else if (this._pendingAuth) {
                await this.cancelDeviceAuth();
            }
        }
    }
    async storeSession(session) {
        this._session = session;
        this._token = session.accessToken;
        await this._context.secrets.store(SESSION_SECRET_KEY, JSON.stringify(session));
    }
    async clearSession() {
        this._session = null;
        this._token = null;
        this._refreshPromise = null;
        await this._context.secrets.delete(SESSION_SECRET_KEY);
    }
    async ensureAccessToken(forceRefresh = false) {
        if (!this._session)
            throw new Error("GuideKit is not signed in");
        if (!forceRefresh && this._session.expiresAt > Date.now() + 60_000) {
            return this._session.accessToken;
        }
        if (!this._refreshPromise) {
            this._refreshPromise = (async () => {
                this._view?.webview.postMessage({
                    type: "authProgress",
                    state: "refreshing",
                    message: "Refreshing your GuideKit session…",
                });
                let refreshed;
                try {
                    refreshed = await this._apiClient.refreshSession(this._session.refreshToken);
                }
                catch (error) {
                    if (error instanceof client_1.GuideKitApiError && error.status === 401) {
                        await this.clearSession();
                    }
                    throw error;
                }
                const session = {
                    accessToken: refreshed.access_token,
                    refreshToken: refreshed.refresh_token,
                    expiresAt: Date.now() + 15 * 60 * 1000,
                };
                await this.storeSession(session);
                return session.accessToken;
            })().finally(() => { this._refreshPromise = null; });
        }
        return this._refreshPromise;
    }
    async withAccessToken(operation) {
        let token = await this.ensureAccessToken();
        try {
            return await operation(token);
        }
        catch (error) {
            const isUnauthorized = (error instanceof client_1.GuideKitApiError && error.status === 401) ||
                (error instanceof Error && /\(401\)/.test(error.message));
            if (!isUnauthorized)
                throw error;
            token = await this.ensureAccessToken(true);
            return operation(token);
        }
    }
    postPendingAuth() {
        if (!this._pendingAuth)
            return;
        this._view?.webview.postMessage({
            type: "deviceCodeRequested",
            userCode: this._pendingAuth.userCode,
            verificationUri: this._pendingAuth.verificationUri,
            expiresAt: this._pendingAuth.expiresAt,
        });
    }
    /**
     * One-Click Device Code Flow with browser auto-open & polling
     */
    async startDeviceAuthFlow() {
        if (this._authFlowPromise) {
            if (!this._authCancelled) {
                await this.reopenDeviceAuth();
                return this._authFlowPromise;
            }
            await this._authFlowPromise;
        }
        this._authCancelled = false;
        this._authFlowPromise = this.runDeviceAuthFlow(true).finally(() => {
            this._authFlowPromise = null;
        });
        return this._authFlowPromise;
    }
    async runDeviceAuthFlow(openBrowser) {
        try {
            this._view?.webview.postMessage({
                type: "authProgress",
                state: "starting",
                message: "Opening Google in your browser…",
            });
            if (!this._pendingAuth || this._pendingAuth.expiresAt <= Date.now()) {
                const codeResp = await this._apiClient.requestDeviceCode("vscode_extension");
                this._pendingAuth = {
                    deviceCode: codeResp.device_code,
                    userCode: codeResp.user_code,
                    verificationUri: codeResp.verification_uri_complete || codeResp.verification_uri,
                    expiresAt: Date.now() + codeResp.expires_in * 1000,
                    interval: codeResp.interval || 5,
                };
                await this._context.secrets.store(PENDING_AUTH_SECRET_KEY, JSON.stringify(this._pendingAuth));
            }
            this.postPendingAuth();
            if (openBrowser) {
                const opened = await vscode.env.openExternal(vscode.Uri.parse(this._pendingAuth.verificationUri));
                if (!opened) {
                    throw new Error("The browser could not be opened. Use Reopen browser to try again.");
                }
            }
            vscode.window.showInformationMessage(`GuideKit: Confirm code ${this._pendingAuth.userCode} in your browser.`);
            const pending = this._pendingAuth;
            let tokenResp = null;
            while (!this._authCancelled && Date.now() < pending.expiresAt) {
                tokenResp = await this._apiClient.pollDeviceToken(pending.deviceCode);
                if (tokenResp)
                    break;
                await new Promise((resolve) => setTimeout(resolve, pending.interval * 1000));
            }
            if (this._authCancelled)
                return;
            if (!tokenResp)
                throw new Error("Device authorization expired. Start sign-in again.");
            await this.storeSession({
                accessToken: tokenResp.access_token,
                refreshToken: tokenResp.refresh_token,
                expiresAt: Date.now() + tokenResp.expires_in * 1000,
            });
            this._pendingAuth = null;
            await this._context.secrets.delete(PENDING_AUTH_SECRET_KEY);
            const me = await this.withAccessToken((token) => this._apiClient.getMe(token));
            const devEmail = me.developer.email;
            this._view?.webview.postMessage({
                type: "authState",
                isAuthenticated: true,
                developer: { email: devEmail },
            });
            vscode.window.showInformationMessage(`Welcome to GuideKit, ${devEmail}!`);
            await this.loadWorkspaces();
        }
        catch (err) {
            if (this._authCancelled)
                return;
            const authErrorCode = err instanceof client_1.GuideKitApiError ? err.code || "" : "";
            if (["denied", "expired", "consumed"].includes(authErrorCode) ||
                (err instanceof Error && /authorization expired/i.test(err.message))) {
                this._pendingAuth = null;
                await this._context.secrets.delete(PENDING_AUTH_SECRET_KEY);
            }
            const message = authErrorCode === "denied"
                ? "Google sign-in was cancelled or denied. Try again when you are ready."
                : ["expired", "consumed"].includes(authErrorCode) || /authorization expired/i.test(err?.message || "")
                    ? "This sign-in request expired. Start sign-in again."
                    : err?.message || "Google sign-in could not be completed. Check your connection and try again.";
            vscode.window.showErrorMessage(`GuideKit authentication failed: ${message}`);
            this._view?.webview.postMessage({
                type: "authProgress",
                state: "error",
                message,
            });
        }
    }
    async resumePendingAuth(openBrowser = false) {
        if (!this._pendingAuth || this._pendingAuth.expiresAt <= Date.now())
            return;
        if (openBrowser)
            await this.reopenDeviceAuth();
        if (!this._authFlowPromise) {
            this._authCancelled = false;
            this._authFlowPromise = this.runDeviceAuthFlow(false).finally(() => {
                this._authFlowPromise = null;
            });
            await this._authFlowPromise;
        }
    }
    async reopenDeviceAuth() {
        if (!this._pendingAuth)
            return;
        await vscode.env.openExternal(vscode.Uri.parse(this._pendingAuth.verificationUri));
    }
    async cancelDeviceAuth() {
        this._authCancelled = true;
        this._pendingAuth = null;
        await this._context.secrets.delete(PENDING_AUTH_SECRET_KEY);
        this._view?.webview.postMessage({ type: "authProgress", state: "cancelled", message: "Sign-in cancelled." });
    }
    async signOut() {
        let revoked = true;
        if (this._session?.refreshToken) {
            try {
                await this._apiClient.logout(this._session.refreshToken);
            }
            catch {
                revoked = false;
            }
        }
        await this.clearSession();
        await this.cancelDeviceAuth();
        this._activeProjectId = null;
        this._activeWorkspaceId = null;
        this._projects = [];
        this._organizations = [];
        await this._context.globalState.update(ACTIVE_PROJECT_KEY, undefined);
        await this._context.globalState.update(ACTIVE_WORKSPACE_KEY, undefined);
        this._view?.webview.postMessage({
            type: "authState",
            isAuthenticated: false,
        });
        this._view?.webview.postMessage({
            type: "projectsLoaded",
            projects: [],
            selectedProjectId: null,
        });
        this._view?.webview.postMessage({
            type: "workspaceState",
            state: "signed_out",
            workspaces: [],
            selectedWorkspaceId: null,
        });
        if (revoked) {
            vscode.window.showInformationMessage("GuideKit: Signed out successfully.");
        }
        else {
            vscode.window.showWarningMessage("GuideKit signed out locally, but the API was unavailable to confirm remote revocation.");
        }
    }
    async loadWorkspaces() {
        if (!this._session)
            return;
        this._view?.webview.postMessage({
            type: "workspaceState",
            state: "loading",
            workspaces: this._organizations,
            selectedWorkspaceId: this._activeWorkspaceId,
        });
        try {
            this._organizations = await this.withAccessToken((token) => this._apiClient.listOrganizations(token));
            if (this._organizations.length === 0) {
                await this.clearWorkspaceSelection();
                this._view?.webview.postMessage({
                    type: "workspaceState",
                    state: "empty",
                    workspaces: [],
                    selectedWorkspaceId: null,
                });
                return;
            }
            const storedWorkspaceIsValid = this._organizations.some((workspace) => workspace.id === this._activeWorkspaceId);
            if (this._organizations.length === 1) {
                await this.activateWorkspace(this._organizations[0].id);
                return;
            }
            if (storedWorkspaceIsValid && this._activeWorkspaceId) {
                await this.activateWorkspace(this._activeWorkspaceId);
                return;
            }
            await this.clearWorkspaceSelection();
            this._view?.webview.postMessage({
                type: "workspaceState",
                state: "selection_required",
                workspaces: this._organizations,
                selectedWorkspaceId: null,
            });
        }
        catch (error) {
            if (error instanceof client_1.GuideKitApiError && error.status === 401) {
                await this.clearSession();
                this._view?.webview.postMessage({ type: "authState", isAuthenticated: false });
                return;
            }
            this._view?.webview.postMessage({
                type: "workspaceState",
                state: "error",
                workspaces: this._organizations,
                selectedWorkspaceId: this._activeWorkspaceId,
                message: error?.message || "We couldn't load your workspaces. Try again.",
            });
        }
    }
    async setActiveWorkspace(workspaceId) {
        if (!workspaceId || !this._organizations.some((workspace) => workspace.id === workspaceId)) {
            this._view?.webview.postMessage({
                type: "workspaceState",
                state: "error",
                workspaces: this._organizations,
                selectedWorkspaceId: null,
                message: "That workspace is no longer available. Refresh and choose another.",
            });
            return;
        }
        await this.activateWorkspace(workspaceId);
    }
    async activateWorkspace(workspaceId) {
        const workspace = this._organizations.find((item) => item.id === workspaceId);
        if (!workspace)
            return;
        const workspaceChanged = this._activeWorkspaceId !== workspaceId;
        this._activeWorkspaceId = workspaceId;
        await this._context.globalState.update(ACTIVE_WORKSPACE_KEY, workspaceId);
        if (workspaceChanged) {
            this._activeProjectId = null;
            this._projects = [];
            await this._context.globalState.update(ACTIVE_PROJECT_KEY, undefined);
        }
        this._view?.webview.postMessage({
            type: "workspaceState",
            state: "ready",
            workspaces: this._organizations,
            workspace,
            selectedWorkspaceId: workspaceId,
        });
        await this.loadProjects();
    }
    async clearWorkspaceSelection() {
        this._activeWorkspaceId = null;
        this._activeProjectId = null;
        this._projects = [];
        await this._context.globalState.update(ACTIVE_WORKSPACE_KEY, undefined);
        await this._context.globalState.update(ACTIVE_PROJECT_KEY, undefined);
        this._view?.webview.postMessage({
            type: "projectsLoaded",
            projects: [],
            selectedProjectId: null,
        });
    }
    async loadProjects() {
        if (!this._session || !this._activeWorkspaceId)
            return;
        try {
            this._projects = await this.withAccessToken((token) => this._apiClient.listProjects(token, this._activeWorkspaceId));
            const activeProjectIsValid = this._projects.some((project) => project.id === this._activeProjectId);
            if (!activeProjectIsValid) {
                this._activeProjectId = this._projects.length === 1 ? this._projects[0].id : null;
                await this._context.globalState.update(ACTIVE_PROJECT_KEY, this._activeProjectId || undefined);
            }
            this._view?.webview.postMessage({
                type: "projectsLoaded",
                projects: this._projects,
                selectedProjectId: this._activeProjectId,
            });
            if (this._activeProjectId) {
                await this.loadExistingFlows();
                await this.loadKnowledge();
            }
        }
        catch (err) {
            this._view?.webview.postMessage({
                type: "error",
                message: `Failed to load projects: ${err.message}`,
            });
        }
    }
    async setActiveProject(projectId) {
        if (!projectId || !this._projects.some((project) => project.id === projectId)) {
            vscode.window.showWarningMessage("GuideKit: That project is not available in the active workspace.");
            return;
        }
        this._activeProjectId = projectId;
        await this._context.globalState.update(ACTIVE_PROJECT_KEY, projectId);
        vscode.window.showInformationMessage(`GuideKit: Active project set.`);
        await this.loadExistingFlows();
        await this.loadKnowledge();
    }
    async openStudio(mode = "studio") {
        if (!this._session || !this._activeProjectId) {
            vscode.window.showWarningMessage("GuideKit: Sign in and select a project before opening Studio.");
            return;
        }
        this._studioMode = mode;
        if (this._studioPanel) {
            this._studioPanel.reveal(vscode.ViewColumn.Beside, false);
            await this.postStudioInit();
            return;
        }
        this._studioPanel = vscode.window.createWebviewPanel("guidekit.flowStudio", "GuideKit Studio", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false }, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this._context.extensionUri],
        });
        const styles = fs.readFileSync(path.join(this._context.extensionPath, "media", "sidebar.css"), "utf8");
        const nonce = this.createNonce();
        this._studioPanel.webview.html = (0, studioHtml_1.getStudioHtml)(styles, nonce);
        this._studioPanel.onDidDispose(() => {
            this._studioPanel = undefined;
        });
        this._studioPanel.webview.onDidReceiveMessage(async (data) => {
            await this.handleStudioMessage(data);
        });
    }
    createNonce() {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let value = "";
        for (let i = 0; i < 32; i += 1)
            value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        return value;
    }
    async handleStudioMessage(data) {
        switch (data.command) {
            case "studioReady":
                await this.postStudioInit();
                break;
            case "studioDraftState":
                this._studioFlowSlug = data.slug || "untitled-flow";
                this._studioFlowTitle = data.title || "Untitled flow";
                this._studioStepCount = Number(data.stepCount || 0);
                this.refreshEditorDecorations();
                break;
            case "captureSelection":
                await this.captureActiveSelection(data.flowSlug, data.stepOrder);
                break;
            case "loadExistingFlows":
                await this.loadExistingFlows();
                break;
            case "loadStudioFlow":
                await this.loadFlowIntoStudio(data.featureId);
                break;
            case "saveStudioDraft":
                await this.saveStudioDraft(data.flow);
                break;
            case "publishStudioDraft":
                await this.publishStudioDraft(data.featureIds || []);
                break;
            case "runOpenCode":
                const agentPrompt = this.buildStudioAgentPrompt(data.prompt, data.currentFlow);
                this._studioAgentHistory.push({ role: "user", content: String(data.prompt || "") });
                await this.spawnOpenCode(agentPrompt);
                break;
            case "stopOpenCode":
                await this.stopOpenCode();
                break;
            case "applyOpenCodeProposal":
                await this.applyOpenCodeProposal(data.flow, data.currentFeatureId);
                break;
            case "saveOpenCodeConfig":
                await this.saveOpenCodeConfig(data.config);
                this._studioPanel?.webview.postMessage({ type: "providerSaved", provider: this.providerSummary() });
                break;
            case "testOpenCodeConfig":
                await this.testOpenCodeConfig(data.config);
                break;
            case "openSource":
                await this.openSourceLocation(data.filePath, data.line);
                break;
        }
    }
    async postStudioInit() {
        if (!this._studioPanel || !this._activeProjectId)
            return;
        const project = this._projects.find((item) => item.id === this._activeProjectId);
        const workspace = this._organizations.find((item) => item.id === this._activeWorkspaceId);
        let features = [];
        let featureError = "";
        try {
            features = await this.withAccessToken((token) => this._apiClient.listFeatures(token, this._activeProjectId));
        }
        catch (error) {
            featureError = `Failed to load project flows: ${error.message}`;
        }
        this._studioPanel.webview.postMessage({
            type: "studioInit",
            project,
            workspace,
            features,
            provider: this.providerSummary(),
            mode: this._studioMode,
        });
        if (featureError)
            this._studioPanel.webview.postMessage({ type: "error", message: featureError });
    }
    providerSummary() {
        return {
            providerPreset: this._opencodeConfig.providerPreset,
            baseUrl: this._opencodeConfig.baseUrl,
            modelId: this._opencodeConfig.modelId,
            binaryPath: this._opencodeConfig.binaryPath,
            hasApiKey: Boolean(this._opencodeConfig.apiKey),
        };
    }
    async loadExistingFlows() {
        if (!this._session || !this._activeProjectId)
            return;
        try {
            const features = await this.withAccessToken((token) => this._apiClient.listFeatures(token, this._activeProjectId));
            this._view?.webview.postMessage({
                type: "existingFlowsLoaded",
                features,
            });
            this._studioPanel?.webview.postMessage({ type: "existingFlowsLoaded", features });
        }
        catch (err) {
            const message = {
                type: "error",
                message: `Failed to load existing flows: ${err.message}`,
            };
            this._view?.webview.postMessage(message);
            this._studioPanel?.webview.postMessage(message);
        }
    }
    async editExistingFlow(featureId) {
        await this.openStudio("studio");
        await this.loadFlowIntoStudio(featureId);
    }
    async loadFlowIntoStudio(featureId) {
        if (!this._session || !this._activeProjectId)
            return;
        try {
            const feature = await this.withAccessToken((token) => this._apiClient.getFeature(token, this._activeProjectId, featureId));
            const versions = Array.isArray(feature.versions) ? feature.versions : [];
            const activeVersion = [...versions]
                .filter((version) => version.status === "draft")
                .sort((a, b) => b.version_number - a.version_number)[0]
                || [...versions]
                    .filter((version) => version.status === "published")
                    .sort((a, b) => b.version_number - a.version_number)[0]
                || [...versions].sort((a, b) => b.version_number - a.version_number)[0];
            if (!activeVersion)
                throw new Error("This flow has no version to edit");
            const steps = (feature.steps || [])
                .filter((step) => step.feature_version_id === activeVersion.id)
                .sort((a, b) => a.step_order - b.step_order)
                .map((step, index) => ({
                ...step,
                step_order: index + 1,
                guide_id: step.guide_id || `${feature.slug}-step-${index + 1}`,
            }));
            const prerequisite = activeVersion.prerequisite_feature_id
                ? (await this.withAccessToken((token) => this._apiClient.listFeatures(token, this._activeProjectId)))
                    .find((item) => item.id === activeVersion.prerequisite_feature_id)?.slug || null
                : null;
            this._studioFlowSlug = feature.slug;
            this._studioFlowTitle = activeVersion.content?.en?.title || feature.slug;
            this._studioStepCount = steps.length;
            this.refreshEditorDecorations();
            await this.openStudio("studio");
            this._studioPanel?.webview.postMessage({
                type: "loadDraft",
                flow: {
                    featureId: feature.id,
                    baseVersionId: activeVersion.id,
                    slug: feature.slug,
                    content: activeVersion.content || { en: { title: feature.slug, description: "" } },
                    example_queries: activeVersion.example_queries || [],
                    requires_auth: Boolean(activeVersion.requires_auth),
                    required_role: activeVersion.required_role || null,
                    prerequisite_feature_slug: prerequisite,
                    steps,
                },
            });
        }
        catch (error) {
            this.postStudioError(`Failed to open flow: ${error.message}`);
        }
    }
    async deleteExistingFlow(featureId) {
        if (!this._session || !this._activeProjectId)
            return;
        const confirm = await vscode.window.showWarningMessage("Are you sure you want to delete/archive this workflow?", { modal: true }, "Delete");
        if (confirm !== "Delete")
            return;
        try {
            await this.withAccessToken((token) => this._apiClient.deleteFeature(token, this._activeProjectId, featureId));
            vscode.window.showInformationMessage("Workflow deleted.");
            await this.loadExistingFlows();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to delete workflow: ${err.message}`);
        }
    }
    async loadKnowledge() {
        if (!this._session || !this._activeProjectId)
            return;
        try {
            const sources = await this.withAccessToken((token) => this._apiClient.listKnowledge(token, this._activeProjectId));
            this._view?.webview.postMessage({
                type: "knowledgeLoaded",
                sources,
            });
        }
        catch (err) {
            this._view?.webview.postMessage({
                type: "error",
                message: `Failed to load knowledge: ${err.message}`,
            });
        }
    }
    async uploadKnowledgeFile() {
        if (!this._session || !this._activeProjectId) {
            vscode.window.showErrorMessage("Please sign in and select a project first.");
            return;
        }
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { Documents: ["pdf", "txt", "md", "markdown"] },
        });
        if (!files || files.length === 0)
            return;
        const filePath = files[0].fsPath;
        try {
            const fileBytes = fs.readFileSync(filePath);
            const base64Str = fileBytes.toString("base64");
            const filename = path.basename(filePath);
            vscode.window.showInformationMessage(`Uploading and chunking ${filename}...`);
            const res = await this.withAccessToken((token) => this._apiClient.uploadKnowledgeBase64(token, this._activeProjectId, {
                filename,
                content_base64: base64Str,
                title: filename,
            }));
            vscode.window.showInformationMessage(`Indexed ${filename} into ${res.indexed_chunks} semantic chunks!`);
            await this.loadKnowledge();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
        }
    }
    async indexKnowledgeText(title, content) {
        if (!this._session || !this._activeProjectId) {
            vscode.window.showErrorMessage("Please sign in and select a project first.");
            return;
        }
        try {
            const res = await this.withAccessToken((token) => this._apiClient.indexKnowledgeText(token, this._activeProjectId, { title, content }));
            vscode.window.showInformationMessage(`Indexed '${title}' into ${res.indexed_chunks} semantic chunks!`);
            await this.loadKnowledge();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to index text: ${err.message}`);
        }
    }
    async deleteKnowledge(sourceId) {
        if (!this._session || !this._activeProjectId)
            return;
        try {
            await this.withAccessToken((token) => this._apiClient.deleteKnowledge(token, this._activeProjectId, sourceId));
            vscode.window.showInformationMessage("Knowledge source removed.");
            await this.loadKnowledge();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to delete knowledge source: ${err.message}`);
        }
    }
    /**
     * Method 1: Capture active editor selection as a workflow step
     */
    async captureActiveSelection(flowSlug = "custom-flow", stepOrder = 1) {
        const editor = vscode.window.activeTextEditor || this._lastActiveEditor;
        if (!editor) {
            vscode.window.showWarningMessage("GuideKit: Open a file in the active editor to select an element.");
            return null;
        }
        try {
            const effectiveSlug = (flowSlug && flowSlug !== "custom-flow") ? flowSlug : this._studioFlowSlug;
            const effectiveOrder = (stepOrder && stepOrder > 1) ? stepOrder : (this._studioStepCount > 0 ? this._studioStepCount + 1 : 1);
            const step = await (0, selectionExtractor_1.captureStepFromActiveEditor)(editor, effectiveSlug, effectiveOrder, { autoInjectGuideId: false });
            if (step) {
                this._studioStepCount = Math.max(this._studioStepCount + 1, step.step_order);
                this._view?.webview.postMessage({
                    type: "stepCaptured",
                    step,
                });
                this._studioPanel?.webview.postMessage({ type: "stepCaptured", step });
                if (this._studioPanel) {
                    this._studioPanel.reveal(vscode.ViewColumn.Beside, false);
                }
                else {
                    vscode.window.showInformationMessage(`GuideKit: Captured step ${step.guide_id} into "${effectiveSlug}".`, "Open Studio").then((action) => {
                        if (action === "Open Studio") {
                            this.openStudio("studio");
                        }
                    });
                }
                this.refreshEditorDecorations();
            }
            return step;
        }
        catch (err) {
            vscode.window.showErrorMessage(`GuideKit step capture failed: ${err.message}`);
            return null;
        }
    }
    /**
     * Save OpenCode config
     */
    async saveOpenCodeConfig(config) {
        const apiKey = config.apiKey || this._opencodeConfig.apiKey || "";
        this._opencodeConfig = { ...opencodeHarness_1.DEFAULT_OPENCODE_CONFIG, ...config, apiKey };
        await this._context.secrets.store(OPENCODE_API_KEY_SECRET, apiKey);
        const toPersist = { ...this._opencodeConfig, apiKey: "" };
        await this._context.globalState.update(OPENCODE_CONFIG_KEY, toPersist);
        vscode.window.showInformationMessage("GuideKit: OpenCode Provider settings saved.");
    }
    buildStudioAgentPrompt(prompt, currentFlow) {
        const history = this._studioAgentHistory
            .slice(-6)
            .map((message) => `${message.role === "user" ? "User" : "Open Code"}: ${message.content}`)
            .join("\n");
        const context = currentFlow?.steps?.length
            ? `\nThe user is editing this existing GuideKit draft. Preserve its slug and propose a complete replacement only when changes are requested:\n${JSON.stringify(currentFlow, null, 2)}`
            : "\nThe user is creating a new GuideKit flow.";
        return `${history ? `Continue this Studio conversation:\n${history}\n\n` : ""}Current request: ${prompt}${context}`;
    }
    async testOpenCodeConfig(config) {
        const key = config.apiKey || this._opencodeConfig.apiKey;
        if (!key || !config.baseUrl) {
            this._studioPanel?.webview.postMessage({ type: "providerTest", ok: false, message: "Add an API key and base URL first." });
            return;
        }
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8_000);
            const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models`, {
                headers: { Authorization: `Bearer ${key}` },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok)
                throw new Error(`Provider returned ${response.status}`);
            this._studioPanel?.webview.postMessage({ type: "providerTest", ok: true });
        }
        catch (error) {
            this._studioPanel?.webview.postMessage({
                type: "providerTest",
                ok: false,
                message: `Connection failed: ${error?.message || "unknown provider error"}`,
            });
        }
    }
    postStudioError(message) {
        this._studioPanel?.webview.postMessage({ type: "error", message });
    }
    validateStudioFlow(flow) {
        const errors = [];
        if (!flow || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flow.slug || ""))
            errors.push("Flow slug must use lowercase kebab-case.");
        if (!flow?.content?.en?.title?.trim())
            errors.push("Flow title is required.");
        if (!Array.isArray(flow?.steps) || flow.steps.length === 0)
            errors.push("Add at least one flow step.");
        const ids = (flow?.steps || []).map((step) => step.guide_id).filter(Boolean);
        if (new Set(ids).size !== ids.length)
            errors.push("Guide IDs must be unique.");
        (flow?.steps || []).forEach((step, index) => {
            if (!step.route_pattern?.startsWith("/"))
                errors.push(`Step ${index + 1} needs a route beginning with /.`);
            if (!step.content?.en?.title?.trim())
                errors.push(`Step ${index + 1} needs a title.`);
            if (!step.target_fingerprint || (!step.target_fingerprint.css && !step.target_fingerprint.tag)) {
                errors.push(`Step ${index + 1} needs an element target.`);
            }
        });
        return errors;
    }
    workflowPayload(flow) {
        return {
            features: [{
                    slug: flow.slug,
                    content: flow.content,
                    example_queries: flow.example_queries?.length ? flow.example_queries : [`How do I ${flow.content.en.title.toLowerCase()}?`],
                    requires_auth: Boolean(flow.requires_auth),
                    required_role: flow.required_role || null,
                    prerequisite_feature_slug: flow.prerequisite_feature_slug || null,
                    steps: flow.steps.map((step, index) => ({
                        step_order: index + 1,
                        guide_id: step.guide_id || `${flow.slug}-step-${index + 1}`,
                        route_pattern: step.route_pattern,
                        action_type: step.action_type || "click",
                        advance_on: step.advance_on || "click",
                        content: step.content,
                        target_fingerprint: step.target_fingerprint,
                        is_optional: Boolean(step.is_optional),
                        wait_timeout_ms: step.wait_timeout_ms || 5000,
                        condition: step.condition || null,
                    })),
                }],
        };
    }
    collectSourceEdits(flow) {
        const edits = [];
        for (const step of flow?.steps || []) {
            if (step.source_edit && step.source_edit.approved !== false)
                edits.push(step.source_edit);
        }
        for (const edit of flow?.source_edits || []) {
            if (edit.approved !== false)
                edits.push(edit);
        }
        const seen = new Set();
        return edits.filter((edit) => {
            const key = `${edit.file_path}:${edit.start_offset}:${edit.after}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    async applySourceEdits(edits) {
        if (!edits.length)
            return [];
        const root = path.resolve(this.getTargetWorkspacePath());
        const snapshots = new Map();
        const workspaceEdit = new vscode.WorkspaceEdit();
        for (const edit of [...edits].sort((a, b) => b.start_offset - a.start_offset)) {
            const target = path.resolve(edit.file_path);
            const relative = path.relative(root, target);
            if (relative.startsWith("..") || path.isAbsolute(relative))
                throw new Error("A proposed source edit is outside the active workspace.");
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
            if (edit.document_version !== undefined && document.version !== edit.document_version) {
                throw new Error(`${path.basename(target)} changed after capture. Capture the element again before saving.`);
            }
            const current = document.getText().slice(edit.start_offset, edit.end_offset);
            if (current !== edit.before)
                throw new Error(`${path.basename(target)} no longer matches the reviewed source change.`);
            if (!snapshots.has(target))
                snapshots.set(target, { document, before: document.getText(), version: document.version });
            workspaceEdit.replace(document.uri, new vscode.Range(document.positionAt(edit.start_offset), document.positionAt(edit.end_offset)), edit.after);
        }
        if (!(await vscode.workspace.applyEdit(workspaceEdit)))
            throw new Error("VS Code could not apply the approved source changes.");
        return [...snapshots.values()];
    }
    async rollbackSourceEdits(snapshots) {
        if (!snapshots.length)
            return true;
        const rollback = new vscode.WorkspaceEdit();
        for (const snapshot of snapshots) {
            if (snapshot.document.version !== snapshot.version + 1)
                return false;
            const last = snapshot.document.positionAt(snapshot.document.getText().length);
            rollback.replace(snapshot.document.uri, new vscode.Range(new vscode.Position(0, 0), last), snapshot.before);
        }
        return vscode.workspace.applyEdit(rollback);
    }
    async saveStudioDraft(flow) {
        if (!this._session || !this._activeProjectId) {
            this.postStudioError("Select a project before saving a draft.");
            return null;
        }
        const errors = this.validateStudioFlow(flow);
        if (errors.length) {
            this.postStudioError(errors.join(" "));
            return null;
        }
        let snapshots = [];
        try {
            snapshots = await this.applySourceEdits(this.collectSourceEdits(flow));
            const response = await this.withAccessToken((token) => this._apiClient.syncWorkflows(token, this._activeProjectId, this.workflowPayload(flow)));
            const savedFeatureIds = response.draft_versions.map((item) => String(item.feature_id));
            this._studioPanel?.webview.postMessage({ type: "draftSaved", featureIds: savedFeatureIds });
            await this.loadExistingFlows();
            vscode.window.showInformationMessage("GuideKit: Draft saved. Publishing is still separate.");
            return savedFeatureIds;
        }
        catch (error) {
            const rolledBack = await this.rollbackSourceEdits(snapshots);
            this.postStudioError(`${error.message}${rolledBack ? "" : " Source rollback needs review before publishing."}`);
            return null;
        }
    }
    async publishStudioDraft(featureIds) {
        if (!this._session || !this._activeProjectId)
            return this.postStudioError("Select a project before publishing.");
        const ids = featureIds;
        if (!ids.length)
            return this.postStudioError("Save the current draft before publishing.");
        try {
            const result = await this.withAccessToken((token) => this._apiClient.publishManifest(token, this._activeProjectId, ids));
            this._studioPanel?.webview.postMessage({
                type: "publishSuccess",
                version_number: result.version_number,
                etag: result.etag,
                published_features: result.published_features,
            });
            await this.loadExistingFlows();
        }
        catch (error) {
            this.postStudioError(`Publish failed: ${error.message}`);
        }
    }
    async applyOpenCodeProposal(flow, currentFeatureId) {
        const approvedFlow = { ...flow, featureId: currentFeatureId || undefined };
        const savedFeatureIds = await this.saveStudioDraft(approvedFlow);
        if (savedFeatureIds?.length) {
            this._studioPanel?.webview.postMessage({
                type: "loadDraft",
                flow: { ...approvedFlow, featureId: savedFeatureIds[0] },
            });
        }
    }
    async openSourceLocation(filePath, line) {
        if (!filePath)
            return;
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
        const targetLine = Math.max(0, Number(line || 1) - 1);
        const position = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    /**
     * Method 2: Spawn OpenCode CLI agent with live streaming and guaranteed unspawn
     */
    async spawnOpenCode(flowDescription) {
        const workspaceRoot = this.getTargetWorkspacePath();
        const manager = opencodeHarness_1.OpenCodeProcessManager.getInstance();
        if (!this._opencodeConfig.apiKey || !this._opencodeConfig.baseUrl || !this._opencodeConfig.modelId) {
            this.postStudioError("Configure an Open Code provider, model, and API key before sending a request.");
            return;
        }
        try {
            await manager.spawnAgent(workspaceRoot, flowDescription, this._opencodeConfig, {
                onStatusChange: (status, pid, detail) => {
                    const message = {
                        type: "agentStatus",
                        status,
                        pid,
                        detail,
                    };
                    this._view?.webview.postMessage(message);
                    this._studioPanel?.webview.postMessage(message);
                },
                onLog: (line) => {
                    const message = {
                        type: "agentLog",
                        line,
                    };
                    this._view?.webview.postMessage(message);
                    this._studioPanel?.webview.postMessage(message);
                },
                onFlowDetected: (flow) => {
                    void this.decorateOpenCodeProposal(flow);
                },
                onError: (err) => {
                    const message = {
                        type: "error",
                        message: `OpenCode agent error: ${err.message}`,
                    };
                    this._view?.webview.postMessage(message);
                    this._studioPanel?.webview.postMessage(message);
                },
            });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to run OpenCode: ${err.message}`);
        }
    }
    async decorateOpenCodeProposal(flow) {
        try {
            const routes = await (0, routeScanner_1.scanRoutes)(this.getTargetWorkspacePath());
            const previews = (0, codemodInjector_1.previewGuideIdEdits)(routes, flow.steps);
            const sourceEdits = [];
            for (const preview of previews) {
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(preview.file_path));
                sourceEdits.push({ ...preview, document_version: document.version });
            }
            const proposal = { ...flow, source_edits: sourceEdits };
            this._studioAgentHistory.push({
                role: "assistant",
                content: `Prepared a reviewable ${flow.steps.length}-step proposal for ${flow.slug}. No changes were applied.`,
            });
            const message = { type: "flowDetected", flow: proposal };
            this._view?.webview.postMessage(message);
            this._studioPanel?.webview.postMessage(message);
            vscode.window.showInformationMessage(`GuideKit: Open Code prepared '${flow.slug}' for review.`);
        }
        catch (error) {
            this.postStudioError(`Open Code found a flow, but source review failed: ${error.message}`);
        }
    }
    async stopOpenCode() {
        const manager = opencodeHarness_1.OpenCodeProcessManager.getInstance();
        await manager.forceStop();
        this._studioPanel?.webview.postMessage({ type: "agentStatus", status: "idle" });
        vscode.window.showInformationMessage("GuideKit: OpenCode agent stopped.");
    }
    async acceptDetectedFlow(flow) {
        vscode.window.showInformationMessage(`GuideKit: Accepted flow '${flow?.slug || "flow"}' into workspace drafts.`);
    }
    /**
     * Sync and publish staged workflows to GuideKit DB and CDN
     */
    async syncAndPublishStaged(flows) {
        if (!this._session) {
            vscode.window.showErrorMessage("Please sign in before publishing workflows.");
            return;
        }
        if (!this._activeProjectId) {
            vscode.window.showErrorMessage("Please select a project to publish to.");
            return;
        }
        try {
            const payload = {
                features: flows.map((f) => ({
                    slug: f.slug,
                    content: f.content || { en: { title: f.slug, description: f.slug } },
                    example_queries: f.example_queries || [`How do I ${f.slug}?`],
                    requires_auth: Boolean(f.requires_auth),
                    required_role: f.required_role || null,
                    prerequisite_feature_slug: f.prerequisite_feature_slug || null,
                    steps: (f.steps || []).map((s, idx) => ({
                        step_order: s.step_order || idx + 1,
                        guide_id: s.guide_id || `${f.slug}-step-${idx + 1}`,
                        route_pattern: s.route_pattern || "/",
                        action_type: s.action_type || "click",
                        advance_on: s.advance_on || "click",
                        content: s.content || { en: { title: s.guide_id, description: s.guide_id } },
                        target_fingerprint: s.target_fingerprint || { tag: "button", guide_id: s.guide_id },
                        is_optional: Boolean(s.is_optional),
                        wait_timeout_ms: s.wait_timeout_ms || 5000,
                    })),
                })),
            };
            vscode.window.showInformationMessage("GuideKit: Syncing staged workflows to backend...");
            // 1. Sync workflows
            const wfResp = await this.withAccessToken((token) => this._apiClient.syncWorkflows(token, this._activeProjectId, payload));
            // 2. Publish Manifest
            const pubResp = await this.withAccessToken((token) => this._apiClient.publishManifest(token, this._activeProjectId));
            this._view?.webview.postMessage({
                type: "publishSuccess",
                version_number: pubResp.version_number,
                etag: pubResp.etag,
                published_features: pubResp.published_features,
                manifest_url: pubResp.manifest_url,
            });
            vscode.window.showInformationMessage(`🎉 GuideKit Manifest v${pubResp.version_number} published successfully! (ETag: ${pubResp.etag})`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Sync & Publish failed: ${err.message}`);
            this._view?.webview.postMessage({
                type: "error",
                message: `Sync & Publish failed: ${err.message}`,
            });
        }
    }
    getTargetWorkspacePath() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            const root = folders[0].uri.fsPath;
            const samplePath = path.join(root, "sample-target-app");
            if (fs.existsSync(samplePath)) {
                return samplePath;
            }
            return root;
        }
        return path.join(this._context.extensionPath, "sample-target-app");
    }
    async runScanner() {
        try {
            const scanDir = this.getTargetWorkspacePath();
            const routes = await (0, routeScanner_1.scanRoutes)(scanDir);
            let totalElements = 0;
            for (const r of routes) {
                const elems = (0, elementExtractor_1.extractElements)(r.filePath);
                totalElements += elems.length;
            }
            const buildResult = (0, flowBuilder_1.buildFlowsFromCodebase)(routes);
            return {
                routesCount: routes.length,
                elementsCount: totalElements,
                flows: buildResult.workflowsPayload.features,
            };
        }
        catch (err) {
            vscode.window.showErrorMessage(`GuideKit Scanner failed: ${err.message}`);
            throw err;
        }
    }
    async runCodemods() {
        try {
            const scanDir = this.getTargetWorkspacePath();
            const routes = await (0, routeScanner_1.scanRoutes)(scanDir);
            const buildResult = (0, flowBuilder_1.buildFlowsFromCodebase)(routes);
            const allSteps = buildResult.workflowsPayload.features.flatMap((f) => f.steps);
            const results = (0, codemodInjector_1.injectGuideIdsAcrossWorkspace)(routes, allSteps);
            return results.filter((r) => r.modified).length;
        }
        catch (err) {
            vscode.window.showErrorMessage(`GuideKit Codemod failed: ${err.message}`);
            throw err;
        }
    }
}
exports.GuideKitSidebarProvider = GuideKitSidebarProvider;
class GuideKitCodeLensProvider {
    provider;
    _onDidChangeCodeLenses = new vscode.EventEmitter();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    constructor(provider) {
        this.provider = provider;
    }
    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
    provideCodeLenses(document) {
        const editor = vscode.window.activeTextEditor || this.provider.getLastActiveEditor();
        if (!editor || editor.document.uri.toString() !== document.uri.toString())
            return [];
        const selection = editor.selection;
        if (!selection)
            return [];
        const flowTitle = this.provider.getActiveFlowTitle();
        const flowSlug = this.provider.getActiveFlowSlug();
        const nextStepOrder = this.provider.getNextStepOrder();
        const range = selection.isEmpty
            ? new vscode.Range(selection.start.line, 0, selection.start.line, 0)
            : new vscode.Range(selection.start, selection.end);
        return [
            new vscode.CodeLens(range, {
                title: `+ Add to flow: "${flowTitle}" (Step ${nextStepOrder})`,
                tooltip: `Add this element as Step ${nextStepOrder} to active flow "${flowTitle}" (Alt+G)`,
                command: "guidekit.addSelectionAsStep",
                arguments: [flowSlug, nextStepOrder],
            }),
        ];
    }
}
class GuideKitCodeActionProvider {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    provideCodeActions(document, range) {
        const flowTitle = this.provider.getActiveFlowTitle();
        const flowSlug = this.provider.getActiveFlowSlug();
        const nextStepOrder = this.provider.getNextStepOrder();
        const action = new vscode.CodeAction(`GuideKit: Add selection to flow "${flowTitle}" (Step ${nextStepOrder})`, vscode.CodeActionKind.Refactor);
        action.command = {
            title: "Take selection to flow",
            command: "guidekit.addSelectionAsStep",
            arguments: [flowSlug, nextStepOrder],
        };
        action.isPreferred = true;
        return [action];
    }
}
function activate(context) {
    const provider = new GuideKitSidebarProvider(context);
    const codeLensProvider = new GuideKitCodeLensProvider(provider);
    const codeActionProvider = new GuideKitCodeActionProvider(provider);
    const takeToFlowDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: "  + Add to flow  ",
            color: "#ffffff",
            backgroundColor: "rgba(82, 169, 255, 0.22)",
            border: "1px solid rgba(82, 169, 255, 0.75)",
            fontWeight: "500",
            fontStyle: "normal",
            margin: "0 0 0 10px",
        },
    });
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "guidekit.addSelectionAsStep";
    statusBarItem.tooltip = "GuideKit: Capture code into active flow (Alt+G)";
    statusBarItem.text = `$(play) GuideKit: Take to Flow`;
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    function updateDecorationsAndStatus() {
        const flowSlug = provider.getActiveFlowSlug();
        const nextOrder = provider.getNextStepOrder();
        statusBarItem.text = `$(play) GuideKit: ${flowSlug} (+${nextOrder})`;
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.scheme === "file") {
            provider.setLastActiveEditor(editor);
            const selection = editor.selection;
            if (!selection.isEmpty) {
                const flowTitle = provider.getActiveFlowTitle();
                const hover = new vscode.MarkdownString(`**GuideKit**: [Add to flow "${flowTitle}"](command:guidekit.addSelectionAsStep) &nbsp;·&nbsp; *(⌥G / Alt+G)*`);
                hover.isTrusted = true;
                editor.setDecorations(takeToFlowDecorationType, [
                    {
                        range: new vscode.Range(selection.end, selection.end),
                        hoverMessage: hover,
                    },
                ]);
                provider.postStudioMessage({
                    type: "activeSelectionChange",
                    hasSelection: true,
                    fileName: path.basename(editor.document.fileName),
                    selectedText: editor.document.getText(selection).slice(0, 35).replace(/\s+/g, " "),
                });
            }
            else {
                editor.setDecorations(takeToFlowDecorationType, []);
                provider.postStudioMessage({
                    type: "activeSelectionChange",
                    hasSelection: false,
                });
            }
        }
        codeLensProvider.refresh();
    }
    provider.onDecorationsRefresh = updateDecorationsAndStatus;
    const supportedLanguages = [
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascriptreact" },
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "html" },
        { scheme: "file", language: "svelte" },
        { scheme: "file", language: "vue" },
    ];
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === "file") {
            provider.setLastActiveEditor(editor);
        }
        updateDecorationsAndStatus();
    }), vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor && e.textEditor.document.uri.scheme === "file") {
            provider.setLastActiveEditor(e.textEditor);
        }
        updateDecorationsAndStatus();
    }), vscode.languages.registerCodeLensProvider(supportedLanguages, codeLensProvider), vscode.languages.registerCodeActionsProvider(supportedLanguages, codeActionProvider), vscode.window.registerWebviewViewProvider(GuideKitSidebarProvider.viewType, provider), vscode.window.registerUriHandler({
        handleUri: async (uri) => {
            if (uri.path !== "/auth-complete")
                return;
            await vscode.commands.executeCommand("guidekit.sidebarView.focus");
            await provider.resumePendingAuth();
        },
    }));
    // Register all commands
    context.subscriptions.push(vscode.commands.registerCommand("guidekit.createNewFlow", () => {
        provider.openStudio("studio");
    }), vscode.commands.registerCommand("guidekit.openStudio", () => {
        provider.openStudio("studio");
    }), vscode.commands.registerCommand("guidekit.openOpenCode", () => {
        provider.openStudio("agent");
    }), vscode.commands.registerCommand("guidekit.addSelectionAsStep", (flowSlug, stepOrder) => {
        provider.captureActiveSelection(flowSlug, stepOrder);
    }), vscode.commands.registerCommand("guidekit.connectAccount", () => {
        provider.startDeviceAuthFlow();
    }), vscode.commands.registerCommand("guidekit.signIn", () => {
        provider.startDeviceAuthFlow();
    }), vscode.commands.registerCommand("guidekit.signOut", () => {
        provider.signOut();
    }), vscode.commands.registerCommand("guidekit.selectProject", () => {
        provider.loadProjects();
    }), vscode.commands.registerCommand("guidekit.scanWorkspace", () => {
        provider.runScanner();
    }), vscode.commands.registerCommand("guidekit.injectGuideIds", () => {
        provider.runCodemods();
    }), vscode.commands.registerCommand("guidekit.syncAndPublish", () => {
        provider.openStudio("studio");
    }));
}
function deactivate() {
    opencodeHarness_1.OpenCodeProcessManager.getInstance().forceStop();
}
//# sourceMappingURL=extension.js.map