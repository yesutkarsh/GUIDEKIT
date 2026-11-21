/**
 * Batched Telemetry Queue for GuideKit SDK
 */

import { GuideKitApiClient } from "./apiClient";
import { ResolutionStatus } from "../types";

export interface QueuedTourEvent {
  feature_version_id?: string;
  step_id?: string;
  event_type: "started" | "step_shown" | "step_completed" | "completed" | "exited" | "failed";
}

export interface QueuedResolutionLog {
  step_id: string;
  status: ResolutionStatus;
  resolution_ms?: number;
  page_path?: string;
  dom_hash?: string;
  detected_dom_selector?: string;
}

export class TelemetryQueue {
  private client: GuideKitApiClient;
  private tourEvents: QueuedTourEvent[] = [];
  private resolutionLogs: QueuedResolutionLog[] = [];
  private sessionId?: string;
  private flushTimer: any = null;

  constructor(client: GuideKitApiClient, sessionId?: string) {
    this.client = client;
    this.sessionId = sessionId;
    this.startPeriodicFlush();

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush();
        }
      });
    }
  }

  public setSessionId(id: string) {
    this.sessionId = id;
  }

  public trackTourEvent(event: QueuedTourEvent) {
    this.tourEvents.push(event);
    if (this.tourEvents.length >= 10) {
      this.flush();
    }
  }

  public trackResolution(log: QueuedResolutionLog) {
    this.resolutionLogs.push(log);
    if (this.resolutionLogs.length >= 10) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.tourEvents.length === 0 && this.resolutionLogs.length === 0) return;

    const toSendEvents = [...this.tourEvents];
    const toSendLogs = [...this.resolutionLogs];
    this.tourEvents = [];
    this.resolutionLogs = [];

    await this.client.sendEvents({
      sessionId: this.sessionId,
      tourEvents: toSendEvents,
      resolutionLogs: toSendLogs,
    });
  }

  private startPeriodicFlush() {
    if (typeof window === "undefined") return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, 4000);
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

