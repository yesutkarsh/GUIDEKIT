/**
 * GuideKit Universal Web SDK Entry Point
 */

import {
  GuideKitConfig,
  GuideKitWidgetOptions,
  ManifestOut,
  TourPlan,
  ActiveTourState,
  SDKChatResponse,
} from "./types";
import { GuideKitApiClient } from "./network/apiClient";
import { TelemetryQueue } from "./network/telemetryQueue";
import { DriverController } from "./spotlight/driverController";
import { resolveStepElement } from "./resolver/domResolver";
import { GuideKitWidgetElement } from "./ui/widgetElement";
import {
  getOrCreateVisitorId,
  getSavedSessionId,
  saveSessionId,
  getSavedLocale,
  saveLocale,
  getActiveTour,
  saveActiveTour,
  clearActiveTour,
  updateTourStepIndex,
} from "./state/sessionStore";
import { detectAuthState, getCurrentPagePath } from "./state/authDetector";

// Register custom element
if (typeof customElements !== "undefined" && !customElements.get("guidekit-widget")) {
  customElements.define("guidekit-widget", GuideKitWidgetElement);
}

export class GuideKitSDK {
  private config: GuideKitConfig = { apiKey: "" };
  private apiClient?: GuideKitApiClient;
  private telemetry?: TelemetryQueue;
  private driver?: DriverController;
  private widgetEl?: GuideKitWidgetElement;
  private manifest: ManifestOut | null = null;
  private visitorId: string = "vis_guest";
  private sessionId?: string;
  private locale: string = "en";
  private isInitialized: boolean = false;

  constructor() {
    this.driver = new DriverController();
  }

  /**
   * Initialize SDK with explicit config or auto-discovered environment
   */
  public async init(userConfig?: Partial<GuideKitConfig>): Promise<void> {
    if (typeof window === "undefined") return;

    // 1. Resolve configuration from parameters, script tags, or globals
    const resolvedConfig = this.discoverConfig(userConfig);
    if (!resolvedConfig.apiKey) {
      console.warn(
        "[GuideKit] No API key provided or found. Set data-guidekit-key on the script tag or call GuideKit.init({ apiKey: '...' })"
      );
      return;
    }

    this.config = resolvedConfig;
    this.visitorId = getOrCreateVisitorId();
    this.sessionId = getSavedSessionId();
    this.locale = resolvedConfig.locale || getSavedLocale("en");

    this.apiClient = new GuideKitApiClient(this.config.apiKey, this.config.apiUrl);
    this.telemetry = new TelemetryQueue(this.apiClient, this.sessionId);

    // 2. Mount Shadow DOM Chat Widget
    this.mountWidget();

    // 3. Fetch & cache manifest
    try {
      this.manifest = await this.apiClient.fetchManifest();
      if (this.manifest && this.widgetEl) {
        this.widgetEl.setManifest(this.manifest);
      }
    } catch (err) {
      console.warn("[GuideKit] Failed to load manifest:", err);
    }

    // 4. Bind route change listeners
    this.bindRouteListeners();

    this.isInitialized = true;

    // 5. Resume active tour if persisted in sessionStorage
    const savedTour = getActiveTour();
    if (savedTour && savedTour.status === "running") {
      this.resumeActiveTour(savedTour);
    }
  }

  /**
   * Auto-discover API key and settings from script tags or globals
   */
  private discoverConfig(userConfig?: Partial<GuideKitConfig>): GuideKitConfig {
    let apiKey = userConfig?.apiKey || "";
    let apiUrl = userConfig?.apiUrl || __GUIDEKIT_DEFAULT_API_URL__;
    let locale = userConfig?.locale || "en";

    if (typeof document !== "undefined") {
      // Look for current script data attributes
      const script = document.querySelector<HTMLScriptElement>("script[data-guidekit-key]");
      if (script) {
        apiKey = apiKey || script.getAttribute("data-guidekit-key") || "";
        apiUrl = script.getAttribute("data-api-url") || apiUrl;
        locale = script.getAttribute("data-locale") || locale;
      }
    }

    // Check window globals
    if (typeof window !== "undefined") {
      const g = (window as any).GUIDEKIT_CONFIG;
      if (g) {
        apiKey = apiKey || g.apiKey;
        apiUrl = g.apiUrl || apiUrl;
        locale = g.locale || locale;
      }
    }

    return {
      apiKey,
      apiUrl,
      locale,
      debug: userConfig?.debug,
      widget: userConfig?.widget || (typeof window !== "undefined" ? (window as any).GUIDEKIT_CONFIG?.widget : undefined),
    };
  }

  private mountWidget() {
    if (typeof document === "undefined") return;

    let el = document.querySelector<GuideKitWidgetElement>("guidekit-widget");
    if (!el) {
      el = document.createElement("guidekit-widget") as GuideKitWidgetElement;
      document.body.appendChild(el);
    }

    this.widgetEl = el;
    this.widgetEl.init(this.manifest, this.locale, {
      onSendMessage: (msg) => this.sendMessage(msg),
      onStartTour: (plan) => this.startTour(plan),
      onStopTour: () => this.endTour(),
      onLocaleChange: (loc) => {
        this.locale = loc;
        saveLocale(loc);
      },
    }, this.config.widget);
  }

  /** Update widget presentation without remounting the SDK. */
  public configureWidget(options: GuideKitWidgetOptions): void {
    this.config.widget = {
      ...this.config.widget,
      ...options,
      theme: {
        ...this.config.widget?.theme,
        ...options.theme,
      },
    };
    this.widgetEl?.setOptions(this.config.widget);
  }

  public openWidget(): void {
    this.widgetEl?.open();
  }

  public closeWidget(): void {
    this.widgetEl?.close();
  }

