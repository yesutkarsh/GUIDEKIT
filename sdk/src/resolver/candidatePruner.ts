/**
 * Candidate Pruner & DOM Hashing for Tier 3 AI Self-Healing
 */

import { CandidateElement } from "../types";

/**
 * Generate a unique, stable CSS selector for a DOM element
 */
export function generateElementSelector(el: HTMLElement): string {
  if (el.id) {
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(el.id) : el.id;
    return `#${safeId}`;
  }

  const guideId = el.getAttribute("data-guide-id");
  if (guideId) {
    return `[data-guide-id="${guideId}"]`;
  }

  const testId = el.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  const name = el.getAttribute("name");
  if (name && el.tagName.toLowerCase() === "input") {
    return `input[name="${name}"]`;
  }

  // Fallback to tag + class
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).filter((c) => !c.includes(":") && !c.includes("[") && !c.includes("/"));
  if (cls.length > 0) {
    return `${tag}.${cls.slice(0, 2).join(".")}`;
  }

  return tag;
}

/**
 * Extracts visible interactive candidate elements from the document (up to 40)
 */
export function pruneInteractiveCandidates(maxCandidates: number = 40): CandidateElement[] {
  if (typeof document === "undefined") return [];

  const interactiveSelectors = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='link']",
    "[role='tab']",
    "[role='checkbox']",
  ];

  const elements = Array.from(document.querySelectorAll<HTMLElement>(interactiveSelectors.join(",")));
  const candidates: CandidateElement[] = [];

  for (let i = 0; i < elements.length && candidates.length < maxCandidates; i++) {
    const el = elements[i];

    // Ignore elements inside GuideKit widget or spotlight overlay
    if (el.closest("guidekit-widget") || el.closest("#guidekit-spotlight-root")) {
      continue;
    }

    // Check visibility
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    const isVisible = rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden";
    if (!isVisible) continue;

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || (tag === "button" ? "button" : tag === "a" ? "link" : undefined);
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    const accessibleName = el.getAttribute("aria-label") || el.getAttribute("title") || undefined;
    const css = generateElementSelector(el);

    // Extract relevant attributes
    const attrs: Record<string, any> = {};
    for (const attrName of ["id", "class", "name", "type", "data-testid", "data-guide-id", "placeholder"]) {
      const val = el.getAttribute(attrName);
      if (val) attrs[attrName] = val;
    }

    const landmarkEl = el.closest("header, nav, main, footer, section, form");
    const landmark = landmarkEl ? `${landmarkEl.tagName.toLowerCase()}${landmarkEl.id ? "#" + landmarkEl.id : ""}` : undefined;

    candidates.push({
      candidate_id: `cand_${candidates.length}_${tag}_${attrs.id || "elem"}`,
      tag,
      role,
      text: text.substring(0, 100) || undefined,
      accessible_name: accessibleName,
      css_selector: css,
      attrs,
      landmark,
    });
  }

  return candidates;
}

/**
 * Deterministic SHA-256 or Murmur-based DOM Hash of interactive elements
 */
export async function computeDomHash(candidates: CandidateElement[]): Promise<string> {
  const serialized = candidates
    .map((c) => `${c.tag}|${c.attrs.id || ""}|${c.attrs["data-testid"] || ""}|${c.text || ""}`)
    .sort()
    .join(";");

  // In browser with Web Crypto API
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    try {
      const msgUint8 = new TextEncoder().encode(serialized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback
    }
  }

  // Deterministic string hash fallback
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return "dom_" + (hash >>> 0).toString(16);
}

