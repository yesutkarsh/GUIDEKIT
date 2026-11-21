/**
 * 4-Tier DOM Resolver Ladder
 * Tier 1: Primary Locator (~0ms)
 * Tier 2: Client Fingerprint Scoring (~1ms, Zero AI cost)
 * Tier 3: Cached Cloud AI Self-Healing (~15ms)
 * Tier 4: Graceful Text Fallback (Never crashes)
 */

import {
  StitchedWorkflowStep,
  ResolutionStatus,
  CandidateElement,
} from "../types";
import { pruneInteractiveCandidates, computeDomHash } from "./candidatePruner";
import { GuideKitApiClient } from "../network/apiClient";
import { TelemetryQueue } from "../network/telemetryQueue";
import { getCurrentPagePath } from "../state/authDetector";

export interface ResolvedStepElement {
  element: HTMLElement | null;
  status: ResolutionStatus;
  suggestedSelector?: string;
  confidence: number;
  fallbackText?: string;
  resolutionTimeMs: number;
}

function normalizeTarget(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  if (el.tagName.toLowerCase() === "option") {
    return el.closest("select") || el.parentElement;
  }
  return el;
}

/**
 * Check if element is visible on page
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.tagName.toLowerCase() === "option") {
    const parent = el.closest("select") || el.parentElement;
    if (parent) return isElementVisible(parent);
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) {
    return false;
  }
  return true;
}

/**
 * Tier 1: Check primary data-guide-id, data-testid, and CSS selector
 */
export function resolveTier1Primary(step: StitchedWorkflowStep): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const fp = step.target_fingerprint || {};
  const guideId = fp.guide_id || step.guide_id;

  // 1. Try exact data-guide-id
  if (guideId) {
    const el = normalizeTarget(document.querySelector<HTMLElement>(`[data-guide-id="${guideId}"]`));
    if (el && isElementVisible(el)) return el;
  }

  // 2. Try data-testid
  if (fp.attrs && fp.attrs["data-testid"]) {
    const el = normalizeTarget(document.querySelector<HTMLElement>(`[data-testid="${fp.attrs["data-testid"]}"]`));
    if (el && isElementVisible(el)) return el;
  }

  // 3. Try primary CSS selector
  const css = fp.css || fp.primary_selector;
  if (css) {
    try {
      const el = normalizeTarget(document.querySelector<HTMLElement>(css));
      if (el && isElementVisible(el)) return el;
    } catch {
      // Invalid selector string
    }
  }

  // 4. Try element ID
  if (fp.attrs && fp.attrs["id"]) {
    const el = normalizeTarget(document.getElementById(fp.attrs["id"]));
    if (el && isElementVisible(el)) return el;
  }

  return null;
}

/**
 * Tier 2: Client Fingerprint Scoring (zero network, zero AI cost)
 */
export function resolveTier2Fingerprint(step: StitchedWorkflowStep): { element: HTMLElement | null; score: number } {
  if (typeof document === "undefined") return { element: null, score: 0 };

  const fp = step.target_fingerprint || {};
  const targetTag = (fp.tag || "").toLowerCase();
  const targetRole = (fp.role || (targetTag === "button" ? "button" : targetTag === "a" ? "link" : "")).toLowerCase();
  const targetText = (fp.text || "").toLowerCase().trim();
  const targetAttrs = fp.attrs || {};

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [role='button'], [role='link']")
  ).filter((el) => {
    if (el.closest("guidekit-widget") || el.closest("#guidekit-spotlight-root")) return false;
    return isElementVisible(el);
  });

  let bestElement: HTMLElement | null = null;
  let bestScore = 0;

  for (const el of candidates) {
    let score = 0;
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute("role") || (tag === "button" ? "button" : tag === "a" ? "link" : "")).toLowerCase();
    const text = (el.innerText || el.textContent || "").toLowerCase().trim();
    const testId = el.getAttribute("data-testid") || "";
    const id = el.id || "";

    // Tag / Role match (weight: 0.35)
    if (targetRole && role === targetRole) {
      score += 0.35;
    } else if (targetTag && tag === targetTag) {
      score += 0.3;
    }

    // Text match (weight: 0.45)
    if (targetText && text) {
      if (text === targetText) {
        score += 0.45;
      } else if (text.includes(targetText) || targetText.includes(text)) {
        score += 0.3;
      }
    }

    // Attributes match (weight: 0.3)
    if (targetAttrs["data-testid"] && testId) {
      if (testId === targetAttrs["data-testid"]) {
        score += 0.3;
      } else if (testId.includes(targetAttrs["data-testid"]) || targetAttrs["data-testid"].includes(testId)) {
        score += 0.15;
      }
    }

    if (targetAttrs["id"] && id) {
      if (id === targetAttrs["id"]) {
        score += 0.2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestElement = el;
    }
  }

  // Threshold: >= 0.72 for confidence
  if (bestScore >= 0.72) {
    return { element: bestElement, score: bestScore };
  }

  return { element: null, score: bestScore };
}

