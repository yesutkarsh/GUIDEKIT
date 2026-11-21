/**
 * Custom Element: <guidekit-widget>
 * Tailwind-powered, themeable Shadow DOM guide widget.
 */

import type {
  GuideKitWidgetOptions,
  GuideKitWidgetPosition,
  GuideKitWidgetTheme,
  ManifestOut,
  SDKChatResponse,
  StitchedWorkflowStep,
  TourPlan,
} from "../types";
import WIDGET_SHADOW_STYLES from "./widget.css?inline";

export interface WidgetCallbacks {
  onSendMessage: (message: string) => Promise<SDKChatResponse | void>;
  onStartTour: (tourPlan: TourPlan) => void;
  onStopTour: () => void;
  onLocaleChange: (locale: string) => void;
  onAdvanceFallbackStep?: () => void;
}

type ResolvedWidgetTheme = Required<GuideKitWidgetTheme>;
type ResolvedWidgetOptions = Required<Omit<GuideKitWidgetOptions, "theme" | "greeting" | "placeholder">> & {
  greeting?: string;
  placeholder?: string;
  theme: ResolvedWidgetTheme;
};

const DEFAULT_THEME: ResolvedWidgetTheme = {
  accent: "#52a9ff",
  accentHover: "#75bbef",
  accentText: "#07111d",
  canvas: "rgba(15, 18, 23, 0.96)",
  surface: "#1d222b",
  surfaceHover: "#252b35",
  border: "rgba(255, 255, 255, 0.09)",
  text: "#f1f4f9",
  mutedText: "#b8c0ce",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const DEFAULT_OPTIONS: ResolvedWidgetOptions = {
  position: "bottom-center",
  bottomOffset: 24,
  sideOffset: 16,
  panelWidth: 420,
  panelHeight: 560,
  borderRadius: 24,
  launcherLabel: "Ask Guide",
  assistantName: "",
  maxSuggestions: 3,
  showLocaleControl: true,
  showVoiceControl: false,
  soundEnabled: true,
  greeting: undefined,
  placeholder: undefined,
  theme: DEFAULT_THEME,
};

const icon = {
  chat: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px] shrink-0" stroke="currentColor" stroke-width="1.8">
      <path d="M7.2 18.2 4 20l.9-3.7A7.5 7.5 0 1 1 7.2 18.2Z"></path>
      <path d="M8.5 11.8h.01M12 11.8h.01M15.5 11.8h.01" stroke-linecap="round" stroke-width="2.4"></path>
    </svg>`,
  minimize: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="1.8">
      <path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`,
  stop: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="1.8">
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5"></rect>
    </svg>`,
  send: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="2">
      <path d="M12 18V6m-5 5 5-5 5 5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`,
  volume: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="1.8">
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"></path>
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10"></path>
    </svg>`,
  volumeOff: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-[18px] w-[18px]" stroke="currentColor" stroke-width="1.8">
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"></path>
      <path d="m16 10 5 5m0-5-5 5"></path>
    </svg>`,
  arrow: `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="h-4 w-4" stroke="currentColor" stroke-width="1.8">
      <path d="M5 12h14m-5-5 5 5-5 5"></path>
    </svg>`,
};

const focusClasses =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gk-canvas)]";

const assistantBubbleClasses =
  "bubble-assistant rounded-[20px] rounded-bl-md bg-[var(--gk-surface)] px-4 py-3 text-[13px] leading-[1.55] text-[var(--gk-text)] shadow-[0_1px_0_rgba(255,255,255,0.035)_inset]";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatMessage = (value: string): string => escapeHtml(value).replaceAll("\n", "<br>");

const clamp = (value: number | undefined, min: number, max: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
};

const isPosition = (value: unknown): value is GuideKitWidgetPosition =>
  value === "bottom-center" || value === "bottom-left" || value === "bottom-right";

