/**
 * Spotlight & Popover Controller
 * Attaches smooth SVG spotlight cutout and floating card to document.body
 */

import { StitchedWorkflowStep, ResolutionStatus } from "../types";
import { SPOTLIGHT_STYLES } from "../ui/styles";

export interface SpotlightCallbacks {
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onStepCompleted?: (step: StitchedWorkflowStep) => void;
}

export class DriverController {
  private rootEl: HTMLElement | null = null;
  private currentElement: HTMLElement | null = null;
  private currentStep: StitchedWorkflowStep | null = null;
  private currentTier: ResolutionStatus = "matched_primary";
  private locale: string = "en";
  private callbacks?: SpotlightCallbacks;
  private advanceListenerCleanups: Array<() => void> = [];
  private resizeHandler: () => void;

  constructor() {
    this.resizeHandler = () => this.reposition();
    this.injectStyles();
  }

  private injectStyles() {
    if (typeof document === "undefined") return;
    if (!document.getElementById("guidekit-spotlight-styles")) {
      const style = document.createElement("style");
      style.id = "guidekit-spotlight-styles";
      style.textContent = SPOTLIGHT_STYLES;
      document.head.appendChild(style);
    }
  }

  /**
   * Highlight target element with SVG spotlight cutout and floating popover
   */
  public highlight(
    element: HTMLElement,
    step: StitchedWorkflowStep,
    totalSteps: number,
    tier: ResolutionStatus,
    locale: string,
    callbacks: SpotlightCallbacks
  ) {
    this.destroy(); // Clear any existing spotlight

    this.currentElement = element;
    this.currentStep = step;
    this.currentTier = tier;
    this.locale = locale;
    this.callbacks = callbacks;

    // Scroll smoothly into view
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    // Mount spotlight root
    this.rootEl = document.createElement("div");
    this.rootEl.id = "guidekit-spotlight-root";
    document.body.appendChild(this.rootEl);

    // Initial render
    this.render(totalSteps);

    // Bind window events for responsive positioning
    window.addEventListener("resize", this.resizeHandler, { passive: true });
    window.addEventListener("scroll", this.resizeHandler, { passive: true });

    // Bind automatic advance_on trigger
    this.bindAdvanceOnTrigger(element, step);
  }

  private getTierBadge(tier: ResolutionStatus): { label: string; className: string } {
    switch (tier) {
      case "matched_primary":
        return { label: "Tier 1 · 0ms", className: "tier-primary" };
      case "matched_fingerprint":
        return { label: "Tier 2 · Fingerprint", className: "tier-fingerprint" };
      case "healed_by_ai":
        return { label: "Tier 3 · ⚡ Auto-Healed", className: "tier-ai" };
      case "cache_hit":
        return { label: "Tier 3 · ⚡ 0ms Cache Hit", className: "tier-cache" };
      default:
        return { label: "Text Guidance", className: "tier-primary" };
    }
  }

