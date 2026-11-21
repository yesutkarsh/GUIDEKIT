var G = Object.defineProperty;
var D = (n, e, t) => e in n ? G(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var u = (n, e, t) => D(n, typeof e != "symbol" ? e + "" : e, t);
class W {
  constructor(e, t = "http://127.0.0.1:8000/api/v1") {
    u(this, "baseUrl");
    u(this, "apiKey");
    this.apiKey = e, this.baseUrl = t.replace(/\/+$/, "");
  }
  setApiKey(e) {
    this.apiKey = e;
  }
  setBaseUrl(e) {
    this.baseUrl = e.replace(/\/+$/, "");
  }
  /**
   * Fetch manifest with ETag caching
   */
  async fetchManifest() {
    const e = `guidekit_manifest_etag_${this.apiKey}`, t = `guidekit_manifest_data_${this.apiKey}`, i = localStorage.getItem(e), r = {
      "X-GuideKit-Key": this.apiKey
    };
    i && (r["If-None-Match"] = i);
    try {
      const a = await fetch(`${this.baseUrl}/sdk/manifest`, {
        method: "GET",
        headers: r
      });
      if (a.status === 304) {
        const l = localStorage.getItem(t);
        if (l)
          return JSON.parse(l);
      }
      if (!a.ok)
        throw new Error(`Manifest fetch failed with status ${a.status}`);
      const o = a.headers.get("ETag"), s = await a.json();
      return o && localStorage.setItem(e, o), localStorage.setItem(t, JSON.stringify(s)), s;
    } catch (a) {
      console.warn("[GuideKit] Manifest fetch error, falling back to cache:", a);
      const o = localStorage.getItem(t);
      return o ? JSON.parse(o) : null;
    }
  }
  /**
   * Send chat message to runtime router
   */
  async chat(e) {
    const t = await fetch(`${this.baseUrl}/sdk/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GuideKit-Key": this.apiKey
      },
      body: JSON.stringify({
        visitor_id: e.visitorId,
        session_id: e.sessionId,
        message: e.message,
        locale: e.locale || "en",
        current_path: e.currentPath,
        auth_state: e.authState
      })
    });
    if (!t.ok) {
      const i = await t.text();
      throw new Error(`Chat API error (${t.status}): ${i}`);
    }
    return await t.json();
  }
  /**
   * Invoke Tier 3 Cloud AI Self-Healing Resolver
   */
  async heal(e) {
    const t = await fetch(`${this.baseUrl}/sdk/heal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GuideKit-Key": this.apiKey
      },
      body: JSON.stringify({
        step_id: e.stepId,
        page_path: e.pagePath,
        dom_hash: e.domHash,
        locale: e.locale || "en",
        candidates: e.candidates
      })
    });
    if (!t.ok) {
      const i = await t.text();
      throw new Error(`Heal API error (${t.status}): ${i}`);
    }
    return await t.json();
  }
  /**
   * Send batched telemetry events
   */
  async sendEvents(e) {
    if (!(e.tourEvents.length === 0 && e.resolutionLogs.length === 0))
      try {
        await fetch(`${this.baseUrl}/sdk/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-GuideKit-Key": this.apiKey
          },
          body: JSON.stringify({
            session_id: e.sessionId,
            tour_events: e.tourEvents,
            resolution_logs: e.resolutionLogs
          })
        });
      } catch (t) {
        console.warn("[GuideKit] Failed to flush telemetry batch:", t);
      }
  }
}
class V {
  constructor(e, t) {
    u(this, "client");
    u(this, "tourEvents", []);
    u(this, "resolutionLogs", []);
    u(this, "sessionId");
    u(this, "flushTimer", null);
    this.client = e, this.sessionId = t, this.startPeriodicFlush(), typeof window < "u" && (window.addEventListener("beforeunload", () => this.flush()), document.addEventListener("visibilitychange", () => {
      document.visibilityState === "hidden" && this.flush();
    }));
  }
  setSessionId(e) {
    this.sessionId = e;
  }
  trackTourEvent(e) {
    this.tourEvents.push(e), this.tourEvents.length >= 10 && this.flush();
  }
  trackResolution(e) {
    this.resolutionLogs.push(e), this.resolutionLogs.length >= 10 && this.flush();
  }
  async flush() {
    if (this.tourEvents.length === 0 && this.resolutionLogs.length === 0) return;
    const e = [...this.tourEvents], t = [...this.resolutionLogs];
    this.tourEvents = [], this.resolutionLogs = [], await this.client.sendEvents({
      sessionId: this.sessionId,
      tourEvents: e,
      resolutionLogs: t
    });
  }
  startPeriodicFlush() {
    typeof window > "u" || (this.flushTimer = setInterval(() => {
      this.flush();
    }, 4e3));
  }
  destroy() {
    this.flushTimer && clearInterval(this.flushTimer), this.flush();
  }
}
const Y = `
  #guidekit-spotlight-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483600;
    transition: opacity 0.2s ease;
  }

  .guidekit-spotlight-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .guidekit-spotlight-card {
    position: absolute;
    pointer-events: auto;
    background: #0D0E12;
    border: 1px solid #232631;
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    color: #F3F4F6;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 2147483605;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .guidekit-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .guidekit-step-badge {
    font-size: 11px;
    font-weight: 700;
    color: #10B981;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .guidekit-tier-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .tier-primary { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
  .tier-fingerprint { background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); }
  .tier-ai { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
  .tier-cache { background: rgba(168, 85, 247, 0.15); color: #C084FC; border: 1px solid rgba(168, 85, 247, 0.3); }

  .guidekit-card-title {
    font-size: 15px;
    font-weight: 700;
    color: #FFFFFF;
    margin: 4px 0 6px 0;
  }

  .guidekit-card-desc {
    color: #9CA3AF;
    font-size: 12px;
    margin-bottom: 14px;
  }

  .guidekit-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #1C1E26;
    padding-top: 10px;
    margin-top: 6px;
  }

  .guidekit-btn-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .guidekit-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .guidekit-btn-next { background: #10B981; color: #0A0A0C; }
  .guidekit-btn-next:hover { background: #059669; }
  .guidekit-btn-prev { background: #1A1C23; color: #D1D5DB; border-color: #282C37; }
  .guidekit-btn-prev:hover { background: #222530; }
  .guidekit-btn-close { background: transparent; color: #9CA3AF; padding: 4px 8px; }
  .guidekit-btn-close:hover { color: #FFFFFF; }
  .guidekit-btn-tts { background: #1A1C23; color: #FBBF24; border: 1px solid #282C37; padding: 5px 8px; }
`;
class Q {
  constructor() {
    u(this, "rootEl", null);
    u(this, "currentElement", null);
    u(this, "currentStep", null);
    u(this, "currentTier", "matched_primary");
    u(this, "locale", "en");
    u(this, "callbacks");
    u(this, "advanceListenerCleanups", []);
    u(this, "resizeHandler");
    this.resizeHandler = () => this.reposition(), this.injectStyles();
  }
  injectStyles() {
    if (!(typeof document > "u") && !document.getElementById("guidekit-spotlight-styles")) {
      const e = document.createElement("style");
      e.id = "guidekit-spotlight-styles", e.textContent = Y, document.head.appendChild(e);
    }
  }
  /**
   * Highlight target element with SVG spotlight cutout and floating popover
   */
  highlight(e, t, i, r, a, o) {
    this.destroy(), this.currentElement = e, this.currentStep = t, this.currentTier = r, this.locale = a, this.callbacks = o, e.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), this.rootEl = document.createElement("div"), this.rootEl.id = "guidekit-spotlight-root", document.body.appendChild(this.rootEl), this.render(i), window.addEventListener("resize", this.resizeHandler, { passive: !0 }), window.addEventListener("scroll", this.resizeHandler, { passive: !0 }), this.bindAdvanceOnTrigger(e, t);
  }
  getTierBadge(e) {
    switch (e) {
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
  render(e) {
    var $, C, L, I;
    if (!this.rootEl || !this.currentElement || !this.currentStep) return;
    const t = this.currentElement.getBoundingClientRect(), i = 6, r = Math.max(0, t.left - i), a = Math.max(0, t.top - i), o = t.width + i * 2, s = t.height + i * 2, l = 8, d = window.innerWidth, c = window.innerHeight, g = `M 0,0 L ${d},0 L ${d},${c} L 0,${c} Z M ${r + l},${a} L ${r + o - l},${a} Q ${r + o},${a} ${r + o},${a + l} L ${r + o},${a + s - l} Q ${r + o},${a + s} ${r + o - l},${a + s} L ${r + l},${a + s} Q ${r},${a + s} ${r},${a + s - l} L ${r},${a + l} Q ${r},${a} ${r + l},${a} Z`, h = this.getTierBadge(this.currentTier), f = this.currentStep.content || {}, p = f[this.locale] || f.en || {}, m = p.title || this.currentStep.guide_id || "Step", y = p.description || "", _ = this.currentStep.execution_index <= 1, w = this.currentStep.execution_index >= e;
    this.rootEl.innerHTML = `
      <svg class="guidekit-spotlight-svg" viewBox="0 0 ${d} ${c}">
        <path d="${g}" fill="rgba(4, 5, 8, 0.72)" fill-rule="evenodd" />
        <rect x="${r}" y="${a}" width="${o}" height="${s}" rx="${l}" fill="none" stroke="#10B981" stroke-width="2" stroke-opacity="0.8" />
      </svg>
      <div class="guidekit-spotlight-card" id="guidekit-card">
        <div class="guidekit-card-header">
          <span class="guidekit-step-badge">Step ${this.currentStep.execution_index} of ${e}</span>
          <span class="guidekit-tier-badge ${h.className}">${h.label}</span>
        </div>
        <div class="guidekit-card-title">${m}</div>
        <div class="guidekit-card-desc">${y}</div>
        <div class="guidekit-card-footer">
          <button class="guidekit-btn guidekit-btn-tts" id="gk-btn-tts" title="Listen instructions">🔊</button>
          <div class="guidekit-btn-group">
            ${_ ? "" : '<button class="guidekit-btn guidekit-btn-prev" id="gk-btn-prev">← Prev</button>'}
            <button class="guidekit-btn guidekit-btn-next" id="gk-btn-next">${w ? "Finish ✓" : "Next →"}</button>
            <button class="guidekit-btn guidekit-btn-close" id="gk-btn-close">×</button>
          </div>
        </div>
      </div>
    `;
    const x = this.rootEl.querySelector("#guidekit-card");
    x && this.positionCard(x, t), ($ = this.rootEl.querySelector("#gk-btn-next")) == null || $.addEventListener("click", () => {
      var S;
      return (S = this.callbacks) == null ? void 0 : S.onNext();
    }), (C = this.rootEl.querySelector("#gk-btn-prev")) == null || C.addEventListener("click", () => {
      var S;
      return (S = this.callbacks) == null ? void 0 : S.onPrev();
    }), (L = this.rootEl.querySelector("#gk-btn-close")) == null || L.addEventListener("click", () => {
      var S;
      return (S = this.callbacks) == null ? void 0 : S.onClose();
    }), (I = this.rootEl.querySelector("#gk-btn-tts")) == null || I.addEventListener("click", () => this.speak(m, y));
  }
  positionCard(e, t) {
    let o = t.bottom + 12, s = t.left;
    o + 180 > window.innerHeight - 20 && (o = Math.max(20, t.top - 180 - 12)), s + 320 > window.innerWidth - 20 && (s = Math.max(20, window.innerWidth - 320 - 20)), e.style.top = `${o}px`, e.style.left = `${s}px`;
  }
  reposition() {
    if (!this.rootEl || !this.currentElement || !this.currentStep) return;
    const e = this.currentElement.getBoundingClientRect(), t = 6, i = Math.max(0, e.left - t), r = Math.max(0, e.top - t), a = e.width + t * 2, o = e.height + t * 2, s = 8, l = window.innerWidth, d = window.innerHeight, c = this.rootEl.querySelector("path"), g = this.rootEl.querySelector("rect"), h = this.rootEl.querySelector("svg");
    if (c && g && h) {
      h.setAttribute("viewBox", `0 0 ${l} ${d}`);
      const p = `M 0,0 L ${l},0 L ${l},${d} L 0,${d} Z M ${i + s},${r} L ${i + a - s},${r} Q ${i + a},${r} ${i + a},${r + s} L ${i + a},${r + o - s} Q ${i + a},${r + o} ${i + a - s},${r + o} L ${i + s},${r + o} Q ${i},${r + o} ${i},${r + o - s} L ${i},${r + s} Q ${i},${r} ${i + s},${r} Z`;
      c.setAttribute("d", p), g.setAttribute("x", `${i}`), g.setAttribute("y", `${r}`), g.setAttribute("width", `${a}`), g.setAttribute("height", `${o}`);
    }
    const f = this.rootEl.querySelector("#guidekit-card");
    f && this.positionCard(f, e);
  }
  bindAdvanceOnTrigger(e, t) {
    this.clearAdvanceListeners();
    const i = t.advance_on || "click";
    if (i === "click") {
      const r = () => {
        var a, o, s;
        (o = (a = this.callbacks) == null ? void 0 : a.onStepCompleted) == null || o.call(a, t), (s = this.callbacks) == null || s.onNext();
      };
      e.addEventListener("click", r, { once: !0 }), this.advanceListenerCleanups.push(() => e.removeEventListener("click", r));
    } else if (i === "input_valid") {
      const r = (a) => {
        var o, s, l;
        a.key === "Enter" && ((s = (o = this.callbacks) == null ? void 0 : o.onStepCompleted) == null || s.call(o, t), (l = this.callbacks) == null || l.onNext());
      };
      e.addEventListener("keydown", r), this.advanceListenerCleanups.push(() => e.removeEventListener("keydown", r));
    }
  }
  clearAdvanceListeners() {
    for (const e of this.advanceListenerCleanups)
      e();
    this.advanceListenerCleanups = [];
  }
  speak(e, t) {
    if (!(typeof window > "u" || !("speechSynthesis" in window)))
      try {
        window.speechSynthesis.cancel();
        const i = new SpeechSynthesisUtterance(`${e}. ${t}`);
        i.lang = this.locale === "hi" ? "hi-IN" : "en-US", window.speechSynthesis.speak(i);
      } catch {
      }
  }
  destroy() {
    this.clearAdvanceListeners(), window.removeEventListener("resize", this.resizeHandler), window.removeEventListener("scroll", this.resizeHandler), this.rootEl && (this.rootEl.remove(), this.rootEl = null), this.currentElement = null, this.currentStep = null;
  }
}
function J(n) {
  if (n.id)
    return `#${typeof CSS < "u" && CSS.escape ? CSS.escape(n.id) : n.id}`;
  const e = n.getAttribute("data-guide-id");
  if (e)
    return `[data-guide-id="${e}"]`;
  const t = n.getAttribute("data-testid");
  if (t)
    return `[data-testid="${t}"]`;
  const i = n.getAttribute("name");
  if (i && n.tagName.toLowerCase() === "input")
    return `input[name="${i}"]`;
  const r = n.tagName.toLowerCase(), a = Array.from(n.classList).filter((o) => !o.includes(":") && !o.includes("[") && !o.includes("/"));
  return a.length > 0 ? `${r}.${a.slice(0, 2).join(".")}` : r;
}
function Z(n = 40) {
  if (typeof document > "u") return [];
  const e = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='link']",
    "[role='tab']",
    "[role='checkbox']"
  ], t = Array.from(document.querySelectorAll(e.join(","))), i = [];
  for (let r = 0; r < t.length && i.length < n; r++) {
    const a = t[r];
    if (a.closest("guidekit-widget") || a.closest("#guidekit-spotlight-root"))
      continue;
    const o = a.getBoundingClientRect(), s = window.getComputedStyle ? window.getComputedStyle(a) : null;
    if (!(o.width > 0 && o.height > 0 && (s == null ? void 0 : s.display) !== "none" && (s == null ? void 0 : s.visibility) !== "hidden")) continue;
    const d = a.tagName.toLowerCase(), c = a.getAttribute("role") || (d === "button" ? "button" : d === "a" ? "link" : void 0), g = (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim(), h = a.getAttribute("aria-label") || a.getAttribute("title") || void 0, f = J(a), p = {};
    for (const _ of ["id", "class", "name", "type", "data-testid", "data-guide-id", "placeholder"]) {
      const w = a.getAttribute(_);
      w && (p[_] = w);
    }
    const m = a.closest("header, nav, main, footer, section, form"), y = m ? `${m.tagName.toLowerCase()}${m.id ? "#" + m.id : ""}` : void 0;
    i.push({
      candidate_id: `cand_${i.length}_${d}_${p.id || "elem"}`,
      tag: d,
      role: c,
      text: g.substring(0, 100) || void 0,
      accessible_name: h,
      css_selector: f,
      attrs: p,
      landmark: y
    });
  }
  return i;
}
async function X(n) {
  const e = n.map((i) => `${i.tag}|${i.attrs.id || ""}|${i.attrs["data-testid"] || ""}|${i.text || ""}`).sort().join(";");
  if (typeof crypto < "u" && crypto.subtle && typeof TextEncoder < "u")
    try {
      const i = new TextEncoder().encode(e), r = await crypto.subtle.digest("SHA-256", i);
      return Array.from(new Uint8Array(r)).map((o) => o.toString(16).padStart(2, "0")).join("");
    } catch {
    }
  let t = 2166136261;
  for (let i = 0; i < e.length; i++)
    t ^= e.charCodeAt(i), t += (t << 1) + (t << 4) + (t << 7) + (t << 8) + (t << 24);
  return "dom_" + (t >>> 0).toString(16);
}
function O(n) {
  if (!n || typeof window > "u") return !1;
  try {
    if (n.type === "cookie" && n.name)
      return document.cookie.split(";").some((e) => e.trim().startsWith(`${n.name}=`));
    if (n.type === "localStorage" && n.key) {
      const e = localStorage.getItem(n.key);
      return e !== null && e !== "" && e !== "null" && e !== "undefined";
    }
    if (n.type === "dom" && n.selector)
      return document.querySelector(n.selector) !== null;
  } catch {
    return !1;
  }
  return !1;
}
function M() {
  var t;
  if (typeof window > "u") return "/";
  const n = document.querySelector("[data-current-route]");
  if (n) {
    const i = n.getAttribute("data-current-route");
    if (i) return i.startsWith("/") ? i : "/" + i;
  }
  const e = (t = document.body) == null ? void 0 : t.getAttribute("data-guidekit-route");
  return e ? e.startsWith("/") ? e : "/" + e : window.location.pathname || "/";
}
function tt(n) {
  var i;
  if (typeof window > "u")
    return { is_logged_in: !1, role: null };
  let e = !1;
  if (n != null && n.signed_in && O(n.signed_in) && (e = !0), !e && (n != null && n.alt) && Array.isArray(n.alt)) {
    for (const r of n.alt)
      if (O(r)) {
        e = !0;
        break;
      }
  }
  if (!e) {
    const r = [
      "token",
      "access_token",
      "auth_token",
      "session",
      "driver_token",
      "passenger_token",
      "guidekit_demo_auth"
    ];
    for (const a of r) {
      const o = localStorage.getItem(a);
      if (o && o !== "false" && o !== "null" && o !== "") {
        e = !0;
        break;
      }
    }
  }
  let t = null;
  if (e) {
    if (n != null && n.role_source) {
      const r = n.role_source;
      if (r.type === "localStorage" && r.key)
        t = localStorage.getItem(r.key);
      else if (r.type === "dom" && r.selector) {
        const a = document.querySelector(r.selector);
        a && (t = r.attribute ? a.getAttribute(r.attribute) : ((i = a.textContent) == null ? void 0 : i.trim()) || null);
      }
    }
    t || (t = localStorage.getItem("role") || localStorage.getItem("user_role") || (localStorage.getItem("driver_token") ? "driver" : null) || (localStorage.getItem("passenger_token") ? "passenger" : null));
  }
  return {
    is_logged_in: e,
    role: t ? t.toLowerCase() : null
  };
}
function A(n) {
  return n ? n.tagName.toLowerCase() === "option" ? n.closest("select") || n.parentElement : n : null;
}
function T(n) {
  if (!n.isConnected) return !1;
  if (n.tagName.toLowerCase() === "option") {
    const i = n.closest("select") || n.parentElement;
    if (i) return T(i);
  }
  const e = n.getBoundingClientRect();
  if (e.width <= 0 || e.height <= 0) return !1;
  const t = window.getComputedStyle ? window.getComputedStyle(n) : null;
  return !(t && (t.display === "none" || t.visibility === "hidden" || t.opacity === "0"));
}
function et(n) {
  if (typeof document > "u") return null;
  const e = n.target_fingerprint || {}, t = e.guide_id || n.guide_id;
  if (t) {
    const r = A(document.querySelector(`[data-guide-id="${t}"]`));
    if (r && T(r)) return r;
  }
  if (e.attrs && e.attrs["data-testid"]) {
    const r = A(document.querySelector(`[data-testid="${e.attrs["data-testid"]}"]`));
    if (r && T(r)) return r;
  }
  const i = e.css || e.primary_selector;
  if (i)
    try {
      const r = A(document.querySelector(i));
      if (r && T(r)) return r;
    } catch {
    }
  if (e.attrs && e.attrs.id) {
    const r = A(document.getElementById(e.attrs.id));
    if (r && T(r)) return r;
  }
  return null;
}
function it(n) {
  if (typeof document > "u") return { element: null, score: 0 };
  const e = n.target_fingerprint || {}, t = (e.tag || "").toLowerCase(), i = (e.role || (t === "button" ? "button" : t === "a" ? "link" : "")).toLowerCase(), r = (e.text || "").toLowerCase().trim(), a = e.attrs || {}, o = Array.from(
    document.querySelectorAll("button, a, input, select, textarea, [role='button'], [role='link']")
  ).filter((d) => d.closest("guidekit-widget") || d.closest("#guidekit-spotlight-root") ? !1 : T(d));
  let s = null, l = 0;
  for (const d of o) {
    let c = 0;
    const g = d.tagName.toLowerCase(), h = (d.getAttribute("role") || (g === "button" ? "button" : g === "a" ? "link" : "")).toLowerCase(), f = (d.innerText || d.textContent || "").toLowerCase().trim(), p = d.getAttribute("data-testid") || "", m = d.id || "";
    i && h === i ? c += 0.35 : t && g === t && (c += 0.3), r && f && (f === r ? c += 0.45 : (f.includes(r) || r.includes(f)) && (c += 0.3)), a["data-testid"] && p && (p === a["data-testid"] ? c += 0.3 : (p.includes(a["data-testid"]) || a["data-testid"].includes(p)) && (c += 0.15)), a.id && m && m === a.id && (c += 0.2), c > l && (l = c, s = d);
  }
  return l >= 0.72 ? { element: s, score: l } : { element: null, score: l };
}
async function rt(n, e, t, i = "en") {
  const r = Date.now(), a = M(), o = et(n);
  if (o) {
    const h = Date.now() - r;
    return t.trackResolution({
      step_id: n.step_id,
      status: "matched_primary",
      resolution_ms: h,
      page_path: a
    }), {
      element: o,
      status: "matched_primary",
      confidence: 1,
      resolutionTimeMs: h
    };
  }
  const s = it(n);
  if (s.element) {
    const h = Date.now() - r;
    return t.trackResolution({
      step_id: n.step_id,
      status: "matched_fingerprint",
      resolution_ms: h,
      page_path: a
    }), {
      element: s.element,
      status: "matched_fingerprint",
      confidence: s.score,
      resolutionTimeMs: h
    };
  }
  try {
    const h = Z(40), f = await X(h), p = await e.heal({
      stepId: n.step_id,
      pagePath: a,
      domHash: f,
      locale: i,
      candidates: h
    }), m = Date.now() - r;
    if ((p.status === "healed_by_ai" || p.status === "cache_hit") && p.suggested_selector) {
      const y = document.querySelector(p.suggested_selector);
      if (y && T(y))
        return t.trackResolution({
          step_id: n.step_id,
          status: p.status,
          resolution_ms: m,
          page_path: a,
          dom_hash: f,
          detected_dom_selector: p.suggested_selector
        }), {
          element: y,
          status: p.status,
          suggestedSelector: p.suggested_selector,
          confidence: p.confidence,
          resolutionTimeMs: m
        };
    }
  } catch (h) {
    console.warn("[GuideKit] Tier 3 AI heal failed or was unreachable:", h);
  }
  const l = Date.now() - r, d = n.content || {}, c = d[i] || d.en || {}, g = c.description || c.title || `Perform action on ${n.route_pattern}`;
  return t.trackResolution({
    step_id: n.step_id,
    status: "fallback_to_text",
    resolution_ms: l,
    page_path: a
  }), {
    element: null,
    status: "fallback_to_text",
    fallbackText: g,
    confidence: 0,
    resolutionTimeMs: l
  };
}
const at = '/*! tailwindcss v4.3.5 | MIT License | https://tailwindcss.com */@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:block))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-backdrop-blur:initial;--tw-backdrop-brightness:initial;--tw-backdrop-contrast:initial;--tw-backdrop-grayscale:initial;--tw-backdrop-hue-rotate:initial;--tw-backdrop-invert:initial;--tw-backdrop-opacity:initial;--tw-backdrop-saturate:initial;--tw-backdrop-sepia:initial;--tw-duration:initial;--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0}}}@layer theme{:root,:host{--font-sans:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;--color-red-100:oklch(93.6% .032 17.717);--color-red-300:oklch(80.8% .114 19.571);--color-red-400:oklch(70.4% .191 22.216);--color-red-950:oklch(25.8% .092 26.042);--color-amber-200:oklch(92.4% .12 95.746);--color-amber-300:oklch(87.9% .169 91.605);--color-amber-400:oklch(82.8% .189 84.429);--color-amber-950:oklch(27.9% .077 45.635);--color-emerald-400:oklch(76.5% .177 163.223);--spacing:.25rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--font-weight-medium:500;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--radius-2xl:1rem;--animate-pulse:pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;--blur-2xl:40px;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono)}}@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;-moz-tab-size:4;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring:where(:not(iframe)){outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab,red,red)){::placeholder{color:color-mix(in oklab,currentcolor 50%,transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit{padding-block:0}::-webkit-datetime-edit-year-field{padding-block:0}::-webkit-datetime-edit-month-field{padding-block:0}::-webkit-datetime-edit-day-field{padding-block:0}::-webkit-datetime-edit-hour-field{padding-block:0}::-webkit-datetime-edit-minute-field{padding-block:0}::-webkit-datetime-edit-second-field{padding-block:0}::-webkit-datetime-edit-millisecond-field{padding-block:0}::-webkit-datetime-edit-meridiem-field{padding-block:0}::-webkit-calendar-picker-indicator{line-height:1}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]){-webkit-appearance:button;-moz-appearance:button;appearance:button}::file-selector-button{-webkit-appearance:button;-moz-appearance:button;appearance:button}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}}@layer components;@layer utilities{.pointer-events-auto{pointer-events:auto}.pointer-events-none{pointer-events:none}.visible{visibility:visible}.sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.fixed{position:fixed}.relative{position:relative}.inset-x-0{inset-inline:0}.z-\\[2147483640\\]{z-index:2147483640}.container{width:100%}@media (min-width:40rem){.container{max-width:40rem}}@media (min-width:48rem){.container{max-width:48rem}}@media (min-width:64rem){.container{max-width:64rem}}@media (min-width:80rem){.container{max-width:80rem}}@media (min-width:96rem){.container{max-width:96rem}}.mx-4{margin-inline:calc(var(--spacing) * 4)}.mt-1{margin-top:var(--spacing)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-3{margin-top:calc(var(--spacing) * 3)}.mb-2{margin-bottom:calc(var(--spacing) * 2)}.mb-3{margin-bottom:calc(var(--spacing) * 3)}.ml-9{margin-left:calc(var(--spacing) * 9)}.block{display:block}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline{display:inline}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.table{display:table}.h-1{height:var(--spacing)}.h-1\\.5{height:calc(var(--spacing) * 1.5)}.h-4{height:calc(var(--spacing) * 4)}.h-7{height:calc(var(--spacing) * 7)}.h-8{height:calc(var(--spacing) * 8)}.h-9{height:calc(var(--spacing) * 9)}.h-11{height:calc(var(--spacing) * 11)}.h-14{height:calc(var(--spacing) * 14)}.h-\\[18px\\]{height:18px}.h-\\[min\\(var\\(--gk-panel-height\\)\\,calc\\(100dvh-32px\\)\\)\\]{height:min(var(--gk-panel-height),calc(100dvh - 32px))}.min-h-11{min-height:calc(var(--spacing) * 11)}.min-h-12{min-height:calc(var(--spacing) * 12)}.min-h-14{min-height:calc(var(--spacing) * 14)}.min-h-16{min-height:calc(var(--spacing) * 16)}.min-h-\\[72px\\]{min-height:72px}.w-1{width:var(--spacing)}.w-1\\.5{width:calc(var(--spacing) * 1.5)}.w-4{width:calc(var(--spacing) * 4)}.w-7{width:calc(var(--spacing) * 7)}.w-8{width:calc(var(--spacing) * 8)}.w-9{width:calc(var(--spacing) * 9)}.w-11{width:calc(var(--spacing) * 11)}.w-14{width:calc(var(--spacing) * 14)}.w-\\[18px\\]{width:18px}.w-full{width:100%}.max-w-\\[82\\%\\]{max-width:82%}.max-w-\\[92\\%\\]{max-width:92%}.max-w-\\[min\\(360px\\,var\\(--gk-panel-max-width\\)\\)\\]{max-width:min(360px,var(--gk-panel-max-width))}.max-w-full{max-width:100%}.min-w-0{min-width:0}.min-w-11{min-width:calc(var(--spacing) * 11)}.min-w-\\[92px\\]{min-width:92px}.flex-1{flex:1}.flex-shrink{flex-shrink:1}.shrink-0{flex-shrink:0}.grow{flex-grow:1}.transform{transform:var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )}.animate-pulse{animation:var(--animate-pulse)}.resize{resize:both}.flex-col{flex-direction:column}.place-items-center{place-items:center}.items-center{align-items:center}.items-end{align-items:flex-end}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}.justify-start{justify-content:flex-start}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-3{gap:calc(var(--spacing) * 3)}.gap-4{gap:calc(var(--spacing) * 4)}.gap-5{gap:calc(var(--spacing) * 5)}.self-end{align-self:flex-end}.self-start{align-self:flex-start}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}.rounded-2xl{border-radius:var(--radius-2xl)}.rounded-\\[14px\\]{border-radius:14px}.rounded-\\[15px\\]{border-radius:15px}.rounded-\\[18px\\]{border-radius:18px}.rounded-\\[20px\\]{border-radius:20px}.rounded-\\[var\\(--gk-radius\\)\\]{border-radius:var(--gk-radius)}.rounded-full{border-radius:2147483647px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-xl{border-radius:var(--radius-xl)}.rounded-br-md{border-bottom-right-radius:var(--radius-md)}.rounded-bl-md{border-bottom-left-radius:var(--radius-md)}.border{border-style:var(--tw-border-style);border-width:1px}.border-0{border-style:var(--tw-border-style);border-width:0}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-amber-400{border-color:var(--color-amber-400)}.border-red-400{border-color:var(--color-red-400)}.bg-\\[var\\(--gk-accent\\)\\]{background-color:var(--gk-accent)}.bg-\\[var\\(--gk-canvas\\)\\]{background-color:var(--gk-canvas)}.bg-\\[var\\(--gk-surface\\)\\]{background-color:var(--gk-surface)}.bg-\\[var\\(--gk-surface-hover\\)\\]{background-color:var(--gk-surface-hover)}.bg-amber-300{background-color:var(--color-amber-300)}.bg-amber-400{background-color:var(--color-amber-400)}.bg-amber-400\\/10{background-color:#fcbb001a}@supports (color:color-mix(in lab,red,red)){.bg-amber-400\\/10{background-color:color-mix(in oklab,var(--color-amber-400) 10%,transparent)}}.bg-amber-950{background-color:var(--color-amber-950)}.bg-amber-950\\/30{background-color:#4619014d}@supports (color:color-mix(in lab,red,red)){.bg-amber-950\\/30{background-color:color-mix(in oklab,var(--color-amber-950) 30%,transparent)}}.bg-emerald-400{background-color:var(--color-emerald-400)}.bg-red-950{background-color:var(--color-red-950)}.bg-red-950\\/45{background-color:#46080973}@supports (color:color-mix(in lab,red,red)){.bg-red-950\\/45{background-color:color-mix(in oklab,var(--color-red-950) 45%,transparent)}}.bg-transparent{background-color:#0000}.p-1{padding:var(--spacing)}.p-1\\.5{padding:calc(var(--spacing) * 1.5)}.p-3{padding:calc(var(--spacing) * 3)}.p-3\\.5{padding:calc(var(--spacing) * 3.5)}.p-4{padding:calc(var(--spacing) * 4)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-3\\.5{padding-inline:calc(var(--spacing) * 3.5)}.px-4{padding-inline:calc(var(--spacing) * 4)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-3{padding-block:calc(var(--spacing) * 3)}.pt-2{padding-top:calc(var(--spacing) * 2)}.pt-3{padding-top:calc(var(--spacing) * 3)}.pt-3\\.5{padding-top:calc(var(--spacing) * 3.5)}.pb-2{padding-bottom:calc(var(--spacing) * 2)}.pb-2\\.5{padding-bottom:calc(var(--spacing) * 2.5)}.pl-4{padding-left:calc(var(--spacing) * 4)}.text-left{text-align:left}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[13px\\]{font-size:13px}.leading-4{--tw-leading:calc(var(--spacing) * 4);line-height:calc(var(--spacing) * 4)}.leading-5{--tw-leading:calc(var(--spacing) * 5);line-height:calc(var(--spacing) * 5)}.leading-\\[1\\.55\\]{--tw-leading:1.55;line-height:1.55}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.tracking-\\[0\\.08em\\]{--tw-tracking:.08em;letter-spacing:.08em}.text-\\[var\\(--gk-accent\\)\\]{color:var(--gk-accent)}.text-\\[var\\(--gk-accent-text\\)\\]{color:var(--gk-accent-text)}.text-\\[var\\(--gk-muted\\)\\]{color:var(--gk-muted)}.text-\\[var\\(--gk-text\\)\\]{color:var(--gk-text)}.text-amber-200{color:var(--color-amber-200)}.text-amber-300{color:var(--color-amber-300)}.text-amber-950{color:var(--color-amber-950)}.text-red-100{color:var(--color-red-100)}.text-red-300{color:var(--color-red-300)}.lowercase{text-transform:lowercase}.uppercase{text-transform:uppercase}.shadow{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_0_0_4px_rgba\\(82\\,169\\,255\\,0\\.09\\)\\]{--tw-shadow:0 0 0 4px var(--tw-shadow-color,#52a9ff17);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_1px_0_rgba\\(255\\,255\\,255\\,0\\.04\\)_inset\\]{--tw-shadow:0 1px 0 var(--tw-shadow-color,#ffffff0a) inset;box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_1px_0_rgba\\(255\\,255\\,255\\,0\\.15\\)_inset\\]{--tw-shadow:0 1px 0 var(--tw-shadow-color,#ffffff26) inset;box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_1px_0_rgba\\(255\\,255\\,255\\,0\\.035\\)_inset\\]{--tw-shadow:0 1px 0 var(--tw-shadow-color,#ffffff09) inset;box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_18px_55px_rgba\\(0\\,0\\,0\\,0\\.52\\)\\]{--tw-shadow:0 18px 55px var(--tw-shadow-color,#00000085);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_18px_55px_rgba\\(0\\,0\\,0\\,0\\.56\\)\\]{--tw-shadow:0 18px 55px var(--tw-shadow-color,#0000008f);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-\\[0_28px_90px_rgba\\(0\\,0\\,0\\,0\\.68\\)\\]{--tw-shadow:0 28px 90px var(--tw-shadow-color,#000000ad);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.ring{--tw-ring-shadow:var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}.backdrop-blur-2xl{--tw-backdrop-blur:blur(var(--blur-2xl));-webkit-backdrop-filter:var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );backdrop-filter:var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,color\\,transform\\]{transition-property:background-color,color,transform;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[background-color\\,transform\\]{transition-property:background-color,transform;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[box-shadow\\,background-color\\]{transition-property:box-shadow,background-color;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-\\[transform\\,background-color\\]{transition-property:transform,background-color;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.duration-150{--tw-duration:.15s;transition-duration:.15s}.outline-none{--tw-outline-style:none;outline-style:none}.placeholder\\:text-\\[var\\(--gk-muted\\)\\]::placeholder{color:var(--gk-muted)}.focus-within\\:bg-\\[var\\(--gk-surface-hover\\)\\]:focus-within{background-color:var(--gk-surface-hover)}.focus-within\\:shadow-\\[0_0_0_2px_var\\(--gk-accent\\)\\]:focus-within{--tw-shadow:0 0 0 2px var(--tw-shadow-color,var(--gk-accent));box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}@media (hover:hover){.hover\\:-translate-y-0\\.5:hover{--tw-translate-y:calc(var(--spacing) * -.5);translate:var(--tw-translate-x) var(--tw-translate-y)}.hover\\:bg-\\[var\\(--gk-accent-hover\\)\\]:hover{background-color:var(--gk-accent-hover)}.hover\\:bg-\\[var\\(--gk-surface\\)\\]:hover{background-color:var(--gk-surface)}.hover\\:bg-\\[var\\(--gk-surface-hover\\)\\]:hover{background-color:var(--gk-surface-hover)}.hover\\:bg-amber-200:hover{background-color:var(--color-amber-200)}.hover\\:bg-red-400\\/10:hover{background-color:#ff65681a}@supports (color:color-mix(in lab,red,red)){.hover\\:bg-red-400\\/10:hover{background-color:color-mix(in oklab,var(--color-red-400) 10%,transparent)}}.hover\\:text-\\[var\\(--gk-text\\)\\]:hover{color:var(--gk-text)}.hover\\:text-red-300:hover{color:var(--color-red-300)}}.focus-visible\\:ring-2:focus-visible{--tw-ring-shadow:var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.focus-visible\\:ring-\\[var\\(--gk-accent\\)\\]:focus-visible{--tw-ring-color:var(--gk-accent)}.focus-visible\\:ring-offset-2:focus-visible{--tw-ring-offset-width:2px;--tw-ring-offset-shadow:var(--tw-ring-inset, ) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.focus-visible\\:ring-offset-\\[var\\(--gk-canvas\\)\\]:focus-visible{--tw-ring-offset-color:var(--gk-canvas)}.focus-visible\\:outline-none:focus-visible{--tw-outline-style:none;outline-style:none}.active\\:translate-y-0:active{--tw-translate-y:0px;translate:var(--tw-translate-x) var(--tw-translate-y)}.active\\:translate-y-px:active{--tw-translate-y:1px;translate:var(--tw-translate-x) var(--tw-translate-y)}.disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\\:opacity-35:disabled{opacity:.35}@media (min-width:40rem){.sm\\:p-4{padding:calc(var(--spacing) * 4)}.sm\\:pt-2{padding-top:calc(var(--spacing) * 2)}}}:host{--gk-accent:#52a9ff;--gk-accent-hover:#75bbef;--gk-canvas:#0f1217f5;--gk-surface:#1d222b;--gk-surface-hover:#252b35;--gk-border:#ffffff17;--gk-text:#f1f4f9;--gk-muted:#b8c0ce;--gk-font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;--gk-bottom-offset:24px;--gk-side-offset:24px;--gk-panel-width:420px;--gk-panel-height:560px;--gk-panel-max-width: calc(100vw - 32px) ;--gk-radius:24px;color-scheme:dark;font-family:var(--gk-font-family)}:host,:host *{box-sizing:border-box}.gk-root{width:100vw;max-width:100vw;inset-inline:0 auto;bottom:max(var(--gk-bottom-offset),env(safe-area-inset-bottom));padding-inline:max(var(--gk-side-offset),12px)}.chat-panel{width:min(var(--gk-panel-width),var(--gk-panel-max-width));transform-origin:bottom}.gk-panel-opening{will-change:transform,opacity;animation:.24s cubic-bezier(.16,1,.3,1) both gk-panel-in}.gk-panel-closing{pointer-events:none;will-change:transform,opacity;animation:.18s cubic-bezier(.4,0,1,1) both gk-panel-out!important}.gk-launcher-opening{transform-origin:bottom;will-change:transform,opacity;animation:.18s cubic-bezier(.16,1,.3,1) both gk-launcher-in}.messages-area{overscroll-behavior:contain}.gk-scrollbar{scrollbar-color:var(--gk-border) transparent}@supports (color:color-mix(in lab,red,red)){.gk-scrollbar{scrollbar-color:color-mix(in srgb,var(--gk-border) 80%,transparent) transparent}}.gk-scrollbar{scrollbar-width:thin}.gk-scrollbar::-webkit-scrollbar{width:8px;height:8px}.gk-scrollbar::-webkit-scrollbar-thumb{background:var(--gk-border);border:2px solid #0000;border-radius:999px}@supports (color:color-mix(in lab,red,red)){.gk-scrollbar::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--gk-border) 80%,transparent)}}.gk-scrollbar::-webkit-scrollbar-thumb{background-clip:padding-box}@keyframes gk-panel-in{0%{opacity:0;transform:translateY(18px)scale(.965)}to{opacity:1;transform:translateY(0)scale(1)}}@keyframes gk-panel-out{0%{opacity:1;transform:translateY(0)scale(1)}to{opacity:0;transform:translateY(16px)scale(.97)}}@keyframes gk-launcher-in{0%{opacity:0;transform:translateY(5px)scale(.86)}to{opacity:1;transform:translateY(0)scale(1)}}@media (max-width:480px){.gk-root{padding-inline:max(var(--gk-side-offset),8px)}.chat-panel{height:min(var(--gk-panel-height),calc(100dvh - 32px))}}@media (prefers-reduced-motion:reduce){:host *,:host :before,:host :after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation:none!important}}@property --tw-rotate-x{syntax:"*";inherits:false}@property --tw-rotate-y{syntax:"*";inherits:false}@property --tw-rotate-z{syntax:"*";inherits:false}@property --tw-skew-x{syntax:"*";inherits:false}@property --tw-skew-y{syntax:"*";inherits:false}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-leading{syntax:"*";inherits:false}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-tracking{syntax:"*";inherits:false}@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:"*";inherits:false}@property --tw-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:"*";inherits:false}@property --tw-inset-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:"*";inherits:false}@property --tw-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:"*";inherits:false}@property --tw-inset-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:"*";inherits:false}@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:"*";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-backdrop-blur{syntax:"*";inherits:false}@property --tw-backdrop-brightness{syntax:"*";inherits:false}@property --tw-backdrop-contrast{syntax:"*";inherits:false}@property --tw-backdrop-grayscale{syntax:"*";inherits:false}@property --tw-backdrop-hue-rotate{syntax:"*";inherits:false}@property --tw-backdrop-invert{syntax:"*";inherits:false}@property --tw-backdrop-opacity{syntax:"*";inherits:false}@property --tw-backdrop-saturate{syntax:"*";inherits:false}@property --tw-backdrop-sepia{syntax:"*";inherits:false}@property --tw-duration{syntax:"*";inherits:false}@property --tw-translate-x{syntax:"*";inherits:false;initial-value:0}@property --tw-translate-y{syntax:"*";inherits:false;initial-value:0}@property --tw-translate-z{syntax:"*";inherits:false;initial-value:0}@keyframes pulse{50%{opacity:.5}}', nt = {
  accent: "#52a9ff",
  accentHover: "#75bbef",
  accentText: "#07111d",
  canvas: "rgba(15, 18, 23, 0.96)",
  surface: "#1d222b",
  surfaceHover: "#252b35",
  border: "rgba(255, 255, 255, 0.09)",
  text: "#f1f4f9",
  mutedText: "#b8c0ce",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}, ot = {
  position: "bottom-center",
  bottomOffset: 24,
  sideOffset: 16,
  panelWidth: 420,
  panelHeight: 560,
  borderRadius: 24,
  launcherLabel: "Ask Guide",
  assistantName: "",
  maxSuggestions: 3,
  showLocaleControl: !0,
  showVoiceControl: !1,
  soundEnabled: !0,
  greeting: void 0,
  placeholder: void 0,
  theme: nt
}, b = {
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
    </svg>`
}, k = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gk-canvas)]", H = "bubble-assistant rounded-[20px] rounded-bl-md bg-[var(--gk-surface)] px-4 py-3 text-[13px] leading-[1.55] text-[var(--gk-text)] shadow-[0_1px_0_rgba(255,255,255,0.035)_inset]", v = (n) => n.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"), K = (n) => v(n).replaceAll(`
`, "<br>"), E = (n, e, t, i) => Number.isFinite(n) ? Math.min(t, Math.max(e, n)) : i, st = (n) => n === "bottom-center" || n === "bottom-left" || n === "bottom-right";
class lt extends HTMLElement {
  constructor() {
    super();
    u(this, "shadow");
    u(this, "isOpen", !1);
    u(this, "isSending", !1);
    u(this, "locale", "en");
    u(this, "ttsEnabled", !1);
    u(this, "manifest", null);
    u(this, "callbacks");
    u(this, "activeTourTitle", null);
    u(this, "options", ot);
    u(this, "transitionNonce", 0);
    u(this, "closeTimer", null);
    u(this, "audioContext", null);
    this.shadow = this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.applyTheme(), this.render();
  }
  disconnectedCallback() {
    var t;
    this.closeTimer !== null && window.clearTimeout(this.closeTimer), this.closeTimer = null, (t = this.audioContext) == null || t.close().catch(() => {
    }), this.audioContext = null;
  }
  init(t, i, r, a) {
    this.manifest = t, this.locale = i, this.callbacks = r, this.setOptions(a || {});
  }
  setOptions(t) {
    const i = st(t.position) ? t.position : this.options.position;
    this.options = {
      ...this.options,
      ...t,
      position: i,
      bottomOffset: E(t.bottomOffset, 12, 96, this.options.bottomOffset),
      sideOffset: E(t.sideOffset, 12, 96, this.options.sideOffset),
      panelWidth: E(t.panelWidth, 320, 560, this.options.panelWidth),
      panelHeight: E(t.panelHeight, 420, 760, this.options.panelHeight),
      borderRadius: E(t.borderRadius, 12, 28, this.options.borderRadius),
      maxSuggestions: E(t.maxSuggestions, 0, 5, this.options.maxSuggestions),
      theme: {
        ...this.options.theme,
        ...t.theme
      }
    }, this.applyTheme(), this.render();
  }
  setLocale(t) {
    this.locale = t, this.render();
  }
  setManifest(t) {
    this.manifest = t, this.render();
  }
  setActiveTourProgress(t) {
    this.activeTourTitle = t, this.render();
  }
  open() {
    this.transitionNonce += 1, this.closeTimer !== null && window.clearTimeout(this.closeTimer), this.closeTimer = null, this.isOpen = !0, this.render();
    const t = this.shadow.querySelector(".chat-input");
    window.setTimeout(() => t == null ? void 0 : t.focus(), this.prefersReducedMotion() ? 0 : 180);
  }
  close() {
    if (!this.isOpen) return;
    const t = this.shadow.querySelector(".chat-panel"), i = ++this.transitionNonce, r = () => {
      i === this.transitionNonce && (this.closeTimer !== null && window.clearTimeout(this.closeTimer), this.closeTimer = null, this.isOpen = !1, this.render(), window.setTimeout(() => {
        var a;
        return (a = this.shadow.querySelector("#gk-launcher")) == null ? void 0 : a.focus();
      }, 0));
    };
    if (!t || this.prefersReducedMotion()) {
      r();
      return;
    }
    t.setAttribute("inert", ""), t.classList.remove("gk-panel-opening"), t.classList.add("gk-panel-closing"), t.addEventListener(
      "animationend",
      (a) => {
        a.target === t && r();
      },
      { once: !0 }
    ), this.closeTimer = window.setTimeout(r, 240);
  }
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  addAssistantMessage(t, i) {
    var c, g;
    const r = this.shadow.querySelector(".messages-area");
    if (!r) return;
    const a = document.createElement("div");
    a.className = "msg-row msg-assistant flex max-w-[92%] flex-col gap-2 self-start";
    const o = i != null && i.isError ? ' role="alert"' : "", s = i != null && i.isError ? " bg-red-950/45 text-red-100" : "";
    let l = `
      <div class="flex items-end gap-2">
        <span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${b.chat}</span>
        <div${o} class="${H}${s}">${K(t)}</div>
      </div>`;
    const d = Date.now() + Math.random().toString(36).substring(2, 7);
    if (i != null && i.tourPlan) {
      const h = i.tourPlan;
      l += `
        <div class="card-tour-stitch ml-9 rounded-2xl bg-[var(--gk-surface)] p-3">
          ${h.requires_login_first ? '<div class="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] leading-4 text-amber-200"><strong class="font-medium">Sign-in required.</strong> The guide will begin with authentication.</div>' : ""}
          <p class="mb-3 text-[11px] leading-4 text-[var(--gk-muted)]">${h.steps.length} guided ${h.steps.length === 1 ? "step" : "steps"} ready</p>
          <button class="btn-start-tour ${k} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gk-accent)] px-4 text-xs font-medium text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px" id="btn-start-tour-${d}" type="button">
            Start guided tour ${b.arrow}
          </button>
        </div>
      `;
    } else i != null && i.suggestedTourPlan && i.suggestedTourPlan.steps.length > 0 && (i.suggestedTourPlan, l += `
        <div class="card-tour-stitch ml-9 rounded-2xl bg-[var(--gk-surface)] p-3">
          <p class="mb-3 text-[11px] leading-4 text-[var(--gk-muted)]">A guided walkthrough is available for this feature.</p>
          <button class="btn-start-tour ${k} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gk-accent)] px-4 text-xs font-medium text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px" id="btn-suggested-tour-${d}" type="button">
            Show me on screen ${b.arrow}
          </button>
        </div>
      `);
    a.innerHTML = l, r.appendChild(a), r.scrollTop = r.scrollHeight, this.ttsEnabled && !(i != null && i.isError) && this.speak(t), i != null && i.tourPlan ? (c = a.querySelector(`#btn-start-tour-${d}`)) == null || c.addEventListener("click", () => {
      var h;
      (h = this.callbacks) == null || h.onStartTour(i.tourPlan);
    }) : i != null && i.suggestedTourPlan && ((g = a.querySelector(`#btn-suggested-tour-${d}`)) == null || g.addEventListener("click", () => {
      var h;
      (h = this.callbacks) == null || h.onStartTour(i.suggestedTourPlan);
    }));
  }
  showTier4FallbackCard(t, i) {
    var g;
    this.open();
    const r = this.shadow.querySelector(".messages-area");
    if (!r) return;
    const a = t.content || {}, o = a[this.locale] || a.en || {}, s = o.title || t.guide_id || "Action required", l = o.description || `Continue on ${t.route_pattern}`, d = `btn-continue-step-${Date.now()}`, c = document.createElement("div");
    c.className = "msg-row msg-assistant ml-9 flex max-w-[82%] flex-col self-start", c.innerHTML = `
      <div class="rounded-2xl bg-amber-950/30 p-3.5">
        <p class="text-[11px] font-medium text-amber-300">Step ${t.execution_index} · Text guidance</p>
        <p class="mt-2 text-sm font-medium text-[var(--gk-text)]">${v(String(s))}</p>
        <p class="mt-1 text-xs leading-5 text-[var(--gk-muted)]">${v(String(l))}</p>
        <button class="btn-start-tour ${k} mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-200 active:translate-y-px" id="${d}" type="button">
          Continue ${b.arrow}
        </button>
      </div>
    `, r.appendChild(c), r.scrollTop = r.scrollHeight, this.ttsEnabled && this.speak(`${s}. ${l}`), (g = c.querySelector(`#${d}`)) == null || g.addEventListener("click", i);
  }
  applyTheme() {
    const t = {
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
      "--gk-radius": `${this.options.borderRadius}px`
    };
    Object.entries(t).forEach(([i, r]) => this.style.setProperty(i, r));
  }
  prefersReducedMotion() {
    return typeof window > "u" || typeof window.matchMedia != "function" ? !0 : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  playSendTick() {
    if (!this.options.soundEnabled || typeof window > "u") return;
    const t = window.AudioContext || window.webkitAudioContext;
    if (t)
      try {
        const i = this.audioContext || new t();
        this.audioContext = i;
        const r = () => {
          const a = i.currentTime, o = i.createOscillator(), s = i.createGain();
          o.type = "sine", o.frequency.setValueAtTime(760, a), o.frequency.exponentialRampToValueAtTime(1040, a + 0.05), s.gain.setValueAtTime(1e-4, a), s.gain.exponentialRampToValueAtTime(0.028, a + 6e-3), s.gain.exponentialRampToValueAtTime(1e-4, a + 0.06), o.connect(s), s.connect(i.destination), o.start(a), o.stop(a + 0.065), o.addEventListener("ended", () => {
            o.disconnect(), s.disconnect();
          });
        };
        i.state === "suspended" ? i.resume().then(r).catch(() => {
        }) : r();
      } catch {
      }
  }
  speak(t) {
    if (!(typeof window > "u" || !("speechSynthesis" in window)))
      try {
        window.speechSynthesis.cancel();
        const i = new SpeechSynthesisUtterance(t);
        i.lang = this.locale === "hi" ? "hi-IN" : this.locale, window.speechSynthesis.speak(i);
      } catch {
      }
  }
  getPositionClass() {
    return this.options.position === "bottom-left" ? "justify-start" : this.options.position === "bottom-right" ? "justify-end" : "justify-center";
  }
  getProjectName() {
    var t;
    return this.options.assistantName ? this.options.assistantName : (t = this.manifest) != null && t.project_slug ? this.manifest.project_slug.split("-").filter(Boolean).map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(" ") : "GuideKit";
  }
  getGreeting() {
    return this.options.greeting ? this.options.greeting : this.locale === "hi" ? "नमस्ते। किसी सुविधा के बारे में पूछें या नीचे दिए गए गाइड में से चुनें।" : "Ask how to use this page, or choose a suggested guide below.";
  }
  getPlaceholder() {
    return this.options.placeholder ? this.options.placeholder : this.locale === "hi" ? "गाइडकिट को संदेश भेजें…" : "Message GuideKit…";
  }
  stopTour() {
    var i;
    const t = this.activeTourTitle;
    (i = this.callbacks) == null || i.onStopTour(), this.activeTourTitle && (this.activeTourTitle = null, this.render()), this.isOpen && t && this.addAssistantMessage("Tour stopped. You can ask me anything else about this page.");
  }
  render() {
    var c, g, h, f, p, m, y, _;
    const t = this.getProjectName(), i = ((c = this.manifest) == null ? void 0 : c.supported_locales) || [this.locale], r = this.options.showLocaleControl && i.length > 1, a = (((g = this.manifest) == null ? void 0 : g.features) || []).slice(0, this.options.maxSuggestions).map((w) => {
      var C, L, I, S, P;
      const x = ((L = (C = w.content) == null ? void 0 : C[this.locale]) == null ? void 0 : L.title) || ((S = (I = w.content) == null ? void 0 : I.en) == null ? void 0 : S.title) || w.slug, $ = ((P = w.example_queries) == null ? void 0 : P[0]) || `How do I ${x}?`;
      return { label: x, query: $ };
    });
    if (this.shadow.innerHTML = `
      <style>${at}</style>
      <div class="gk-root pointer-events-none fixed inset-x-0 z-[2147483640] flex ${this.getPositionClass()}">
        ${this.isOpen ? `
          <section
            class="chat-panel gk-panel-opening pointer-events-auto flex h-[min(var(--gk-panel-height),calc(100dvh-32px))] flex-col overflow-hidden rounded-[var(--gk-radius)] bg-[var(--gk-canvas)] text-[var(--gk-text)] shadow-[0_28px_90px_rgba(0,0,0,0.68)] backdrop-blur-2xl"
            role="dialog"
            aria-modal="false"
            aria-label="${v(t)} assistant"
          >
            <header class="flex min-h-[72px] shrink-0 items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
              <div class="flex min-w-0 items-center gap-3">
                <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)] shadow-[0_0_0_4px_rgba(82,169,255,0.09)]">
                  ${b.chat}
                </div>
                <div class="min-w-0">
                  <h2 class="truncate text-sm font-medium leading-5 text-[var(--gk-text)]">${v(t)}</h2>
                  <p class="flex items-center gap-1.5 text-[11px] leading-4 text-[var(--gk-muted)]"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>${this.activeTourTitle ? "Guiding you now" : "Assistant"}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                ${this.options.showVoiceControl ? `<button class="icon-btn ${k} grid h-11 w-11 place-items-center rounded-[14px] bg-transparent text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-toggle-tts" type="button" aria-label="${this.ttsEnabled ? "Turn voice off" : "Turn voice on"}" aria-pressed="${this.ttsEnabled}" title="${this.ttsEnabled ? "Turn voice off" : "Turn voice on"}">${this.ttsEnabled ? b.volume : b.volumeOff}</button>` : ""}
                ${r ? `<button class="icon-btn ${k} h-11 min-w-11 rounded-[14px] bg-transparent px-2 text-[11px] font-medium uppercase text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-toggle-locale" type="button" aria-label="Change language. Current: ${v(this.locale)}" title="Change language">${v(this.locale.slice(0, 3).toUpperCase())}</button>` : ""}
                <button class="icon-btn ${k} grid h-11 w-11 place-items-center rounded-[14px] bg-transparent text-[var(--gk-muted)] transition-colors hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)]" id="gk-minimize-chat" type="button" aria-label="Minimize assistant" title="Minimize assistant">${b.minimize}</button>
              </div>
            </header>

            ${this.activeTourTitle ? `<div class="mx-4 mb-2 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-[var(--gk-surface)] px-3 py-2">
                    <div class="min-w-0">
                      <p class="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--gk-accent)]">Tour in progress</p>
                      <p class="truncate text-xs text-[var(--gk-text)]">${v(this.activeTourTitle)}</p>
                    </div>
                    <button class="${k} inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium text-red-300 transition-colors hover:bg-red-400/10" id="gk-stop-tour" type="button">${b.stop}<span>Stop tour</span></button>
                  </div>` : ""}

            ${a.length > 0 ? `<div class="gk-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 py-2" aria-label="Suggested prompts">
                    ${a.map(
      (w) => `<button class="chip ${k} min-h-11 shrink-0 rounded-full bg-[var(--gk-surface)] px-3.5 text-xs font-medium text-[var(--gk-muted)] transition-[background-color,color,transform] hover:bg-[var(--gk-surface-hover)] hover:text-[var(--gk-text)] active:translate-y-px" type="button" data-query="${v(w.query)}">${v(w.label)}</button>`
    ).join("")}
                  </div>` : ""}

            <div class="messages-area gk-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-3" id="gk-messages" aria-live="polite" aria-busy="false">
              <div class="msg-row msg-assistant flex max-w-[92%] self-start">
                <div class="flex items-end gap-2">
                  <span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${b.chat}</span>
                  <div class="${H}">${v(this.getGreeting())}</div>
                </div>
              </div>
            </div>

            <form class="chat-footer shrink-0 bg-[var(--gk-canvas)] p-3 pt-2 sm:p-4 sm:pt-2" id="gk-search-form">
              <label class="sr-only" for="gk-input">Message the assistant</label>
              <div class="composer flex min-h-14 items-center gap-2 rounded-[20px] bg-[var(--gk-surface)] p-1.5 pl-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[box-shadow,background-color] focus-within:bg-[var(--gk-surface-hover)] focus-within:shadow-[0_0_0_2px_var(--gk-accent)]">
                <input class="chat-input min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] leading-5 text-[var(--gk-text)] outline-none placeholder:text-[var(--gk-muted)]" id="gk-input" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" placeholder="${v(this.getPlaceholder())}" />
                <button class="btn-send ${k} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)] transition-[background-color,transform] hover:bg-[var(--gk-accent-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35" id="gk-send" type="submit" aria-label="Send message" title="Send message" disabled>${b.send}</button>
              </div>
            </form>
          </section>
        ` : this.activeTourTitle ? `
                <div class="tour-dock gk-launcher-opening pointer-events-auto flex max-w-[min(360px,var(--gk-panel-max-width))] items-center gap-1 rounded-[20px] bg-[var(--gk-canvas)] p-1.5 text-[var(--gk-text)] shadow-[0_18px_55px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
                  <button
                    class="${k} flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[15px] px-3 text-left transition-[background-color,transform] hover:bg-[var(--gk-surface)] active:translate-y-px"
                    id="gk-launcher"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Continue ${v(this.activeTourTitle)}"
                  >
                    <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gk-accent)] text-[var(--gk-accent-text)]">${b.chat}</span>
                    <span class="min-w-0">
                      <span class="block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--gk-muted)]">Tour in progress</span>
                      <span class="launcher-text block truncate text-[13px] font-medium text-[var(--gk-text)]">${v(this.activeTourTitle)}</span>
                    </span>
                  </button>
                  <button class="${k} grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[var(--gk-muted)] transition-colors hover:bg-red-400/10 hover:text-red-300" id="gk-stop-tour-compact" type="button" aria-label="Stop tour" title="Stop tour">${b.stop}</button>
                </div>
              ` : `
                <button
                  class="launcher-pill gk-launcher-opening ${k} pointer-events-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--gk-canvas)] text-[var(--gk-accent)] shadow-[0_18px_55px_rgba(0,0,0,0.52)] backdrop-blur-2xl transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[var(--gk-surface)] active:translate-y-0"
                  id="gk-launcher"
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="${v(this.options.launcherLabel)}"
                  title="${v(this.options.launcherLabel)}"
                >
                  ${b.chat}
                </button>
              `}
      </div>
    `, !this.isOpen) {
      (h = this.shadow.querySelector("#gk-launcher")) == null || h.addEventListener("click", () => this.open()), (f = this.shadow.querySelector("#gk-stop-tour-compact")) == null || f.addEventListener("click", () => this.stopTour());
      return;
    }
    const o = this.shadow.querySelector(".chat-panel");
    o == null || o.addEventListener("keydown", (w) => {
      w.key === "Escape" && this.close();
    }), (p = this.shadow.querySelector("#gk-minimize-chat")) == null || p.addEventListener("click", () => this.close()), (m = this.shadow.querySelector("#gk-stop-tour")) == null || m.addEventListener("click", () => this.stopTour()), (y = this.shadow.querySelector("#gk-toggle-tts")) == null || y.addEventListener("click", () => {
      this.ttsEnabled = !this.ttsEnabled, this.render();
    }), (_ = this.shadow.querySelector("#gk-toggle-locale")) == null || _.addEventListener("click", () => {
      var $;
      const w = i.indexOf(this.locale), x = i[(w + 1) % i.length] || i[0];
      this.locale = x, ($ = this.callbacks) == null || $.onLocaleChange(x), this.render();
    }), this.shadow.querySelectorAll(".chip").forEach((w) => {
      w.addEventListener("click", () => {
        const x = w.dataset.query;
        x && this.handleSend(x);
      });
    });
    const s = this.shadow.querySelector("#gk-search-form"), l = this.shadow.querySelector("#gk-input"), d = this.shadow.querySelector("#gk-send");
    l == null || l.addEventListener("input", () => {
      d && (d.disabled = this.isSending || !l.value.trim());
    }), s == null || s.addEventListener("submit", (w) => {
      w.preventDefault();
      const x = l == null ? void 0 : l.value.trim();
      !x || this.isSending || (l.value = "", d && (d.disabled = !0), this.handleSend(x));
    });
  }
  setComposerBusy(t) {
    const i = this.shadow.querySelector("#gk-input"), r = this.shadow.querySelector("#gk-send"), a = this.shadow.querySelector("#gk-messages");
    i && (i.disabled = t), r && (r.disabled = t || !(i != null && i.value.trim())), a == null || a.setAttribute("aria-busy", String(t));
  }
  async handleSend(t) {
    var o, s, l, d;
    const i = this.shadow.querySelector(".messages-area");
    if (!i || this.isSending) return;
    this.playSendTick(), this.isSending = !0, this.setComposerBusy(!0);
    const r = document.createElement("div");
    r.className = "msg-row msg-user flex max-w-[82%] flex-col self-end", r.innerHTML = `<div class="bubble-user rounded-[20px] rounded-br-md bg-[var(--gk-accent)] px-4 py-3 text-[13px] leading-[1.55] text-[var(--gk-accent-text)] shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]">${K(t)}</div>`, i.appendChild(r);
    const a = document.createElement("div");
    a.className = "msg-row msg-assistant flex max-w-[92%] flex-col self-start", a.id = "gk-loader-row", a.innerHTML = `<div class="flex items-end gap-2"><span class="assistant-avatar grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gk-surface-hover)] text-[var(--gk-accent)]" aria-hidden="true">${b.chat}</span><div class="min-w-[92px] rounded-[20px] rounded-bl-md bg-[var(--gk-surface)] px-4 py-3 text-[13px] leading-5 text-[var(--gk-muted)]" role="status">Thinking…</div></div>`, i.appendChild(a), i.scrollTop = i.scrollHeight;
    try {
      const c = await ((o = this.callbacks) == null ? void 0 : o.onSendMessage(t));
      a.remove(), c && (this.addAssistantMessage(c.reply, {
        tourPlan: c.tour_plan,
        suggestedTourPlan: c.suggested_tour_plan,
        isPrereq: (s = c.tour_plan) == null ? void 0 : s.requires_login_first
      }), c.tour_plan && c.tour_plan.steps.length > 0 && ((l = this.callbacks) == null || l.onStartTour(c.tour_plan)));
    } catch (c) {
      a.remove();
      const g = c instanceof Error ? c.message : "The guide is unavailable right now.";
      this.addAssistantMessage(`I could not connect. ${g}`, { isError: !0 });
    } finally {
      this.isSending = !1, this.setComposerBusy(!1), (d = this.shadow.querySelector("#gk-input")) == null || d.focus();
    }
  }
}
const N = "guidekit_active_tour", j = "guidekit_visitor_id", R = "guidekit_session_id", B = "guidekit_locale";
function ct() {
  if (typeof window > "u") return "vis_ssr";
  let n = localStorage.getItem(j);
  return n || (n = "vis_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36), localStorage.setItem(j, n)), n;
}
function dt() {
  if (!(typeof window > "u"))
    return sessionStorage.getItem(R) || void 0;
}
function ut(n) {
  typeof window > "u" || sessionStorage.setItem(R, n);
}
function ht(n = "en") {
  return typeof window > "u" ? n : localStorage.getItem(B) || n;
}
function pt(n) {
  typeof window > "u" || localStorage.setItem(B, n);
}
function z() {
  if (typeof window > "u") return null;
  try {
    const n = sessionStorage.getItem(N);
    return n ? JSON.parse(n) : null;
  } catch {
    return null;
  }
}
function U(n) {
  if (!(typeof window > "u"))
    try {
      sessionStorage.setItem(N, JSON.stringify(n));
    } catch (e) {
      console.warn("[GuideKit] Failed to save active tour state:", e);
    }
}
function F() {
  typeof window > "u" || sessionStorage.removeItem(N);
}
function gt(n) {
  const e = z();
  return e ? (e.currentStepIndex = n, n >= e.tourPlan.steps.length && (e.status = "completed"), U(e), e) : null;
}
typeof customElements < "u" && !customElements.get("guidekit-widget") && customElements.define("guidekit-widget", lt);
class ft {
  constructor() {
    u(this, "config", { apiKey: "" });
    u(this, "apiClient");
    u(this, "telemetry");
    u(this, "driver");
    u(this, "widgetEl");
    u(this, "manifest", null);
    u(this, "visitorId", "vis_guest");
    u(this, "sessionId");
    u(this, "locale", "en");
    u(this, "isInitialized", !1);
    this.driver = new Q();
  }
  /**
   * Initialize SDK with explicit config or auto-discovered environment
   */
  async init(e) {
    if (typeof window > "u") return;
    const t = this.discoverConfig(e);
    if (!t.apiKey) {
      console.warn(
        "[GuideKit] No API key provided or found. Set data-guidekit-key on the script tag or call GuideKit.init({ apiKey: '...' })"
      );
      return;
    }
    this.config = t, this.visitorId = ct(), this.sessionId = dt(), this.locale = t.locale || ht("en"), this.apiClient = new W(this.config.apiKey, this.config.apiUrl), this.telemetry = new V(this.apiClient, this.sessionId), this.mountWidget();
    try {
      this.manifest = await this.apiClient.fetchManifest(), this.manifest && this.widgetEl && this.widgetEl.setManifest(this.manifest);
    } catch (r) {
      console.warn("[GuideKit] Failed to load manifest:", r);
    }
    this.bindRouteListeners(), this.isInitialized = !0;
    const i = z();
    i && i.status === "running" && this.resumeActiveTour(i);
  }
  /**
   * Auto-discover API key and settings from script tags or globals
   */
  discoverConfig(e) {
    var a;
    let t = (e == null ? void 0 : e.apiKey) || "", i = (e == null ? void 0 : e.apiUrl) || "http://127.0.0.1:8000/api/v1", r = (e == null ? void 0 : e.locale) || "en";
    if (typeof document < "u") {
      const o = document.querySelector("script[data-guidekit-key]");
      o && (t = t || o.getAttribute("data-guidekit-key") || "", i = o.getAttribute("data-api-url") || i, r = o.getAttribute("data-locale") || r);
    }
    if (typeof window < "u") {
      const o = window.GUIDEKIT_CONFIG;
      o && (t = t || o.apiKey, i = o.apiUrl || i, r = o.locale || r);
    }
    return {
      apiKey: t,
      apiUrl: i,
      locale: r,
      debug: e == null ? void 0 : e.debug,
      widget: (e == null ? void 0 : e.widget) || (typeof window < "u" ? (a = window.GUIDEKIT_CONFIG) == null ? void 0 : a.widget : void 0)
    };
  }
  mountWidget() {
    if (typeof document > "u") return;
    let e = document.querySelector("guidekit-widget");
    e || (e = document.createElement("guidekit-widget"), document.body.appendChild(e)), this.widgetEl = e, this.widgetEl.init(this.manifest, this.locale, {
      onSendMessage: (t) => this.sendMessage(t),
      onStartTour: (t) => this.startTour(t),
      onStopTour: () => this.endTour(),
      onLocaleChange: (t) => {
        this.locale = t, pt(t);
      }
    }, this.config.widget);
  }
  /** Update widget presentation without remounting the SDK. */
  configureWidget(e) {
    var t, i;
    this.config.widget = {
      ...this.config.widget,
      ...e,
      theme: {
        ...(t = this.config.widget) == null ? void 0 : t.theme,
        ...e.theme
      }
    }, (i = this.widgetEl) == null || i.setOptions(this.config.widget);
  }
  openWidget() {
    var e;
    (e = this.widgetEl) == null || e.open();
  }
  closeWidget() {
    var e;
    (e = this.widgetEl) == null || e.close();
  }
  bindRouteListeners() {
    if (typeof window > "u") return;
    const e = () => {
      const i = M();
      this.notifyRouteChange(i);
    };
    window.addEventListener("popstate", e), window.addEventListener("guidekit:route-change", e);
    const t = history.pushState;
    history.pushState = function(...i) {
      t.apply(this, i), e();
    };
  }
  /**
   * Start an interactive tour from a TourPlan
   */
  async startTour(e) {
    var i, r, a;
    if (!e || !e.steps || e.steps.length === 0) return;
    const t = {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      locale: this.locale,
      tourPlan: e,
      currentStepIndex: 0,
      status: "running"
    };
    U(t), (i = this.widgetEl) == null || i.setActiveTourProgress(e.target_feature_slug), (r = this.widgetEl) == null || r.close(), (a = this.telemetry) == null || a.trackTourEvent({
      event_type: "started"
    }), await this.executeCurrentTourStep(t);
  }
  async resumeActiveTour(e) {
    var t;
    (t = this.widgetEl) == null || t.setActiveTourProgress(e.tourPlan.target_feature_slug), await this.executeCurrentTourStep(e);
  }
  /**
   * Execute current step in active tour
   */
  async executeCurrentTourStep(e) {
    var d, c, g, h, f;
    const t = e.tourPlan.steps, i = e.currentStepIndex;
    if (i >= t.length) {
      this.completeTour(e);
      return;
    }
    const r = t[i], a = M(), o = r.route_pattern;
    if (!(o === "*" || o === a || a.startsWith(o))) {
      const p = document.querySelector(
        `[data-route="${o}"], a[href="${o}"], [data-route="${o.replace(/^\//, "")}"]`
      );
      if (p) {
        p.click(), setTimeout(() => {
          this.executeCurrentTourStep(e);
        }, 250);
        return;
      }
      (d = this.widgetEl) == null || d.open(), (c = this.widgetEl) == null || c.addAssistantMessage(
        `Step ${i + 1} requires visiting **${o}**. Please navigate there to continue the tour.`
      );
      return;
    }
    if (!this.apiClient || !this.telemetry) return;
    const l = await rt(r, this.apiClient, this.telemetry, this.locale);
    l.element ? (this.telemetry.trackTourEvent({
      step_id: r.step_id,
      event_type: "step_shown"
    }), (g = this.driver) == null || g.highlight(
      l.element,
      r,
      t.length,
      l.status,
      this.locale,
      {
        onNext: () => this.advanceStep(e, 1),
        onPrev: () => this.advanceStep(e, -1),
        onClose: () => this.endTour(e),
        onStepCompleted: () => {
          var p;
          (p = this.telemetry) == null || p.trackTourEvent({
            step_id: r.step_id,
            event_type: "step_completed"
          });
        }
      }
    )) : ((h = this.driver) == null || h.destroy(), (f = this.widgetEl) == null || f.showTier4FallbackCard(r, () => {
      this.advanceStep(e, 1);
    }));
  }
  advanceStep(e, t) {
    const i = e.currentStepIndex + t;
    if (!(i < 0))
      if (i >= e.tourPlan.steps.length)
        this.completeTour(e);
      else {
        const r = gt(i);
        r && this.executeCurrentTourStep(r);
      }
  }
  completeTour(e) {
    var t, i, r, a;
    (t = this.driver) == null || t.destroy(), F(), (i = this.widgetEl) == null || i.setActiveTourProgress(null), (r = this.widgetEl) == null || r.addAssistantMessage(
      `🎉 Tour completed! You've successfully finished '${e.tourPlan.target_feature_slug}'.`
    ), (a = this.telemetry) == null || a.trackTourEvent({
      event_type: "completed"
    });
  }
  endTour(e) {
    var t, i, r;
    (t = this.driver) == null || t.destroy(), F(), (i = this.widgetEl) == null || i.setActiveTourProgress(null), (r = this.telemetry) == null || r.trackTourEvent({
      event_type: "exited"
    });
  }
  /**
   * Send user message to runtime chat router
   */
  async sendMessage(e) {
    var a, o;
    if (!this.apiClient) return;
    const t = M(), i = tt((a = this.manifest) == null ? void 0 : a.auth_detection_config), r = await this.apiClient.chat({
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      message: e,
      locale: this.locale,
      currentPath: t,
      authState: i
    });
    return r.session_id && (this.sessionId = r.session_id, ut(r.session_id), (o = this.telemetry) == null || o.setSessionId(r.session_id)), r;
  }
  /**
   * Notify SDK that route has changed
   */
  notifyRouteChange(e) {
    const t = z();
    t && t.status === "running" && this.executeCurrentTourStep(t);
  }
  getManifest() {
    return this.manifest;
  }
  getTourState() {
    return z();
  }
}
const q = new ft();
typeof window < "u" && (window.GuideKit = q, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => {
  q.init();
}) : q.init());
export {
  q as GuideKit,
  ft as GuideKitSDK,
  q as default
};