export class GuideKitWidgetElement extends HTMLElement {
  private shadow: ShadowRoot;
  private isOpen = false;
  private isSending = false;
  private locale = "en";
  private ttsEnabled = false;
  private manifest: ManifestOut | null = null;
  private callbacks?: WidgetCallbacks;
  private activeTourTitle: string | null = null;
  private options: ResolvedWidgetOptions = DEFAULT_OPTIONS;
  private transitionNonce = 0;
  private closeTimer: number | null = null;
  private audioContext: AudioContext | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.applyTheme();
    this.render();
  }

  disconnectedCallback() {
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
  }

  public init(
    manifest: ManifestOut | null,
    locale: string,
    callbacks: WidgetCallbacks,
    options?: GuideKitWidgetOptions
  ) {
    this.manifest = manifest;
    this.locale = locale;
    this.callbacks = callbacks;
    this.setOptions(options || {});
  }

  public setOptions(options: GuideKitWidgetOptions) {
    const position = isPosition(options.position) ? options.position : this.options.position;
    this.options = {
      ...this.options,
      ...options,
      position,
      bottomOffset: clamp(options.bottomOffset, 12, 96, this.options.bottomOffset),
      sideOffset: clamp(options.sideOffset, 12, 96, this.options.sideOffset),
      panelWidth: clamp(options.panelWidth, 320, 560, this.options.panelWidth),
      panelHeight: clamp(options.panelHeight, 420, 760, this.options.panelHeight),
      borderRadius: clamp(options.borderRadius, 12, 28, this.options.borderRadius),
      maxSuggestions: clamp(options.maxSuggestions, 0, 5, this.options.maxSuggestions),
      theme: {
        ...this.options.theme,
        ...options.theme,
      },
    };
    this.applyTheme();
    this.render();
  }

  public setLocale(locale: string) {
    this.locale = locale;
    this.render();
  }

  public setManifest(manifest: ManifestOut) {
    this.manifest = manifest;
    this.render();
  }

  public setActiveTourProgress(title: string | null) {
    this.activeTourTitle = title;
    this.render();
  }

  public open() {
    this.transitionNonce += 1;
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.isOpen = true;
    this.render();
    const input = this.shadow.querySelector<HTMLInputElement>(".chat-input");
    window.setTimeout(() => input?.focus(), this.prefersReducedMotion() ? 0 : 180);
  }

  public close() {
    if (!this.isOpen) return;

    const panel = this.shadow.querySelector<HTMLElement>(".chat-panel");
    const nonce = ++this.transitionNonce;
    const finish = () => {
      if (nonce !== this.transitionNonce) return;
      if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
      this.isOpen = false;
      this.render();
      window.setTimeout(() => this.shadow.querySelector<HTMLButtonElement>("#gk-launcher")?.focus(), 0);
    };

    if (!panel || this.prefersReducedMotion()) {
      finish();
      return;
    }

    panel.setAttribute("inert", "");
    panel.classList.remove("gk-panel-opening");
    panel.classList.add("gk-panel-closing");
    panel.addEventListener(
      "animationend",
      (event) => {
        if (event.target === panel) finish();
      },
      { once: true }
    );
    this.closeTimer = window.setTimeout(finish, 240);
  }

  public toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  public addAssistantMessage(
    text: string,
    options?: {
      tourPlan?: TourPlan | null;
      suggestedTourPlan?: TourPlan | null;
      isPrereq?: boolean;
      isError?: boolean;
    }
  ) {
    const stream = this.shadow.querySelector(".messages-area");
    if (!stream) return;

    const row = document.createElement("div");
    row.className = "msg-row msg-assistant flex max-w-[92%] flex-col gap-2 self-start";

    const bubbleRole = options?.isError ? ' role="alert"' : "";
    const errorClasses = options?.isError ? " bg-red-950/45 text-red-100" : "";
    let html = `
      <div class="flex items-end gap-2">
        <span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${icon.chat}</span>
        <div${bubbleRole} class="${assistantBubbleClasses}${errorClasses}">${formatMessage(text)}</div>
      </div>`;
    const btnId = Date.now() + Math.random().toString(36).substring(2, 7);

    if (options?.tourPlan) {
      const plan = options.tourPlan;
      html += `
        <div class="card-tour-stitch ml-9 rounded-2xl bg-[var(--gk-surface)] p-3">
          ${
            plan.requires_login_first
              ? `<div class="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] leading-4 text-amber-200"><strong class="font-medium">Sign-in required.</strong> The guide will begin with authentication.</div>`
              : ""
          }
          <p class="mb-3 text-[11px] leading-4 text-[var(--gk-muted)]">${plan.steps.length} guided ${plan.steps.length === 1 ? "step" : "steps"} ready</p>
          <button class="btn-start-tour ${focusClasses} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gk-accent)] px-4 text-xs font-medium text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px" id="btn-start-tour-${btnId}" type="button">
            Start guided tour ${icon.arrow}
          </button>
        </div>
      `;
    } else if (options?.suggestedTourPlan && options.suggestedTourPlan.steps.length > 0) {
      const plan = options.suggestedTourPlan;
      html += `
        <div class="card-tour-stitch ml-9 rounded-2xl bg-[var(--gk-surface)] p-3">
          <p class="mb-3 text-[11px] leading-4 text-[var(--gk-muted)]">A guided walkthrough is available for this feature.</p>
          <button class="btn-start-tour ${focusClasses} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gk-accent)] px-4 text-xs font-medium text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px" id="btn-suggested-tour-${btnId}" type="button">
            Show me on screen ${icon.arrow}
          </button>
        </div>
      `;
    }

    row.innerHTML = html;
    stream.appendChild(row);
    stream.scrollTop = stream.scrollHeight;

    if (this.ttsEnabled && !options?.isError) this.speak(text);

    if (options?.tourPlan) {
      row.querySelector(`#btn-start-tour-${btnId}`)?.addEventListener("click", () => {
        this.callbacks?.onStartTour(options.tourPlan!);
      });
    } else if (options?.suggestedTourPlan) {
      row.querySelector(`#btn-suggested-tour-${btnId}`)?.addEventListener("click", () => {
        this.callbacks?.onStartTour(options.suggestedTourPlan!);
      });
    }
  }

  public showTier4FallbackCard(step: StitchedWorkflowStep, onContinue: () => void) {
    this.open();
    const stream = this.shadow.querySelector(".messages-area");
    if (!stream) return;

    const content = step.content || {};
    const localized = content[this.locale] || content.en || {};
    const title = localized.title || step.guide_id || "Action required";
    const description = localized.description || `Continue on ${step.route_pattern}`;
    const buttonId = `btn-continue-step-${Date.now()}`;

    const row = document.createElement("div");
    row.className = "msg-row msg-assistant ml-9 flex max-w-[82%] flex-col self-start";
    row.innerHTML = `
      <div class="rounded-2xl bg-amber-950/30 p-3.5">
        <p class="text-[11px] font-medium text-amber-300">Step ${step.execution_index} · Text guidance</p>
        <p class="mt-2 text-sm font-medium text-[var(--gk-text)]">${escapeHtml(String(title))}</p>
        <p class="mt-1 text-xs leading-5 text-[var(--gk-muted)]">${escapeHtml(String(description))}</p>
        <button class="btn-start-tour ${focusClasses} mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-200 active:translate-y-px" id="${buttonId}" type="button">
          Continue ${icon.arrow}
        </button>
      </div>
    `;

    stream.appendChild(row);
    stream.scrollTop = stream.scrollHeight;
    if (this.ttsEnabled) this.speak(`${title}. ${description}`);
    row.querySelector(`#${buttonId}`)?.addEventListener("click", onContinue);
  }

  private applyTheme() {
    const variables: Record<string, string> = {
      "--gk-accent": this.options.theme.accent,
      "--gk-accent-hover": this.options.theme.accentHover,
      "--gk-accent-text": this.options.theme.accentText,
      "--gk-canvas": this.options.theme.canvas,
      "--gk-surface": this.options.theme.surface,
      "--gk-surface-hover": this.options.theme.surfaceHover,
      "--gk-border": this.options.theme.border,
      "--gk-text": this.options.theme.text,
      "--gk-muted": this.options.theme.mutedText,
      "--gk-font-family": this.options.theme.fontFamily,
      "--gk-bottom-offset": `${this.options.bottomOffset}px`,
      "--gk-side-offset": `${this.options.sideOffset}px`,
      "--gk-panel-width": `${this.options.panelWidth}px`,
      "--gk-panel-max-width": `calc(100vw - ${this.options.sideOffset * 2}px)`,
      "--gk-panel-height": `${this.options.panelHeight}px`,
      "--gk-radius": `${this.options.borderRadius}px`,
    };

    Object.entries(variables).forEach(([property, value]) => this.style.setProperty(property, value));
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private playSendTick() {
    if (!this.options.soundEnabled || typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const context = this.audioContext || new AudioContextClass();
      this.audioContext = context;

      const play = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(760, now);
        oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.05);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.028, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.065);
        oscillator.addEventListener("ended", () => {
          oscillator.disconnect();
          gain.disconnect();
        });
      };

      if (context.state === "suspended") {
        void context.resume().then(play).catch(() => undefined);
      } else {
        play();
      }
    } catch {
      // Audio feedback is optional; messaging must continue if Web Audio is unavailable.
    }
  }

  private speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.locale === "hi" ? "hi-IN" : this.locale;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice is an optional enhancement; visual guidance remains available.
    }
  }

  private getPositionClass(): string {
    if (this.options.position === "bottom-left") return "justify-start";
    if (this.options.position === "bottom-right") return "justify-end";
    return "justify-center";
  }

  private getProjectName(): string {
    if (this.options.assistantName) return this.options.assistantName;
    if (!this.manifest?.project_slug) return "GuideKit";
    return this.manifest.project_slug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private getGreeting(): string {
    if (this.options.greeting) return this.options.greeting;
    if (this.locale === "hi") return "नमस्ते। किसी सुविधा के बारे में पूछें या नीचे दिए गए गाइड में से चुनें।";
    return "Ask how to use this page, or choose a suggested guide below.";
  }

  private getPlaceholder(): string {
    if (this.options.placeholder) return this.options.placeholder;
    return this.locale === "hi" ? "गाइडकिट को संदेश भेजें…" : "Message GuideKit…";
  }

  private stopTour() {
    const stoppedTour = this.activeTourTitle;
    this.callbacks?.onStopTour();
    if (this.activeTourTitle) {
      this.activeTourTitle = null;
      this.render();
    }
    if (this.isOpen && stoppedTour) {
      this.addAssistantMessage("Tour stopped. You can ask me anything else about this page.");
    }
  }

  private render() {
    const projectName = this.getProjectName();
    const supportedLocales = this.manifest?.supported_locales || [this.locale];
    const showLocaleControl = this.options.showLocaleControl && supportedLocales.length > 1;
    const chips = (this.manifest?.features || [])
      .slice(0, this.options.maxSuggestions)
      .map((feature) => {
        const title = feature.content?.[this.locale]?.title || feature.content?.en?.title || feature.slug;
        const query = feature.example_queries?.[0] || `How do I ${title}?`;
        return { label: title, query };
      });

    this.shadow.innerHTML = `
      <style>${WIDGET_SHADOW_STYLES}</style>
      <div class="gk-root pointer-events-none fixed inset-x-0 z-[2147483640] flex ${this.getPositionClass()}">
        ${
          !this.isOpen
            ? this.activeTourTitle
              ? `
                <div class="tour-dock gk-launcher-opening pointer-events-auto flex max-w-[min(360px,var(--gk-panel-max-width))] items-center gap-1 rounded-[20px] bg-[var(--gk-canvas)] p-1.5 text-[var(--gk-text)] shadow-[0_18px_55px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
                  <button
                    class="${focusClasses} flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[15px] px-3 text-left transition-[background-color,transform] hover:bg-[var(--gk-surface)] active:translate-y-px"
                    id="gk-launcher"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Continue ${escapeHtml(this.activeTourTitle)}"
                  >
                    <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)]">${icon.chat}</span>
                    <span class="min-w-0">
                      <span class="block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--gk-muted)]">Tour in progress</span>
                      <span class="launcher-text block truncate text-[13px] font-medium text-[var(--gk-text)]">${escapeHtml(this.activeTourTitle)}</span>
                    </span>
                  </button>
                  <button class="${focusClasses} grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[var(--gk-muted)] transition-colors hover:bg-red-400/10 hover:text-red-300" id="gk-stop-tour-compact" type="button" aria-label="Stop tour" title="Stop tour">${icon.stop}</button>
                </div>
              `
              : `
                <button
                  class="launcher-pill gk-launcher-opening ${focusClasses} pointer-events-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--gk-canvas)] text-[var(--gk-accent)] shadow-[0_18px_55px_rgba(0,0,0,0.52)] backdrop-blur-2xl transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[var(--gk-surface)] active:translate-y-0"
                  id="gk-launcher"
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="${escapeHtml(this.options.launcherLabel)}"
                  title="${escapeHtml(this.options.launcherLabel)}"
                >
                  ${icon.chat}
                </button>
              `
            : `
          <section
            class="chat-panel gk-panel-opening pointer-events-auto flex h-[min(var(--gk-panel-height),calc(100dvh-32px))] flex-col overflow-hidden rounded-[var(--gk-radius)] bg-[var(--gk-canvas)] text-[var(--gk-text)] shadow-[0_28px_90px_rgba(0,0,0,0.68)] backdrop-blur-2xl"
            role="dialog"
            aria-modal="false"
            aria-label="${escapeHtml(projectName)} assistant"
          >
            <header class="flex min-h-[72px] shrink-0 items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
              <div class="flex min-w-0 items-center gap-3">
                <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)] shadow-[0_0_0_4px_rgba(82,169,255,0.09)]">
                  ${icon.chat}
                </div>
                <div class="min-w-0">
                  <h2 class="truncate text-sm font-medium leading-5 text-[var(--gk-text)]">${escapeHtml(projectName)}</h2>
                  <p class="flex items-center gap-1.5 text-[11px] leading-4 text-[var(--gk-muted)]"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>${this.activeTourTitle ? "Guiding you now" : "Assistant"}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                ${
                  this.options.showVoiceControl
                    ? `<button class="icon-btn ${focusClasses} grid h-11 w-11 place-items-center rounded-[14px] bg-transparent text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-toggle-tts" type="button" aria-label="${this.ttsEnabled ? "Turn voice off" : "Turn voice on"}" aria-pressed="${this.ttsEnabled}" title="${this.ttsEnabled ? "Turn voice off" : "Turn voice on"}">${this.ttsEnabled ? icon.volume : icon.volumeOff}</button>`
                    : ""
                }
                ${
                  showLocaleControl
                    ? `<button class="icon-btn ${focusClasses} h-11 min-w-11 rounded-[14px] bg-transparent px-2 text-[11px] font-medium uppercase text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-toggle-locale" type="button" aria-label="Change language. Current: ${escapeHtml(this.locale)}" title="Change language">${escapeHtml(this.locale.slice(0, 3).toUpperCase())}</button>`
                    : ""
                }
                <button class="icon-btn ${focusClasses} grid h-11 w-11 place-items-center rounded-[14px] bg-transparent text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-minimize-chat" type="button" aria-label="Minimize assistant" title="Minimize assistant">${icon.minimize}</button>
              </div>
            </header>

            ${
              this.activeTourTitle
                ? `<div class="mx-4 mb-2 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-[var(--gk-surface)] px-3 py-2">
                    <div class="min-w-0">
                      <p class="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--gk-accent)]">Tour in progress</p>
                      <p class="truncate text-xs text-[var(--gk-text)]">${escapeHtml(this.activeTourTitle)}</p>
                    </div>
                    <button class="${focusClasses} inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium text-red-300 transition-colors hover:bg-red-400/10" id="gk-stop-tour" type="button">${icon.stop}<span>Stop tour</span></button>
                  </div>`
                : ""
            }

            ${
              chips.length > 0
                ? `<div class="gk-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 py-2" aria-label="Suggested prompts">
                    ${chips
                      .map(
                        (chip) => `<button class="chip ${focusClasses} min-h-11 shrink-0 rounded-full bg-[var(--gk-surface)] px-3.5 text-xs font-medium text-[var(--gk-muted)] transition-[background-color,color,transform] hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)] active:translate-y-px" type="button" data-query="${escapeHtml(chip.query)}">${escapeHtml(chip.label)}</button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }

            <div class="messages-area gk-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-3" id="gk-messages" aria-live="polite" aria-busy="false">
              <div class="msg-row msg-assistant flex max-w-[92%] self-start">
                <div class="flex items-end gap-2">
                  <span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${icon.chat}</span>
                  <div class="${assistantBubbleClasses}">${escapeHtml(this.getGreeting())}</div>
                </div>
              </div>
            </div>

            <form class="chat-footer shrink-0 bg-[var(--gk-canvas)] p-3 pt-2 sm:p-4 sm:pt-2" id="gk-search-form">
              <label class="sr-only" for="gk-input">Message the assistant</label>
              <div class="composer flex min-h-14 items-center gap-2 rounded-[20px] bg-[var(--gk-surface)] p-1.5 pl-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[box-shadow,background-color] focus-within:bg-[var(--gk-surface-hover)] focus-within:shadow-[0_0_0_2px_var(--gk-accent)]">
                <input class="chat-input min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] leading-5 text-[var(--gk-text)] outline-none placeholder:text-[var(--gk-muted)]" id="gk-input" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" placeholder="${escapeHtml(this.getPlaceholder())}" />
                <button class="btn-send ${focusClasses} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35" id="gk-send" type="submit" aria-label="Send message" title="Send message" disabled>${icon.send}</button>
              </div>
            </form>
          </section>
        `
        }
      </div>
    `;

    if (!this.isOpen) {
      this.shadow.querySelector("#gk-launcher")?.addEventListener("click", () => this.open());
      this.shadow.querySelector("#gk-stop-tour-compact")?.addEventListener("click", () => this.stopTour());
      return;
    }

    const panel = this.shadow.querySelector(".chat-panel");
    panel?.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") this.close();
    });
    this.shadow.querySelector("#gk-minimize-chat")?.addEventListener("click", () => this.close());
    this.shadow.querySelector("#gk-stop-tour")?.addEventListener("click", () => this.stopTour());

    this.shadow.querySelector("#gk-toggle-tts")?.addEventListener("click", () => {
      this.ttsEnabled = !this.ttsEnabled;
      this.render();
    });

    this.shadow.querySelector("#gk-toggle-locale")?.addEventListener("click", () => {
      const currentIndex = supportedLocales.indexOf(this.locale);
      const next = supportedLocales[(currentIndex + 1) % supportedLocales.length] || supportedLocales[0];
      this.locale = next;
      this.callbacks?.onLocaleChange(next);
      this.render();
    });

    this.shadow.querySelectorAll(".chip").forEach((element) => {
      element.addEventListener("click", () => {
        const query = (element as HTMLElement).dataset.query;
        if (query) void this.handleSend(query);
      });
    });

    const form = this.shadow.querySelector<HTMLFormElement>("#gk-search-form");
    const input = this.shadow.querySelector<HTMLInputElement>("#gk-input");
    const sendButton = this.shadow.querySelector<HTMLButtonElement>("#gk-send");
    input?.addEventListener("input", () => {
      if (sendButton) sendButton.disabled = this.isSending || !input.value.trim();
    });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input?.value.trim();
      if (!value || this.isSending) return;
      input.value = "";
      if (sendButton) sendButton.disabled = true;
      void this.handleSend(value);
    });
  }

  private setComposerBusy(isBusy: boolean) {
    const input = this.shadow.querySelector<HTMLInputElement>("#gk-input");
    const sendButton = this.shadow.querySelector<HTMLButtonElement>("#gk-send");
    const messages = this.shadow.querySelector<HTMLElement>("#gk-messages");
    if (input) input.disabled = isBusy;
    if (sendButton) sendButton.disabled = isBusy || !input?.value.trim();
    messages?.setAttribute("aria-busy", String(isBusy));
  }

  private async handleSend(text: string) {
    const stream = this.shadow.querySelector(".messages-area");
    if (!stream || this.isSending) return;

    this.playSendTick();
    this.isSending = true;
    this.setComposerBusy(true);

    const userRow = document.createElement("div");
    userRow.className = "msg-row msg-user flex max-w-[82%] flex-col self-end";
    userRow.innerHTML = `<div class="bubble-user rounded-[20px] rounded-br-md bg-[var(--gk-accent)] px-4 py-3 text-[13px] leading-[1.55] text-[var(--gk-accent-text)] shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]">${formatMessage(text)}</div>`;
    stream.appendChild(userRow);

    const loadRow = document.createElement("div");
    loadRow.className = "msg-row msg-assistant flex max-w-[92%] flex-col self-start";
    loadRow.id = "gk-loader-row";
    loadRow.innerHTML = `<div class="flex items-end gap-2"><span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${icon.chat}</span><div class="min-w-[92px] rounded-[20px] rounded-bl-md bg-[var(--gk-surface)] px-4 py-3 text-[13px] leading-5 text-[var(--gk-muted)]" role="status">Thinking…</div></div>`;
    stream.appendChild(loadRow);
    stream.scrollTop = stream.scrollHeight;

    try {
      const response = await this.callbacks?.onSendMessage(text);
      loadRow.remove();
      if (response) {
        this.addAssistantMessage(response.reply, {
          tourPlan: response.tour_plan,
          suggestedTourPlan: response.suggested_tour_plan,
          isPrereq: response.tour_plan?.requires_login_first,
        });

        if (response.tour_plan && response.tour_plan.steps.length > 0) {
          this.callbacks?.onStartTour(response.tour_plan);
        }
      }
    } catch (caught) {
      loadRow.remove();
      const message = caught instanceof Error ? caught.message : "The guide is unavailable right now.";
      this.addAssistantMessage(`I could not connect. ${message}`, { isError: true });
    } finally {
      this.isSending = false;
      this.setComposerBusy(false);
      this.shadow.querySelector<HTMLInputElement>("#gk-input")?.focus();
    }
  }
}
