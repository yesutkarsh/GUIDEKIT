"use strict";
/**
 * GuideKit API Client for VS Code Extension and CLI Runner.
 * Uses standard fetch API (Node 18+ / VS Code Webview).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuideKitApiClient = exports.GuideKitApiError = void 0;
class GuideKitApiError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "GuideKitApiError";
    }
}
exports.GuideKitApiError = GuideKitApiError;
const API_TIMEOUT_MS = 10_000;
async function fetchWithTimeout(input, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new GuideKitApiError(408, "The GuideKit API request timed out");
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
class GuideKitApiClient {
    baseUrl;
    constructor(baseUrl = "http://127.0.0.1:8000/api/v1") {
        // Strip trailing slash if present
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }
    /**
     * Request device authorization code flow for CLI / IDE
     */
    async requestDeviceCode(client = "vscode_extension") {
        const res = await fetchWithTimeout(`${this.baseUrl}/device-auth/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Device code request failed (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Poll for device token approval
     */
    async pollDeviceToken(deviceCode) {
        const res = await fetchWithTimeout(`${this.baseUrl}/device-auth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_code: deviceCode }),
        });
        if (res.status === 429) {
            return null;
        }
        if (res.status === 400) {
            // Authorization pending or slow down
            const data = await res.json().catch(() => ({}));
            if (data.detail === "authorization_pending" || data.error === "authorization_pending") {
                return null;
            }
            throw new Error(`Device token error: ${JSON.stringify(data)}`);
        }
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Device token polling failed (${res.status}): ${err}`);
        }
        const data = await res.json();
        // In GuideKit API, pending poll returns status: "pending" with 200 OK
        if (data.status === "pending") {
            return null;
        }
        if (data.status === "approved" && data.access_token) {
            return data;
        }
        if (data.status === "denied" || data.status === "expired" || data.status === "consumed") {
            throw new GuideKitApiError(400, `Device authorization was ${data.status}`, data.status);
        }
        return null;
    }
    /**
     * Helper: Poll device token until approved or expired
     */
    async waitForDeviceToken(deviceCode, intervalSec = 2.5, maxWaitSec = 300, onPoll) {
        const startTime = Date.now();
        while ((Date.now() - startTime) / 1000 < maxWaitSec) {
            onPoll?.(Math.round((Date.now() - startTime) / 1000));
            const result = await this.pollDeviceToken(deviceCode);
            if (result && result.access_token) {
                return result;
            }
            await new Promise((r) => setTimeout(r, intervalSec * 1000));
        }
        throw new Error("Device code authorization timed out");
    }
    /**
     * Fetch authenticated developer profile
     */
    async getMe(token) {
        const res = await fetchWithTimeout(`${this.baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const detail = await res.text();
            throw new GuideKitApiError(res.status, `Session validation failed (${res.status}): ${detail}`);
        }
        return (await res.json());
    }
    async refreshSession(refreshToken) {
        const res = await fetchWithTimeout(`${this.baseUrl}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
            throw new GuideKitApiError(res.status, `Session refresh failed (${res.status})`);
        }
        return (await res.json());
    }
    async logout(refreshToken) {
        const res = await fetchWithTimeout(`${this.baseUrl}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok && res.status !== 204) {
            throw new GuideKitApiError(res.status, `Session revocation failed (${res.status})`);
        }
    }
    /**
     * List workspaces available to the developer.
     */
    async listOrganizations(token) {
        const res = await fetchWithTimeout(`${this.baseUrl}/orgs`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new GuideKitApiError(res.status, `Failed to list workspaces (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * List projects in the active workspace.
     */
    async listProjects(token, organizationId) {
        const query = organizationId ? `?org_id=${encodeURIComponent(organizationId)}` : "";
        const res = await fetchWithTimeout(`${this.baseUrl}/projects${query}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new GuideKitApiError(res.status, `Failed to list projects (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Sync extracted workflows and steps to GuideKit DB
     */
    async syncWorkflows(token, projectId, payload) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/workflows/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Workflow sync failed (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Sync knowledge documentation / route summaries to GuideKit DB
     */
    async syncKnowledge(token, projectId, payload) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Knowledge sync failed (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Compile drafts and publish CDN manifest
     */
    async publishManifest(token, projectId, featureIds) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/publish`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(featureIds ? { feature_ids: featureIds } : {}),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Publish manifest failed (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Fetch public runtime SDK manifest
     */
    async getSdkManifest(publishableKey, origin, etag) {
        // Derive SDK endpoint URL (base URL without /v1 if needed, or directly /sdk/manifest)
        // The backend routes /api/v1/sdk/manifest
        const url = `${this.baseUrl}/sdk/manifest`;
        const headers = {
            "X-GuideKit-Key": publishableKey,
        };
        if (origin) {
            headers["Origin"] = origin;
        }
        if (etag) {
            headers["If-None-Match"] = etag;
        }
        const res = await fetchWithTimeout(url, { headers });
        if (res.status === 304) {
            return { status: 304, etag };
        }
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`SDK Manifest request failed (${res.status}): ${err}`);
        }
        const resEtag = res.headers.get("ETag") || undefined;
        const manifest = await res.json();
        return { status: res.status, etag: resEtag, manifest };
    }
    /**
     * List all features/workflows for a project
     */
    async listFeatures(token, projectId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/features`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to list features (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Get single feature with version details
     */
    async getFeature(token, projectId, featureId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/features/${featureId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to get feature (${res.status}): ${err}`);
        }
        return await res.json();
    }
    /**
     * Delete / archive a feature
     */
    async deleteFeature(token, projectId, featureId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/features/${featureId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to delete feature (${res.status}): ${err}`);
        }
    }
    /**
     * List indexed knowledge sources
     */
    async listKnowledge(token, projectId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to list knowledge (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Upload file knowledge (base64 JSON)
     */
    async uploadKnowledgeBase64(token, projectId, payload) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge/upload-json`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to upload knowledge (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Index raw text knowledge
     */
    async indexKnowledgeText(token, projectId, payload) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge/text`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to index text knowledge (${res.status}): ${err}`);
        }
        return (await res.json());
    }
    /**
     * Delete knowledge source
     */
    async deleteKnowledge(token, projectId, sourceId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge/${sourceId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to delete knowledge source (${res.status}): ${err}`);
        }
    }
}
exports.GuideKitApiClient = GuideKitApiClient;
//# sourceMappingURL=client.js.map