/**
 * Execute full 4-Tier DOM Resolver Ladder
 */
export async function resolveStepElement(
  step: StitchedWorkflowStep,
  apiClient: GuideKitApiClient,
  telemetry: TelemetryQueue,
  locale: string = "en"
): Promise<ResolvedStepElement> {
  const startTime = Date.now();
  const pagePath = getCurrentPagePath();

  // -------------------------------------------------------------
  // TIER 1: Primary Locator (~0ms)
  // -------------------------------------------------------------
  const t1Element = resolveTier1Primary(step);
  if (t1Element) {
    const elapsed = Date.now() - startTime;
    telemetry.trackResolution({
      step_id: step.step_id,
      status: "matched_primary",
      resolution_ms: elapsed,
      page_path: pagePath,
    });
    return {
      element: t1Element,
      status: "matched_primary",
      confidence: 1.0,
      resolutionTimeMs: elapsed,
    };
  }

  // -------------------------------------------------------------
  // TIER 2: Client Fingerprint Scoring (~1ms, Zero AI)
  // -------------------------------------------------------------
  const t2Result = resolveTier2Fingerprint(step);
  if (t2Result.element) {
    const elapsed = Date.now() - startTime;
    telemetry.trackResolution({
      step_id: step.step_id,
      status: "matched_fingerprint",
      resolution_ms: elapsed,
      page_path: pagePath,
    });
    return {
      element: t2Result.element,
      status: "matched_fingerprint",
      confidence: t2Result.score,
      resolutionTimeMs: elapsed,
    };
  }

  // -------------------------------------------------------------
  // TIER 3: Cached Cloud AI Self-Healing Resolver
  // -------------------------------------------------------------
  try {
    const candidates = pruneInteractiveCandidates(40);
    const domHash = await computeDomHash(candidates);

    const healResp = await apiClient.heal({
      stepId: step.step_id,
      pagePath,
      domHash,
      locale,
      candidates,
    });

    const elapsed = Date.now() - startTime;

    if (
      (healResp.status === "healed_by_ai" || healResp.status === "cache_hit") &&
      healResp.suggested_selector
    ) {
      const healedEl = document.querySelector<HTMLElement>(healResp.suggested_selector);
      if (healedEl && isElementVisible(healedEl)) {
        telemetry.trackResolution({
          step_id: step.step_id,
          status: healResp.status,
          resolution_ms: elapsed,
          page_path: pagePath,
          dom_hash: domHash,
          detected_dom_selector: healResp.suggested_selector,
        });

        return {
          element: healedEl,
          status: healResp.status,
          suggestedSelector: healResp.suggested_selector,
          confidence: healResp.confidence,
          resolutionTimeMs: elapsed,
        };
      }
    }
  } catch (err) {
    console.warn("[GuideKit] Tier 3 AI heal failed or was unreachable:", err);
  }

  // -------------------------------------------------------------
  // TIER 4: Graceful Text Fallback (Never crashes)
  // -------------------------------------------------------------
  const elapsed = Date.now() - startTime;
  const content = step.content || {};
  const localized = content[locale] || content["en"] || {};
  const fallbackText = localized.description || localized.title || `Perform action on ${step.route_pattern}`;

  telemetry.trackResolution({
    step_id: step.step_id,
    status: "fallback_to_text",
    resolution_ms: elapsed,
    page_path: pagePath,
  });

  return {
    element: null,
    status: "fallback_to_text",
    fallbackText,
    confidence: 0.0,
    resolutionTimeMs: elapsed,
  };
}

