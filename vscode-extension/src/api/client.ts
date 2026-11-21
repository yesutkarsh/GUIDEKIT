/**
 * GuideKit API Client for VS Code Extension and CLI Runner.
 * Uses standard fetch API (Node 18+ / VS Code Webview).
 */

export interface DeviceAuthRequestResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface DeviceAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export class GuideKitApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = "GuideKitApiError";
  }
}

const API_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GuideKitApiError(408, "The GuideKit API request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface ProjectSummary {
  id: string;
  org_id?: string;
  name: string;
  slug: string;
  framework: string;
  default_locale: string;
  supported_locales: string[];
  publishable_key?: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface WorkflowSyncPayload {
  features: Array<{
    slug: string;
    content: Record<string, any>;
    example_queries: string[];
    requires_auth?: boolean;
    required_role?: string | null;
    prerequisite_feature_slug?: string | null;
    steps: Array<{
      step_order: number;
      guide_id?: string;
      route_pattern: string;
      action_type: string;
      advance_on: string;
      content: Record<string, any>;
      target_fingerprint: any;
      is_optional?: boolean;
      wait_timeout_ms?: number;
      condition?: Record<string, string> | null;
    }>;
  }>;
}

export interface KnowledgeSyncPayload {
  sources: Array<{
    source_type: "url" | "markdown" | "file" | "code_summary" | "faq";
    title: string;
    uri?: string | null;
    locale?: string;
    chunks: string[];
  }>;
}

export interface ManifestPublishResponse {
  manifest_id: string;
  version_number: number;
  etag: string;
  published_features: number;
  feature_slugs: string[];
  manifest_url: string;
  published_at: string;
}

export class GuideKitApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://127.0.0.1:8000/api/v1") {
    // Strip trailing slash if present
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Request device authorization code flow for CLI / IDE
   */
  async requestDeviceCode(client: string = "vscode_extension"): Promise<DeviceAuthRequestResponse> {
    const res = await fetchWithTimeout(`${this.baseUrl}/device-auth/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Device code request failed (${res.status}): ${err}`);
    }

    return (await res.json()) as DeviceAuthRequestResponse;
  }

  /**
   * Poll for device token approval
   */
  async pollDeviceToken(deviceCode: string): Promise<DeviceAuthTokenResponse | null> {
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
      const data: any = await res.json().catch(() => ({}));
      if (data.detail === "authorization_pending" || data.error === "authorization_pending") {
        return null;
      }
      throw new Error(`Device token error: ${JSON.stringify(data)}`);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Device token polling failed (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    // In GuideKit API, pending poll returns status: "pending" with 200 OK
    if (data.status === "pending") {
      return null;
    }

    if (data.status === "approved" && data.access_token) {
      return data as DeviceAuthTokenResponse;
    }

    if (data.status === "denied" || data.status === "expired" || data.status === "consumed") {
      throw new GuideKitApiError(400, `Device authorization was ${data.status}`, data.status);
    }

    return null;
  }

  /**
   * Helper: Poll device token until approved or expired
   */
  async waitForDeviceToken(
    deviceCode: string,
    intervalSec: number = 2.5,
    maxWaitSec: number = 300,
    onPoll?: (elapsedSec: number) => void
  ): Promise<DeviceAuthTokenResponse> {
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
  async getMe(token: string): Promise<{ developer: { id: string; email: string; display_name?: string } }> {
    const res = await fetchWithTimeout(`${this.baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new GuideKitApiError(res.status, `Session validation failed (${res.status}): ${detail}`);
    }
    return (await res.json()) as { developer: { id: string; email: string; display_name?: string } };
  }

  async refreshSession(refreshToken: string): Promise<TokenPairResponse> {
    const res = await fetchWithTimeout(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      throw new GuideKitApiError(res.status, `Session refresh failed (${res.status})`);
    }
    return (await res.json()) as TokenPairResponse;
  }

  async logout(refreshToken: string): Promise<void> {
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
  async listOrganizations(token: string): Promise<OrganizationSummary[]> {
    const res = await fetchWithTimeout(`${this.baseUrl}/orgs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new GuideKitApiError(res.status, `Failed to list workspaces (${res.status}): ${err}`);
    }

    return (await res.json()) as OrganizationSummary[];
  }

  /**
   * List projects in the active workspace.
   */
  async listProjects(token: string, organizationId?: string): Promise<ProjectSummary[]> {
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

    return (await res.json()) as ProjectSummary[];
  }

  /**
   * Sync extracted workflows and steps to GuideKit DB
   */
  async syncWorkflows(
    token: string,
    projectId: string,
    payload: WorkflowSyncPayload
  ): Promise<{ synced_features: number; draft_versions: any[] }> {
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

    return (await res.json()) as { synced_features: number; draft_versions: any[] };
  }

  /**
   * Sync knowledge documentation / route summaries to GuideKit DB
   */
  async syncKnowledge(
    token: string,
    projectId: string,
    payload: KnowledgeSyncPayload
  ): Promise<{ synced_sources: number; indexed_chunks: number; skipped_sources: number }> {
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

    return (await res.json()) as { synced_sources: number; indexed_chunks: number; skipped_sources: number };
  }

  /**
   * Compile drafts and publish CDN manifest
   */
  async publishManifest(
    token: string,
    projectId: string,
    featureIds?: string[]
  ): Promise<ManifestPublishResponse> {
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

    return (await res.json()) as ManifestPublishResponse;
  }

  /**
   * Fetch public runtime SDK manifest
   */
  async getSdkManifest(
    publishableKey: string,
    origin?: string,
    etag?: string
  ): Promise<{ status: number; etag?: string; manifest?: any }> {
    // Derive SDK endpoint URL (base URL without /v1 if needed, or directly /sdk/manifest)
    // The backend routes /api/v1/sdk/manifest
    const url = `${this.baseUrl}/sdk/manifest`;
    const headers: Record<string, string> = {
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
  async listFeatures(token: string, projectId: string): Promise<any[]> {
    const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/features`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list features (${res.status}): ${err}`);
    }

    return (await res.json()) as any[];
  }

  /**
   * Get single feature with version details
   */
  async getFeature(token: string, projectId: string, featureId: string): Promise<any> {
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
  async deleteFeature(token: string, projectId: string, featureId: string): Promise<void> {
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
  async listKnowledge(token: string, projectId: string): Promise<any[]> {
    const res = await fetchWithTimeout(`${this.baseUrl}/projects/${projectId}/knowledge`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list knowledge (${res.status}): ${err}`);
    }

    return (await res.json()) as any[];
  }

  /**
   * Upload file knowledge (base64 JSON)
   */
  async uploadKnowledgeBase64(
    token: string,
    projectId: string,
    payload: { filename: string; content_base64: string; title?: string }
  ): Promise<{ indexed_chunks: number; source_id: string; title: string }> {
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

    return (await res.json()) as { indexed_chunks: number; source_id: string; title: string };
  }

  /**
   * Index raw text knowledge
   */
  async indexKnowledgeText(
    token: string,
    projectId: string,
    payload: { title: string; content: string; locale?: string }
  ): Promise<{ indexed_chunks: number; source_id: string }> {
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

    return (await res.json()) as { indexed_chunks: number; source_id: string };
  }

  /**
   * Delete knowledge source
   */
  async deleteKnowledge(token: string, projectId: string, sourceId: string): Promise<void> {
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
