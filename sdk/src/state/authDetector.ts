/**
 * Real-time Browser Auth & Role Detection
 */

import { AuthDetectionConfig, AuthDetectionRule } from "../types";

export interface DetectedAuthState {
  is_logged_in: boolean;
  role: string | null;
}

function evaluateRule(rule?: AuthDetectionRule): boolean {
  if (!rule || typeof window === "undefined") return false;

  try {
    if (rule.type === "cookie" && rule.name) {
      return document.cookie.split(";").some((c) => c.trim().startsWith(`${rule.name}=`));
    }

    if (rule.type === "localStorage" && rule.key) {
      const val = localStorage.getItem(rule.key);
      return val !== null && val !== "" && val !== "null" && val !== "undefined";
    }

    if (rule.type === "dom" && rule.selector) {
      return document.querySelector(rule.selector) !== null;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Detect current page path from virtual route attributes or window.location
 */
export function getCurrentPagePath(): string {
  if (typeof window === "undefined") return "/";

  // Check custom route attribute on elements or body
  const customEl = document.querySelector("[data-current-route]");
  if (customEl) {
    const r = customEl.getAttribute("data-current-route");
    if (r) return r.startsWith("/") ? r : "/" + r;
  }

  const bodyRoute = document.body?.getAttribute("data-guidekit-route");
  if (bodyRoute) {
    return bodyRoute.startsWith("/") ? bodyRoute : "/" + bodyRoute;
  }

  return window.location.pathname || "/";
}

/**
 * Detects if the user is signed in and what role they possess
 */
export function detectAuthState(config?: AuthDetectionConfig): DetectedAuthState {
  if (typeof window === "undefined") {
    return { is_logged_in: false, role: null };
  }

  let loggedIn = false;

  // 1. Check configured signed_in rule
  if (config?.signed_in && evaluateRule(config.signed_in)) {
    loggedIn = true;
  }

  // 2. Check alternative rules
  if (!loggedIn && config?.alt && Array.isArray(config.alt)) {
    for (const rule of config.alt) {
      if (evaluateRule(rule)) {
        loggedIn = true;
        break;
      }
    }
  }

  // 3. Fallback heuristic detection for standard apps
  if (!loggedIn) {
    const commonKeys = [
      "token",
      "access_token",
      "auth_token",
      "session",
      "driver_token",
      "passenger_token",
      "guidekit_demo_auth",
    ];
    for (const k of commonKeys) {
      const item = localStorage.getItem(k);
      if (item && item !== "false" && item !== "null" && item !== "") {
        loggedIn = true;
        break;
      }
    }
  }

  // 4. Role detection
  let role: string | null = null;
  if (loggedIn) {
    if (config?.role_source) {
      const src = config.role_source;
      if (src.type === "localStorage" && src.key) {
        role = localStorage.getItem(src.key);
      } else if (src.type === "dom" && src.selector) {
        const el = document.querySelector(src.selector);
        if (el) {
          role = src.attribute ? el.getAttribute(src.attribute) : el.textContent?.trim() || null;
        }
      }
    }

    // Fallback role heuristics
    if (!role) {
      role =
        localStorage.getItem("role") ||
        localStorage.getItem("user_role") ||
        (localStorage.getItem("driver_token") ? "driver" : null) ||
        (localStorage.getItem("passenger_token") ? "passenger" : null);
    }
  }

  return {
    is_logged_in: loggedIn,
    role: role ? role.toLowerCase() : null,
  };
}