  private render(totalSteps: number) {
    if (!this.rootEl || !this.currentElement || !this.currentStep) return;

    const rect = this.currentElement.getBoundingClientRect();
    const pad = 6;
    const x = Math.max(0, rect.left - pad);
    const y = Math.max(0, rect.top - pad);
    const w = rect.width + pad * 2;
    const h = rect.height + pad * 2;
    const r = 8; // Border radius

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // SVG path cutout with evenodd rule
    const svgPath = `M 0,0 L ${vw},0 L ${vw},${vh} L 0,${vh} Z M ${x + r},${y} ` +
      `L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} ` +
      `L ${x + w},${y + h - r} Q ${x + w},${y + h} ${x + w - r},${y + h} ` +
      `L ${x + r},${y + h} Q ${x},${y + h} ${x},${y + h - r} ` +
      `L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;

    const tierInfo = this.getTierBadge(this.currentTier);
    const content = this.currentStep.content || {};
    const loc = content[this.locale] || content["en"] || {};
    const title = loc.title || this.currentStep.guide_id || "Step";
    const desc = loc.description || "";

    const isFirst = this.currentStep.execution_index <= 1;
    const isLast = this.currentStep.execution_index >= totalSteps;

    this.rootEl.innerHTML = `
      <svg class="guidekit-spotlight-svg" viewBox="0 0 ${vw} ${vh}">
        <path d="${svgPath}" fill="rgba(4, 5, 8, 0.72)" fill-rule="evenodd" />
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#10B981" stroke-width="2" stroke-opacity="0.8" />
      </svg>
      <div class="guidekit-spotlight-card" id="guidekit-card">
        <div class="guidekit-card-header">
          <span class="guidekit-step-badge">Step ${this.currentStep.execution_index} of ${totalSteps}</span>
          <span class="guidekit-tier-badge ${tierInfo.className}">${tierInfo.label}</span>
        </div>
        <div class="guidekit-card-title">${title}</div>
        <div class="guidekit-card-desc">${desc}</div>
        <div class="guidekit-card-footer">
          <button class="guidekit-btn guidekit-btn-tts" id="gk-btn-tts" title="Listen instructions">🔊</button>
          <div class="guidekit-btn-group">
            ${!isFirst ? `<button class="guidekit-btn guidekit-btn-prev" id="gk-btn-prev">← Prev</button>` : ""}
            <button class="guidekit-btn guidekit-btn-next" id="gk-btn-next">${isLast ? "Finish ✓" : "Next →"}</button>
            <button class="guidekit-btn guidekit-btn-close" id="gk-btn-close">×</button>
          </div>
        </div>
      </div>
    `;

    // Position Card
    const cardEl = this.rootEl.querySelector<HTMLElement>("#guidekit-card");
    if (cardEl) {
      this.positionCard(cardEl, rect);
    }

    // Attach Event Handlers
    this.rootEl.querySelector("#gk-btn-next")?.addEventListener("click", () => this.callbacks?.onNext());
    this.rootEl.querySelector("#gk-btn-prev")?.addEventListener("click", () => this.callbacks?.onPrev());
    this.rootEl.querySelector("#gk-btn-close")?.addEventListener("click", () => this.callbacks?.onClose());
    this.rootEl.querySelector("#gk-btn-tts")?.addEventListener("click", () => this.speak(title, desc));
  }

  private positionCard(card: HTMLElement, targetRect: DOMRect) {
    const cardW = 320;
    const cardH = 180;
    const pad = 12;

    let top = targetRect.bottom + pad;
    let left = targetRect.left;

    // If overflowing bottom, put on top
    if (top + cardH > window.innerHeight - 20) {
      top = Math.max(20, targetRect.top - cardH - pad);
    }

    // If overflowing right, shift left
    if (left + cardW > window.innerWidth - 20) {
      left = Math.max(20, window.innerWidth - cardW - 20);
    }

    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  public reposition() {
    if (!this.rootEl || !this.currentElement || !this.currentStep) return;
    const rect = this.currentElement.getBoundingClientRect();
    const pad = 6;
    const x = Math.max(0, rect.left - pad);
    const y = Math.max(0, rect.top - pad);
    const w = rect.width + pad * 2;
    const h = rect.height + pad * 2;
    const r = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const pathEl = this.rootEl.querySelector<SVGPathElement>("path");
    const strokeEl = this.rootEl.querySelector<SVGRectElement>("rect");
    const svgEl = this.rootEl.querySelector<SVGSVGElement>("svg");

    if (pathEl && strokeEl && svgEl) {
      svgEl.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
      const svgPath = `M 0,0 L ${vw},0 L ${vw},${vh} L 0,${vh} Z M ${x + r},${y} ` +
        `L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} ` +
        `L ${x + w},${y + h - r} Q ${x + w},${y + h} ${x + w - r},${y + h} ` +
        `L ${x + r},${y + h} Q ${x},${y + h} ${x},${y + h - r} ` +
        `L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
      pathEl.setAttribute("d", svgPath);
      strokeEl.setAttribute("x", `${x}`);
      strokeEl.setAttribute("y", `${y}`);
      strokeEl.setAttribute("width", `${w}`);
      strokeEl.setAttribute("height", `${h}`);
    }

    const cardEl = this.rootEl.querySelector<HTMLElement>("#guidekit-card");
    if (cardEl) {
      this.positionCard(cardEl, rect);
    }
  }

  private bindAdvanceOnTrigger(element: HTMLElement, step: StitchedWorkflowStep) {
    this.clearAdvanceListeners();

    const advance = step.advance_on || "click";

    if (advance === "click") {
      const clickHandler = () => {
        this.callbacks?.onStepCompleted?.(step);
        this.callbacks?.onNext();
      };
      element.addEventListener("click", clickHandler, { once: true });
      this.advanceListenerCleanups.push(() => element.removeEventListener("click", clickHandler));
    } else if (advance === "input_valid") {
      const enterHandler = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          this.callbacks?.onStepCompleted?.(step);
          this.callbacks?.onNext();
        }
      };
      element.addEventListener("keydown", enterHandler as EventListener);
      this.advanceListenerCleanups.push(() => element.removeEventListener("keydown", enterHandler as EventListener));
    }
  }

  private clearAdvanceListeners() {
    for (const cleanup of this.advanceListenerCleanups) {
      cleanup();
    }
    this.advanceListenerCleanups = [];
  }

  private speak(title: string, desc: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${title}. ${desc}`);
      utterance.lang = this.locale === "hi" ? "hi-IN" : "en-US";
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }

  public destroy() {
    this.clearAdvanceListeners();
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("scroll", this.resizeHandler);

    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    this.currentElement = null;
    this.currentStep = null;
  }
}

