/**
 * GuideKit SDK API Client
 */

import {
  ManifestOut,
  SDKChatResponse,
  SDKHealResponse,
  CandidateElement,
} from "../types";

export class GuideKitApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = __GUIDEKIT_DEFAULT_API_URL__) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Fetch manifest with ETag caching
   */
  async fetchManifest(): Promise<ManifestOut | null> {
    const etagKey = `guidekit_manifest_etag_${this.apiKey}`;
    const dataKey = `guidekit_manifest_data_${this.apiKey}`;
    const cachedEtag = localStorage.getItem(etagKey);

    const headers: Record<string, string> = {
      "X-GuideKit-Key": this.apiKey,
    };
    if (cachedEtag) {
      headers["If-None-Match"] = cachedEtag;
    }

    try {
      const res = await fetch(`${this.baseUrl}/sdk/manifest`, {
        method: "GET",
        headers,
      });

      if (res.status === 304) {
        const cachedRaw = localStorage.getItem(dataKey);
        if (cachedRaw) {
          return JSON.parse(cachedRaw) as ManifestOut;
        }
      }

      if (!res.ok) {
        throw new Error(`Manifest fetch failed with status ${res.status}`);
      }

      const newEtag = res.headers.get("ETag");
      const manifest = (await res.json()) as ManifestOut;

      if (newEtag) {
        localStorage.setItem(etagKey, newEtag);
      }
      localStorage.setItem(dataKey, JSON.stringify(manifest));
      return manifest;
    } catch (err) {
      console.warn("[GuideKit] Manifest fetch error, falling back to cache:", err);
      const cachedRaw = localStorage.getItem(dataKey);
      if (cachedRaw) {
        return JSON.parse(cachedRaw) as ManifestOut;
      }
      return null;
    }
  }

  /**
   * Send chat message to runtime router
   */
  async chat(params: {
    visitorId: string;
    sessionId?: string;
    message: string;
    locale?: string;
    currentPath: string;
    authState: { is_logged_in: boolean; role: string | null };
  }): Promise<SDKChatResponse> {
    const res = await fetch(`${this.baseUrl}/sdk/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GuideKit-Key": this.apiKey,
      },
      body: JSON.stringify({
        visitor_id: params.visitorId,
        session_id: params.sessionId,
        message: params.message,
        locale: params.locale || "en",
        current_path: params.currentPath,
        auth_state: params.authState,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat API error (${res.status}): ${err}`);
    }

    return (await res.json()) as SDKChatResponse;
  }

  /**
   * Invoke Tier 3 Cloud AI Self-Healing Resolver
   */
  async heal(params: {
    stepId: string;
    pagePath: string;
    domHash?: string;
    locale?: string;
    candidates: CandidateElement[];
  }): Promise<SDKHealResponse> {
    const res = await fetch(`${this.baseUrl}/sdk/heal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GuideKit-Key": this.apiKey,
      },
      body: JSON.stringify({
        step_id: params.stepId,
        page_path: params.pagePath,
        dom_hash: params.domHash,
        locale: params.locale || "en",
        candidates: params.candidates,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Heal API error (${res.status}): ${err}`);
    }

    return (await res.json()) as SDKHealResponse;
  }

  /**
   * Send batched telemetry events
   */
  async sendEvents(batch: {
    sessionId?: string;
    tourEvents: any[];
    resolutionLogs: any[];
  }): Promise<void> {
    if (batch.tourEvents.length === 0 && batch.resolutionLogs.length === 0) return;

    try {
      await fetch(`${this.baseUrl}/sdk/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GuideKit-Key": this.apiKey,
        },
        body: JSON.stringify({
          session_id: batch.sessionId,
          tour_events: batch.tourEvents,
          resolution_logs: batch.resolutionLogs,
        }),
      });
    } catch (err) {
      console.warn("[GuideKit] Failed to flush telemetry batch:", err);
    }
  }
}

