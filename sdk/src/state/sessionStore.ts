/**
 * Session and Tour state persistence using sessionStorage / localStorage
 */

import { ActiveTourState, TourPlan } from "../types";

const TOUR_STORAGE_KEY = "guidekit_active_tour";
const VISITOR_ID_KEY = "guidekit_visitor_id";
const SESSION_ID_KEY = "guidekit_session_id";
const LOCALE_KEY = "guidekit_locale";

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "vis_ssr";
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = "vis_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }
  return vid;
}

export function getSavedSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(SESSION_ID_KEY) || undefined;
}

export function saveSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
}

export function getSavedLocale(defaultLocale: string = "en"): string {
  if (typeof window === "undefined") return defaultLocale;
  return localStorage.getItem(LOCALE_KEY) || defaultLocale;
}

export function saveLocale(locale: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_KEY, locale);
}

export function getActiveTour(): ActiveTourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTourState;
  } catch {
    return null;
  }
}

export function saveActiveTour(tour: ActiveTourState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(tour));
  } catch (err) {
    console.warn("[GuideKit] Failed to save active tour state:", err);
  }
}

export function clearActiveTour(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOUR_STORAGE_KEY);
}

export function updateTourStepIndex(index: number): ActiveTourState | null {
  const current = getActiveTour();
  if (!current) return null;
  current.currentStepIndex = index;
  if (index >= current.tourPlan.steps.length) {
    current.status = "completed";
  }
  saveActiveTour(current);
  return current;
}