  private bindRouteListeners() {
    if (typeof window === "undefined") return;

    const handleRouteChange = () => {
      const currentPath = getCurrentPagePath();
      this.notifyRouteChange(currentPath);
    };

    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("guidekit:route-change", handleRouteChange);

    // Patch history pushState to detect client-side route changes
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleRouteChange();
    };
  }

  /**
   * Start an interactive tour from a TourPlan
   */
  public async startTour(tourPlan: TourPlan): Promise<void> {
    if (!tourPlan || !tourPlan.steps || tourPlan.steps.length === 0) return;

    const state: ActiveTourState = {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      locale: this.locale,
      tourPlan,
      currentStepIndex: 0,
      status: "running",
    };

    saveActiveTour(state);
    this.widgetEl?.setActiveTourProgress(tourPlan.target_feature_slug);
    this.widgetEl?.close();

    this.telemetry?.trackTourEvent({
      event_type: "started",
    });

    await this.executeCurrentTourStep(state);
  }

  private async resumeActiveTour(state: ActiveTourState) {
    this.widgetEl?.setActiveTourProgress(state.tourPlan.target_feature_slug);
    await this.executeCurrentTourStep(state);
  }

  /**
   * Execute current step in active tour
   */
  private async executeCurrentTourStep(state: ActiveTourState): Promise<void> {
    const steps = state.tourPlan.steps;
    const idx = state.currentStepIndex;

    if (idx >= steps.length) {
      this.completeTour(state);
      return;
    }

    const step = steps[idx];
    const currentPath = getCurrentPagePath();

    // Check if the current page matches the step's route pattern
    const pattern = step.route_pattern;
    const matchesRoute = pattern === "*" || pattern === currentPath || currentPath.startsWith(pattern);

    if (!matchesRoute) {
      // 1. Try auto-navigating if the host app provides a route trigger
      const navTrigger = document.querySelector<HTMLElement>(
        `[data-route="${pattern}"], a[href="${pattern}"], [data-route="${pattern.replace(/^\//, "")}"]`
      );
      if (navTrigger) {
        navTrigger.click();
        setTimeout(() => {
          this.executeCurrentTourStep(state);
        }, 250);
        return;
      }

      // 2. Otherwise reopen widget with guidance so user is informed
      this.widgetEl?.open();
      this.widgetEl?.addAssistantMessage(
        `Step ${idx + 1} requires visiting **${pattern}**. Please navigate there to continue the tour.`
      );
      return;
    }

    if (!this.apiClient || !this.telemetry) return;

    // Resolve target element using 4-Tier Ladder
    const resolved = await resolveStepElement(step, this.apiClient, this.telemetry, this.locale);

    if (resolved.element) {
      this.telemetry.trackTourEvent({
        step_id: step.step_id,
        event_type: "step_shown",
      });

      this.driver?.highlight(
        resolved.element,
        step,
        steps.length,
        resolved.status,
        this.locale,
        {
          onNext: () => this.advanceStep(state, 1),
          onPrev: () => this.advanceStep(state, -1),
          onClose: () => this.endTour(state),
          onStepCompleted: () => {
            this.telemetry?.trackTourEvent({
              step_id: step.step_id,
              event_type: "step_completed",
            });
          },
        }
      );
    } else {
      // Tier 4: Fallback to chat widget text card
      this.driver?.destroy();
      this.widgetEl?.showTier4FallbackCard(step, () => {
        this.advanceStep(state, 1);
      });
    }
  }

  private advanceStep(state: ActiveTourState, delta: number) {
    const nextIdx = state.currentStepIndex + delta;
    if (nextIdx < 0) return;

    if (nextIdx >= state.tourPlan.steps.length) {
      this.completeTour(state);
    } else {
      const updated = updateTourStepIndex(nextIdx);
      if (updated) {
        this.executeCurrentTourStep(updated);
      }
    }
  }

  public completeTour(state: ActiveTourState) {
    this.driver?.destroy();
    clearActiveTour();
    this.widgetEl?.setActiveTourProgress(null);
    this.widgetEl?.addAssistantMessage(
      `🎉 Tour completed! You've successfully finished '${state.tourPlan.target_feature_slug}'.`
    );
    this.telemetry?.trackTourEvent({
      event_type: "completed",
    });
  }

  public endTour(state?: ActiveTourState) {
    this.driver?.destroy();
    clearActiveTour();
    this.widgetEl?.setActiveTourProgress(null);
    this.telemetry?.trackTourEvent({
      event_type: "exited",
    });
  }

  /**
   * Send user message to runtime chat router
   */
  public async sendMessage(message: string): Promise<SDKChatResponse | void> {
    if (!this.apiClient) return;

    const currentPath = getCurrentPagePath();
    const authState = detectAuthState(this.manifest?.auth_detection_config);

    const resp = await this.apiClient.chat({
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      message,
      locale: this.locale,
      currentPath,
      authState,
    });

    if (resp.session_id) {
      this.sessionId = resp.session_id;
      saveSessionId(resp.session_id);
      this.telemetry?.setSessionId(resp.session_id);
    }

    return resp;
  }

  /**
   * Notify SDK that route has changed
   */
  public notifyRouteChange(newPath?: string): void {
    const saved = getActiveTour();
    if (saved && saved.status === "running") {
      this.executeCurrentTourStep(saved);
    }
  }

  public getManifest(): ManifestOut | null {
    return this.manifest;
  }

  public getTourState(): ActiveTourState | null {
    return getActiveTour();
  }
}

// Global Singleton Instance
export const GuideKit = new GuideKitSDK();

if (typeof window !== "undefined") {
  (window as any).GuideKit = GuideKit;

  // Auto-init on DOMContentLoaded if script tag has config
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      GuideKit.init();
    });
  } else {
    GuideKit.init();
  }
}

export default GuideKit;

