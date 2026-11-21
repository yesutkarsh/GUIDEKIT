"use strict";
/**
 * Webview HTML generator for the GuideKit VS Code Sidebar.
 * The authentication gate uses the shared GuideKit dashboard tokens and compiled Tailwind utilities.
 * Supports:
 * - Method 1: Manual Hotkey Flow Builder (Cmd+Shift+G)
 * - Method 2: Managed OpenCode CLI Harness (Inception Mercury 2.5)
 * - Direct + Device-Code Authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSidebarHtml = getSidebarHtml;
function getSidebarHtml(tailwindCss) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GuideKit Workflows</title>
  <style>
    :root {
      --bg: #0A0A0C;
      --card-bg: #121316;
      --card-border: #1F2229;
      --card-hover: #17181F;
      --text: #F4F4F6;
      --text-muted: #8E929F;
      --accent: #10B981;
      --accent-hover: #059669;
      --accent-bg: rgba(16, 185, 129, 0.12);
      --accent-border: rgba(16, 185, 129, 0.25);
      --amber: #F59E0B;
      --amber-bg: rgba(245, 158, 11, 0.12);
      --amber-border: rgba(245, 158, 11, 0.25);
      --purple: #A855F7;
      --purple-bg: rgba(168, 85, 247, 0.12);
      --blue: #3B82F6;
      --blue-bg: rgba(59, 130, 246, 0.12);
      --danger: #EF4444;
      --danger-bg: rgba(239, 68, 68, 0.12);
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 12px;
      line-height: 1.4;
      padding: 12px;
      overflow-x: hidden;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 12px;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-logo {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #10B981, #059669);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
      color: #0A0A0C;
    }
    .brand-title { font-weight: 700; font-size: 13px; letter-spacing: -0.01em; }
    .badge-env {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent-border);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    /* Cards */
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Navigation Tabs */
    .tab-bar {
      display: flex;
      background: #0E0F12;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 2px;
      margin-bottom: 12px;
      gap: 2px;
    }
    .tab-btn {
      flex: 1;
      min-width: 0;
      padding: 6px 4px;
      border-radius: 4px;
      font-size: 10px;
      line-height: 1.15;
      overflow-wrap: anywhere;
      font-weight: 600;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }
    .tab-btn.active {
      background: var(--card-bg);
      color: #FFFFFF;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .tab-btn:hover:not(.active) {
      color: var(--text);
    }

    /* Buttons */
    .btn {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      margin-top: 6px;
    }
    .btn-primary { background-color: var(--accent); color: #0A0A0C; }
    .btn-primary:hover { background-color: var(--accent-hover); }
    .btn-secondary { background-color: #1A1C22; color: var(--text); border-color: var(--card-border); }
    .btn-secondary:hover { background-color: #242630; border-color: #383A47; }
    .btn-danger { background-color: var(--danger-bg); color: var(--danger); border-color: rgba(239,68,68,0.3); }
    .btn-danger:hover { background-color: rgba(239,68,68,0.25); }
    .btn-outline { background: transparent; color: var(--accent); border-color: var(--accent-border); }
    .btn-outline:hover { background: var(--accent-bg); }
    .btn-sm { padding: 4px 8px; font-size: 10px; margin-top: 0; width: auto; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Forms */
    label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
      margin-top: 8px;
    }
    input, select, textarea {
      width: 100%;
      padding: 6px 10px;
      border-radius: 5px;
      background: #0A0B0D;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 11px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
    }
    .input-row { display: flex; gap: 8px; }
    .input-row > div { flex: 1; }

    /* Capture Banner */
    .capture-banner {
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02));
      border: 1px dashed var(--accent-border);
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      margin-bottom: 12px;
    }
    .hotkey-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      background: #1B1E26;
      border: 1px solid #2B303E;
      border-radius: 4px;
      color: var(--accent);
    }

    /* Step Card */
    .step-card {
      background: #0D0E11;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      position: relative;
    }
    .step-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .step-index-badge {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent);
      color: #0A0A0C;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .step-tools { display: flex; gap: 4px; }
    .step-tool-btn {
      background: #181920;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
    }
    .step-tool-btn:hover { color: #FFFFFF; border-color: #383A47; }

    /* OpenCode Live Terminal Feed */
    .terminal-box {
      background: #07080A;
      border: 1px solid #1C1E26;
      border-radius: 6px;
      padding: 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      color: #9CA3AF;
      height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 8px;
    }
    .terminal-status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0E0F14;
      padding: 6px 10px;
      border-radius: 5px;
      font-size: 11px;
      border: 1px solid var(--card-border);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      display: inline-block;
      box-shadow: 0 0 6px var(--accent);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* Prompt Chips */
    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 6px 0 10px 0;
    }
    .prompt-chip {
      background: #16181F;
      border: 1px solid #272A35;
      color: #D1D5DB;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .prompt-chip:hover {
      background: #222530;
      border-color: var(--accent-border);
      color: #FFFFFF;
    }

    /* Spinner */
    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* User Code Box */
    .code-box {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-align: center;
      padding: 8px;
      background: #070809;
      border: 1px dashed var(--accent);
      border-radius: 4px;
      color: var(--accent);
      margin: 8px 0;
      user-select: all;
    }
  </style>
  <style>${tailwindCss}</style>
</head>
<body class="m-0 min-h-[100dvh] bg-neutral-950 p-0 font-sans text-neutral-300 antialiased">

  <!-- Authentication is a screen-level gate. No product UI is shown before session validation. -->
  <main id="auth-gate" class="flex min-h-[100dvh] w-full items-center justify-center bg-neutral-950 px-6 py-8 text-neutral-300">
    <section class="mx-auto flex w-full max-w-[320px] flex-col items-center text-center" aria-labelledby="auth-title">
      <div class="text-neutral-300" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="m15.8 8.2-2 5.6-5.6 2 2-5.6 5.6-2Z" fill="currentColor" stroke="none"></path>
        </svg>
      </div>
      <h1 id="auth-title" class="mt-5 text-[22px] font-medium tracking-[-0.03em] text-white">GuideKit</h1>
      <p class="mt-2 text-[13px] leading-5 text-neutral-500">Implement chatbots with ease.</p>

      <div class="mt-10 min-h-[148px] w-full">
        <div id="auth-loading-view" class="flex min-h-[112px] flex-col items-center justify-center" role="status" aria-live="polite">
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-300 motion-reduce:animate-none" aria-hidden="true"></span>
          <p id="auth-loading-message" class="mt-4 text-[12px] leading-5 text-neutral-500">Checking your session…</p>
        </div>

        <div id="auth-idle-view" class="hidden">
          <button id="btn-google-auth" class="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-guidekit-action bg-guidekit-action px-4 font-sans text-[13px] font-medium text-white transition-colors duration-150 hover:border-guidekit-action-hover hover:bg-guidekit-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-wait disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-500 motion-reduce:transition-none" type="button">
            <span class="grid h-6 w-6 place-items-center rounded-full bg-white" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="h-4 w-4">
                <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.509h3.232c1.891-1.741 2.982-4.305 2.982-7.35Z"></path>
                <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.041.955-3.386.955-2.605 0-4.809-1.759-5.595-4.123H3.064v2.591A9.998 9.998 0 0 0 12 22Z"></path>
                <path fill="#FBBC05" d="M6.405 13.9A6.01 6.01 0 0 1 6.09 12c0-.659.114-1.3.314-1.9V7.509H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.141 1.064 4.491L6.405 13.9Z"></path>
                <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.991 14.695 2 12 2a9.998 9.998 0 0 0-8.936 5.509L6.405 10.1C7.191 7.736 9.395 5.977 12 5.977Z"></path>
              </svg>
            </span>
            <span>Continue with Google</span>
          </button>
        </div>

        <div id="auth-pending-view" class="hidden" role="status" aria-live="polite">
          <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4">
            <div class="flex items-center justify-center gap-2 text-[12px] text-neutral-300">
              <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-300 motion-reduce:animate-none" aria-hidden="true"></span>
              <span>Waiting for browser approval…</span>
            </div>
            <p class="mt-3 font-mono text-[10px] text-neutral-600">Confirm code</p>
            <p id="auth-user-code" class="mt-1 select-all font-mono text-[17px] font-medium tracking-[0.16em] text-white">—</p>
          </div>
          <div class="mt-3 flex items-center justify-center gap-5">
            <button id="btn-reopen-auth" class="min-h-11 appearance-none rounded-md border-0 bg-transparent px-1 font-sans text-[12px] font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500" type="button">Open browser again</button>
            <button id="btn-cancel-auth" class="min-h-11 appearance-none rounded-md border-0 bg-transparent px-1 font-sans text-[12px] font-medium text-neutral-600 underline-offset-4 transition-colors hover:text-red-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500" type="button">Cancel</button>
          </div>
        </div>

        <div id="auth-success-view" class="hidden min-h-[112px] flex-col items-center justify-center" role="status" aria-live="polite">
          <span class="grid h-9 w-9 place-items-center rounded-full border border-neutral-800 text-emerald-400" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>
          </span>
          <p class="mt-4 text-[13px] font-medium text-white">Signed in</p>
          <p class="mt-1 text-[12px] text-neutral-500">Opening your workspace…</p>
        </div>

        <div id="auth-error-view" class="hidden text-left" role="alert">
          <div class="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3.5">
            <p class="text-[12px] font-medium text-red-300">We couldn’t sign you in</p>
            <p id="auth-error-message" class="mt-1.5 text-[11px] leading-[1.55] text-red-400">Check your connection and try again.</p>
          </div>
          <button id="btn-retry-auth" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-800 bg-transparent px-4 font-sans text-[12px] font-medium text-neutral-300 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Try again</button>
        </div>
      </div>
    </section>
  </main>

  <!-- Workspace access is a second screen-level gate. Product tools stay hidden until one is active. -->
  <main id="workspace-gate" class="hidden min-h-[100dvh] w-full items-center justify-center bg-neutral-950 px-5 py-8 text-neutral-300">
    <section class="mx-auto flex w-full max-w-[336px] flex-col" aria-labelledby="workspace-title">
      <div class="flex items-center gap-3">
        <div class="grid h-9 w-9 shrink-0 place-items-center text-neutral-400" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="15" rx="3"></rect><path d="M8 5V3h8v2M3 10h18"></path>
          </svg>
        </div>
        <div class="min-w-0">
          <p class="font-mono text-[10px] tracking-[0.12em] text-neutral-600">GuideKit</p>
          <h1 id="workspace-title" class="mt-0.5 text-[19px] font-medium tracking-[-0.025em] text-white">Choose a workspace</h1>
        </div>
      </div>

      <div class="mt-8 min-h-[224px]">
        <div id="workspace-loading-view" class="flex min-h-[224px] flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 px-6 text-center" role="status" aria-live="polite">
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-300 motion-reduce:animate-none" aria-hidden="true"></span>
          <p class="mt-4 text-[13px] font-medium text-white">Loading workspaces</p>
          <p class="mt-1.5 text-[11px] leading-[1.55] text-neutral-500">Finding the places you can access…</p>
        </div>

        <div id="workspace-empty-view" class="hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-left">
          <div class="grid h-10 w-10 place-items-center text-neutral-500" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          </div>
          <h2 class="mt-5 text-[16px] font-medium tracking-[-0.02em] text-white">Create your first workspace</h2>
          <p class="mt-2 text-[12px] leading-[1.6] text-neutral-500">Workspaces keep your projects and workflows together. Create one on the GuideKit website, then return here.</p>
          <button id="btn-create-workspace" class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-guidekit-action bg-guidekit-action px-4 text-[12px] font-medium text-white transition-colors duration-150 hover:border-guidekit-action-hover hover:bg-guidekit-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">
            Create workspace on web
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg>
          </button>
          <button id="btn-refresh-empty-workspaces" class="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-transparent bg-transparent px-4 font-sans text-[12px] font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">I’ve created one — refresh</button>
        </div>

        <div id="workspace-selection-view" class="hidden">
          <p class="text-[12px] leading-[1.6] text-neutral-500">Select where you want to create and manage workflows in this VS Code window.</p>
          <div id="workspace-options" class="mt-4 max-h-[304px] space-y-2 overflow-y-auto pr-0.5" role="radiogroup" aria-label="Available workspaces"></div>
          <p id="workspace-selection-hint" class="mt-3 min-h-4 text-[11px] text-neutral-600" aria-live="polite">Choose a workspace to continue.</p>
          <button id="btn-continue-workspace" class="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-guidekit-action bg-guidekit-action px-4 text-[12px] font-medium text-white transition-colors duration-150 hover:border-guidekit-action-hover hover:bg-guidekit-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none" type="button" disabled>Continue</button>
          <button id="btn-refresh-workspaces" class="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-transparent bg-transparent px-4 font-sans text-[12px] font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Refresh list</button>
        </div>

        <div id="workspace-error-view" class="hidden" role="alert">
          <div class="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3.5">
            <p class="text-[12px] font-medium text-red-300">We couldn’t load your workspaces</p>
            <p id="workspace-error-message" class="mt-1.5 text-[11px] leading-[1.55] text-red-400">Check your connection and try again.</p>
          </div>
          <button id="btn-retry-workspaces" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-800 bg-transparent px-4 text-[12px] font-medium text-neutral-300 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Try again</button>
        </div>
      </div>

      <button id="btn-workspace-sign-out" class="mt-7 min-h-11 self-center rounded-md border border-transparent bg-transparent px-3 py-2 font-sans text-[11px] text-neutral-600 transition-colors duration-150 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Sign out</button>
    </section>
  </main>

  <div id="authenticated-app" class="hidden min-h-[100dvh] bg-guidekit-canvas font-sans text-guidekit-ink">

  <div id="context-picker" class="min-h-[100dvh] bg-neutral-950 text-neutral-300">
    <!-- Workspace controls only appear while choosing project context. -->
    <nav class="sticky top-0 z-10 flex min-h-[56px] items-center gap-1.5 border-b border-neutral-900 bg-neutral-950 px-3" aria-label="GuideKit workspace navigation">
      <button id="workspace-dialog-trigger" class="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border-0 bg-neutral-900/60 px-3 font-sans text-left transition-colors duration-150 hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button" aria-haspopup="dialog">
        <span id="workspace-trigger-name" class="truncate text-[11px] font-medium text-white">Loading workspace…</span>
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5 shrink-0 text-neutral-600" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4"></path></svg>
      </button>
      <button id="btn-refresh-workspaces-nav" class="h-11 shrink-0 rounded-lg border border-transparent bg-transparent px-2 font-sans text-[10px] font-medium text-neutral-600 transition-colors duration-150 hover:bg-neutral-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Refresh</button>
      <button id="btn-header-sign-out" class="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-neutral-600 transition-colors duration-150 hover:bg-neutral-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button" aria-label="Sign out of GuideKit" title="Sign out">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path></svg>
      </button>
    </nav>

    <div class="p-3">
    <section id="project-context" class="rounded-2xl bg-neutral-900/60 p-3.5" aria-labelledby="project-context-title">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 id="project-context-title" class="text-[13px] font-medium tracking-[-0.01em] text-white">Projects</h2>
          <p id="project-status" class="mt-0.5 font-mono text-[9px] text-neutral-600" aria-live="polite">Loading…</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-refresh-projects" class="min-h-11 rounded-md border border-transparent bg-transparent px-2 font-sans text-[10px] font-medium text-neutral-600 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Refresh</button>
        </div>
      </div>
      <label class="relative mt-3 block">
        <span class="sr-only">Search projects</span>
        <span class="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-neutral-600" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
        </span>
        <input id="project-search" class="h-11 w-full rounded-lg border-0 bg-neutral-950 py-0 pl-10 pr-3 font-sans text-[11px] leading-none normal-case text-white outline-none transition-colors placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-800" type="search" placeholder="Search projects" autocomplete="off" />
      </label>
      <div id="project-card-list" class="mt-3 max-h-[336px] space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgb(64_64_64)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700" role="listbox" aria-label="Available projects"></div>
      <div id="project-search-empty" class="mt-3 hidden rounded-lg border border-dashed border-neutral-800 px-4 py-6 text-center text-[10px] leading-4 text-neutral-500">No projects match your search.</div>
      <button id="btn-show-more-projects" class="mt-2 hidden min-h-11 w-full items-center justify-center rounded-md border border-transparent bg-transparent font-sans text-[10px] font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Show more</button>
      <div class="mt-2 flex items-center justify-between gap-3 border-t border-neutral-800 pt-2">
        <p id="project-meta" class="truncate font-mono text-[9px] leading-4 text-neutral-600">Projects are scoped to this workspace.</p>
      </div>
    </section>

    <section id="project-required" class="mt-3 flex min-h-[148px] flex-col items-center justify-center rounded-2xl bg-neutral-900/40 px-5 py-5 text-center" aria-labelledby="project-required-title">
      <div id="project-required-icon" class="grid h-9 w-9 place-items-center text-neutral-500" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"></path><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h3"></path></svg>
      </div>
      <h3 id="project-required-title" class="mt-4 text-[13px] font-medium text-white">Loading projects</h3>
      <p id="project-required-copy" class="mt-1.5 max-w-[240px] text-[11px] leading-[1.55] text-neutral-500">Finding the projects available in this workspace…</p>
      <button id="btn-project-empty-action" class="mt-4 hidden min-h-11 items-center justify-center rounded-lg border border-neutral-800 bg-transparent px-4 font-sans text-[11px] font-medium text-neutral-300 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Open dashboard</button>
    </section>

    <footer class="mt-4 flex items-center justify-center gap-1 border-t border-neutral-900 pt-3" aria-label="GuideKit account links">
      <button id="btn-manage-workspaces" class="min-h-11 rounded-md border border-transparent bg-transparent px-2.5 font-sans text-[10px] font-medium text-neutral-600 transition-colors duration-150 hover:bg-neutral-900 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Manage workspaces</button>
      <span class="text-neutral-700" aria-hidden="true">·</span>
      <button id="btn-open-profile" class="min-h-11 rounded-md border border-transparent bg-transparent px-2.5 font-sans text-[10px] font-medium text-neutral-600 transition-colors duration-150 hover:bg-neutral-900 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Profile</button>
    </footer>

    </div>
  </div>

  <div id="workspace-dialog" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title">
    <section class="flex max-h-[calc(100dvh-24px)] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl shadow-black/50">
      <header class="flex items-start justify-between gap-3 border-b border-neutral-950 px-4 py-3.5">
        <div class="min-w-0">
          <h2 id="workspace-dialog-title" class="text-[14px] font-medium tracking-[-0.015em] text-white">Choose workspace</h2>
          <p id="workspace-dialog-count" class="mt-1 font-mono text-[9px] text-neutral-600">Loading workspaces…</p>
        </div>
        <button id="btn-close-workspace-dialog" class="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-neutral-600 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button" aria-label="Close workspace selector" title="Close workspace selector">
          <svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"></path></svg>
        </button>
      </header>
      <div class="p-3">
        <label class="relative block">
          <span class="sr-only">Search workspaces</span>
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
          <input id="workspace-search" class="min-h-11 w-full rounded-lg border border-transparent bg-neutral-950 py-2.5 pl-9 pr-3 font-sans text-[11px] normal-case text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-[#52a9ff] focus:ring-2 focus:ring-[#52a9ff]/25" type="search" placeholder="Search workspaces" autocomplete="off" />
        </label>
      </div>
      <div id="workspace-card-list" class="mx-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgb(64_64_64)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700" role="listbox" aria-label="Available workspaces"></div>
      <div id="workspace-search-empty" class="mx-3 hidden rounded-lg bg-neutral-950 px-4 py-8 text-center text-[10px] leading-4 text-neutral-500">No workspaces match your search.</div>
      <button id="btn-show-more-workspaces" class="mx-3 mt-2 hidden min-h-11 items-center justify-center rounded-md border border-transparent bg-transparent font-sans text-[10px] font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none" type="button">Show more</button>
      <footer class="mt-3 border-t border-neutral-950 p-3">
        <button id="btn-manage-workspaces-dialog" class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-neutral-950 px-3 font-sans text-[10px] font-medium text-neutral-300 transition-colors duration-150 hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52a9ff] motion-reduce:transition-none" type="button">
          Manage workspaces on web
          <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 13 13 7M8 7h5v5"></path></svg>
        </button>
      </footer>
    </section>
  </div>

  <div id="project-view" class="hidden">
    <header class="sticky top-0 z-10 border-b border-white/[0.08] bg-guidekit-canvas px-3 py-2.5">
      <div class="flex min-h-8 items-center gap-2">
        <button id="btn-back-to-context" class="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-1.5 font-sans text-[10px] font-medium text-guidekit-muted transition-colors duration-150 hover:bg-guidekit-subtle hover:text-guidekit-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guidekit-focus motion-reduce:transition-none" type="button">
          <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 5-5 5 5 5"></path></svg>
          Back
        </button>
        <span class="h-4 w-px bg-white/[0.09]" aria-hidden="true"></span>
        <p id="active-project-name" class="min-w-0 truncate text-[11px] font-medium text-guidekit-ink">Project</p>
      </div>
    </header>

    <div class="p-3">

    <div id="project-tools" class="hidden">

  <section id="project-hub" class="space-y-3">
    <div class="rounded-2xl border border-white/[0.08] bg-guidekit-surface p-4">
      <p class="font-mono text-[9px] tracking-[0.08em] text-guidekit-faint">FLOW AUTHORING</p>
      <h2 class="mt-2 text-[17px] font-medium tracking-[-0.025em] text-guidekit-ink">Build beside your code</h2>
      <p class="mt-2 text-[11px] leading-[1.6] text-guidekit-faint">Studio opens in a second editor column. Select code on the left, capture it, and watch the connected flow update on the right.</p>
      <button id="btn-open-studio" class="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-guidekit-action bg-guidekit-action px-4 font-sans text-[11px] font-medium text-white transition-colors hover:border-guidekit-action-hover hover:bg-guidekit-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guidekit-focus motion-reduce:transition-none" type="button">Open Studio</button>
      <button id="btn-open-opencode-panel" class="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-transparent px-4 font-sans text-[11px] font-medium text-guidekit-muted transition-colors hover:bg-guidekit-hover hover:text-guidekit-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guidekit-focus motion-reduce:transition-none" type="button">Ask Open Code</button>
    </div>

    <div class="rounded-2xl border border-white/[0.08] bg-guidekit-subtle p-4">
      <div class="flex items-center justify-between gap-3">
        <div><h2 class="text-[12px] font-medium text-guidekit-ink">Project flows</h2><p id="project-hub-flow-count" class="mt-1 font-mono text-[9px] text-guidekit-faint">Loading…</p></div>
        <button id="btn-open-flows-panel" class="min-h-11 rounded-md border border-transparent bg-transparent px-2 text-[10px] font-medium text-guidekit-faint transition-colors hover:bg-guidekit-hover hover:text-guidekit-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guidekit-focus" type="button">View all</button>
      </div>
      <div id="project-hub-flows" class="mt-3 divide-y divide-white/[0.08]"><div class="py-4 text-[10px] text-guidekit-faint">Loading project flows…</div></div>
    </div>

    <details class="rounded-xl border border-white/[0.08] bg-transparent px-3 py-2">
      <summary class="min-h-11 cursor-pointer py-3 text-[10px] font-medium text-guidekit-faint">More project tools</summary>
      <button id="btn-open-knowledge-dashboard" class="min-h-11 w-full rounded-lg border border-transparent px-3 text-left text-[10px] text-guidekit-muted transition-colors hover:bg-guidekit-hover hover:text-guidekit-ink" type="button">Open Docs &amp; RAG on web</button>
    </details>
  </section>

  <!-- WORKFLOW CREATION METHOD TABS -->
  <div class="tab-bar" style="display:none;">
    <button class="tab-btn active" id="tab-btn-manual">Studio</button>
    <button class="tab-btn" id="tab-btn-opencode">OpenCode</button>
    <button class="tab-btn" id="tab-btn-flows">Existing Flows</button>
    <button class="tab-btn" id="tab-btn-knowledge">Docs & RAG</button>
  </div>

  <!-- ======================================================== -->
  <!-- TAB 1: METHOD 1 — MANUAL HOTKEY FLOW STUDIO              -->
  <!-- ======================================================== -->
  <div id="view-manual" class="tab-view" style="display:none;">
    <!-- Active Flow Settings -->
    <div class="card">
      <div class="card-title">
        <span>Active Manual Flow</span>
        <button class="btn-outline btn-sm" id="btn-new-flow">New Flow</button>
      </div>

      <label>Flow Title</label>
      <input type="text" id="manual-flow-title" value="Book a Taxi" placeholder="e.g. Book a Taxi or Payout" />

      <div class="input-row">
        <div>
          <label>Slug</label>
          <input type="text" id="manual-flow-slug" value="book-a-taxi" placeholder="book-a-taxi" />
        </div>
        <div>
          <label>Required Role</label>
          <select id="manual-flow-role">
            <option value="">(None / Any)</option>
            <option value="driver">Driver</option>
            <option value="passenger">Passenger</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div class="input-row" style="margin-top:6px; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="manual-flow-auth" style="width:auto; margin:0;" checked />
          <span style="font-size:11px; font-weight:500;">Requires Authentication</span>
        </div>
        <div>
          <input type="text" id="manual-flow-prereq" value="login" placeholder="Prereq slug (e.g. login)" />
        </div>
      </div>
    </div>

    <!-- Capture Trigger Banner -->
    <div class="capture-banner">
      <div style="font-size:11px; font-weight:600; color:#FFFFFF; margin-bottom:4px;">
        Highlight Any Element in Your Code
      </div>
      <div style="font-size:10px; color:var(--text-muted); margin-bottom:8px;">
        Select button, input, or link code and press <span class="hotkey-badge">Cmd+Shift+G</span> (<span class="hotkey-badge">Ctrl+Shift+G</span>)
      </div>
      <button class="btn btn-primary" id="btn-capture-selection">
        + Capture Highlighted Code as Step (Cmd+Shift+G)
      </button>
    </div>

    <!-- Captured Steps List -->
    <div class="card">
      <div class="card-title">
        <span>Captured Steps (<span id="manual-steps-count">0</span>)</span>
        <span style="font-size:9px; color:var(--text-muted)">Auto-injects data-guide-id</span>
      </div>

      <div id="manual-steps-list">
        <div id="manual-steps-empty" style="text-align:center; padding:16px 0; color:var(--text-muted); font-size:11px;">
          No steps captured yet. Open a file in the editor, select an element, and press <strong>Cmd+Shift+G</strong>.
        </div>
      </div>

      <button class="btn btn-secondary" id="btn-save-manual-flow" style="margin-top:8px;">
        💾 Save Flow to Workspace Drafts
      </button>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- TAB 2: METHOD 2 — MANAGED OPENCODE CLI HARNESS           -->
  <!-- ======================================================== -->
  <div id="view-opencode" class="tab-view" style="display:none;">
    <!-- Model & Provider Settings Accordion -->
    <div class="card">
      <div class="card-title">
        <span>OpenCode Provider & Model</span>
        <button class="btn-outline btn-sm" id="toggle-opencode-settings">Configure</button>
      </div>

      <div id="opencode-settings-body" style="display:none;">
        <label>Provider Preset</label>
        <select id="opencode-provider-preset">
          <option value="inception">Inception Labs (Default — OpenAI-Compatible)</option>
          <option value="custom">Custom Provider</option>
        </select>

        <label>Base URL</label>
        <input type="text" id="opencode-base-url" value="https://api.inceptionlabs.ai/v1" />

        <label>API Key</label>
        <input type="password" id="opencode-api-key" placeholder="Enter Inception or OpenAI-compatible API key" />

        <div class="input-row">
          <div>
            <label>Model ID</label>
            <input type="text" id="opencode-model-id" value="mercury-2.5" />
          </div>
          <div>
            <label>CLI Binary</label>
            <input type="text" id="opencode-binary" value="opencode" />
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" id="btn-save-opencode-settings" style="margin-top:8px;">
          Save Provider Settings
        </button>
      </div>
      <div id="opencode-settings-summary" style="font-size:10px; color:var(--text-muted); margin-top:2px;">
        Using Inception Labs (<code style="color:var(--accent);">mercury-2.5</code>)
      </div>
    </div>

    <!-- Agent Goal & Prompt -->
    <div class="card">
      <div class="card-title">
        <span>Target Flow Goal</span>
      </div>

      <label>Flow to Detect</label>
      <textarea id="opencode-goal-prompt" rows="2" placeholder="e.g. Detect the Ask for Money on the Go flow from route /driver/dashboard to payout confirmation">Detect the Ask for Money on the Go flow</textarea>

      <!-- Quick Prompt Chips -->
      <div class="chip-container">
        <div class="prompt-chip" data-prompt="Detect the Ask for Money on the Go flow from driver dashboard">💸 Ask for Money</div>
        <div class="prompt-chip" data-prompt="Detect the Book a Taxi flow from pickup to dropoff and booking confirmation">🚖 Book Taxi</div>
        <div class="prompt-chip" data-prompt="Detect the Driver Onboarding / Registration flow">📝 Driver Register</div>
      </div>

      <button class="btn btn-primary" id="btn-spawn-opencode">
        🚀 Spawn OpenCode & Detect Flow
      </button>

      <!-- Live Agent Status & Kill Switch -->
      <div id="opencode-running-banner" style="display:none; margin-top:10px;">
        <div class="terminal-status-bar">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="pulse-dot"></span>
            <span id="agent-status-text" style="font-weight:600; color:#FFFFFF;">Agent Running (PID: ...)</span>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-force-stop-opencode">Force Stop</button>
        </div>

        <!-- Read-Only Terminal Log Feed -->
        <div class="terminal-box" id="agent-log-feed">
          [guidekit] Waiting for agent output...
        </div>
      </div>

      <!-- Human Review & Accept/Reject Gate -->
      <div id="opencode-review-card" style="display:none; margin-top:12px; border:1px solid var(--accent-border); background:#0B0E0D; border-radius:6px; padding:10px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <span style="font-size:11px; font-weight:700; color:var(--accent);">✓ AI Flow Detected!</span>
          <span id="detected-flow-slug" style="font-family:var(--font-mono); font-size:10px; color:#FFFFFF;"></span>
        </div>
        <div id="detected-flow-meta" style="font-size:10px; color:var(--text-muted); margin-bottom:8px;"></div>
        <div id="detected-steps-preview" style="max-height:140px; overflow-y:auto; margin-bottom:8px;"></div>

        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" id="btn-accept-detected-flow" style="flex:1;">
            ✓ Accept Flow
          </button>
          <button class="btn btn-danger" id="btn-reject-detected-flow" style="flex:1;">
            ✕ Reject
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- TAB 3: EXISTING FLOWS (TWO-WAY WORKSPACE)               -->
  <!-- ======================================================== -->
  <div id="view-flows" class="tab-view" style="display:none;">
    <div class="card">
      <div class="card-title">
        <span>Project Workflows</span>
        <button class="btn-outline btn-sm" id="btn-refresh-flows" style="padding:1px 6px;">Refresh</button>
      </div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">
        Existing workflows loaded live from the active project. Click <strong>✎ Edit Flow</strong> to load steps into the Studio editor.
      </div>
      <div id="existing-flows-list" style="max-height:360px; overflow-y:auto;">
        <div style="text-align:center; padding:16px 0; color:var(--text-muted); font-size:11px;">
          No workflows found or not loaded yet.
        </div>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- TAB 4: DOCS & RAG KNOWLEDGE SYSTEM                      -->
  <!-- ======================================================== -->
  <div id="view-knowledge" class="tab-view" style="display:none;">
    <div class="card">
      <div class="card-title">
        <span>Knowledge Corpus & RAG</span>
        <button class="btn-outline btn-sm" id="btn-refresh-knowledge" style="padding:1px 6px;">Refresh</button>
      </div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">
        Index PDF documentation, guides, or FAQs to power grounded AI answers.
      </div>

      <button class="btn btn-primary" id="btn-upload-knowledge" style="background:#10B981; color:#0A0A0C;">
        📄 Upload Document (PDF, TXT, MD)
      </button>

      <div style="margin-top:10px; border-top:1px solid var(--card-border); padding-top:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Or Paste Raw Knowledge</span>
          <button class="btn-outline btn-sm" id="toggle-paste-knowledge" style="padding:1px 6px;">Show</button>
        </div>
        <div id="paste-knowledge-fields" style="display:none; margin-top:6px;">
          <label>Document Title</label>
          <input type="text" id="paste-doc-title" placeholder="e.g. Return Policy or FAQ" />
          <label>Content (Text / Markdown)</label>
          <textarea id="paste-doc-content" rows="4" placeholder="Paste policy, instructions, or FAQs here..."></textarea>
          <button class="btn btn-secondary" id="btn-submit-paste-knowledge">Index Raw Knowledge</button>
        </div>
      </div>
    </div>

    <!-- Indexed Knowledge Sources List -->
    <div class="card">
      <div class="card-title">
        <span>Indexed Sources</span>
      </div>
      <div id="knowledge-sources-list" style="max-height:240px; overflow-y:auto;">
        <div style="text-align:center; padding:12px 0; color:var(--text-muted); font-size:11px;">
          No knowledge sources indexed yet.
        </div>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- STAGED WORKFLOWS & CDN PUBLISH SECTION                   -->
  <!-- ======================================================== -->
  <div class="card" id="staged-section" style="display:none;">
    <div class="card-title">
      <span>Staged Workflows (<span id="staged-count">0</span>)</span>
      <button class="btn-outline btn-sm" id="btn-clear-staged" style="padding:1px 6px;">Clear</button>
    </div>

    <div id="staged-flows-list" style="max-height:160px; overflow-y:auto; margin-bottom:8px;">
      <div id="staged-empty" style="text-align:center; padding:12px 0; color:var(--text-muted); font-size:10px;">
        No staged workflows. Create one via Method 1 or Method 2.
      </div>
    </div>

    <button class="btn btn-primary" id="btn-sync-publish">
      🚀 Sync Workflows & Publish Manifest to CDN
    </button>
    <div id="publish-result" style="margin-top:8px;"></div>
  </div>

  </div>
  </div>
  </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // State
    let activeTab = 'manual';
    let manualSteps = [];
    let stagedFlows = [];
    let currentDetectedFlow = null;
    let authRetryMode = 'new-auth';
    let authSuccessTimer = null;
    let workspaceState = { state: 'loading', workspaces: [], selectedWorkspaceId: null };
    let pendingWorkspaceId = null;
    let availableProjects = [];
    let selectedProjectId = null;
    let contextPickerPinned = false;
    let projectDisplayLimit = 20;
    let workspaceDisplayLimit = 20;
    let workspaceDialogReturnFocus = null;

    // Elements
    const authGate = document.getElementById('auth-gate');
    const workspaceGate = document.getElementById('workspace-gate');
    const authenticatedApp = document.getElementById('authenticated-app');
    const authLoadingView = document.getElementById('auth-loading-view');
    const authIdleView = document.getElementById('auth-idle-view');
    const authPendingView = document.getElementById('auth-pending-view');
    const authSuccessView = document.getElementById('auth-success-view');
    const authErrorView = document.getElementById('auth-error-view');
    const authLoadingMessage = document.getElementById('auth-loading-message');
    const authErrorMessage = document.getElementById('auth-error-message');
    const googleAuthButton = document.getElementById('btn-google-auth');
    const authUserCode = document.getElementById('auth-user-code');
    const workspaceDialogTrigger = document.getElementById('workspace-dialog-trigger');
    const workspaceTriggerName = document.getElementById('workspace-trigger-name');
    const workspaceDialog = document.getElementById('workspace-dialog');
    const workspaceDialogCount = document.getElementById('workspace-dialog-count');
    const workspaceSearch = document.getElementById('workspace-search');
    const workspaceCardList = document.getElementById('workspace-card-list');
    const workspaceSearchEmpty = document.getElementById('workspace-search-empty');
    const showMoreWorkspacesButton = document.getElementById('btn-show-more-workspaces');
    const contextPicker = document.getElementById('context-picker');
    const projectView = document.getElementById('project-view');
    const projectSearch = document.getElementById('project-search');
    const projectCardList = document.getElementById('project-card-list');
    const projectSearchEmpty = document.getElementById('project-search-empty');
    const showMoreProjectsButton = document.getElementById('btn-show-more-projects');
    const projectMeta = document.getElementById('project-meta');
    const projectStatus = document.getElementById('project-status');
    const projectRequired = document.getElementById('project-required');
    const projectRequiredTitle = document.getElementById('project-required-title');
    const projectRequiredCopy = document.getElementById('project-required-copy');
    const projectEmptyAction = document.getElementById('btn-project-empty-action');
    const projectTools = document.getElementById('project-tools');
    const activeProjectName = document.getElementById('active-project-name');
    const workspaceLoadingView = document.getElementById('workspace-loading-view');
    const workspaceEmptyView = document.getElementById('workspace-empty-view');
    const workspaceSelectionView = document.getElementById('workspace-selection-view');
    const workspaceErrorView = document.getElementById('workspace-error-view');
    const workspaceOptions = document.getElementById('workspace-options');
    const workspaceSelectionHint = document.getElementById('workspace-selection-hint');
    const workspaceContinueButton = document.getElementById('btn-continue-workspace');
    const workspaceErrorMessage = document.getElementById('workspace-error-message');

    const authViews = [authLoadingView, authIdleView, authPendingView, authSuccessView, authErrorView];
    const workspaceViews = [workspaceLoadingView, workspaceEmptyView, workspaceSelectionView, workspaceErrorView];

    function showAuthView(view, display = 'block') {
      authViews.forEach(item => {
        item?.classList.add('hidden');
        if (item) item.style.display = '';
      });
      if (view) {
        view.classList.remove('hidden');
        view.style.display = display;
      }
    }

    function showWorkspaceView(view, display = 'block') {
      workspaceViews.forEach(item => {
        item?.classList.add('hidden');
        if (item) item.style.display = '';
      });
      if (view) {
        view.classList.remove('hidden');
        view.style.display = display;
      }
    }

    function showAuthenticatedApp() {
      if (authSuccessTimer) {
        clearTimeout(authSuccessTimer);
        authSuccessTimer = null;
      }
      authGate?.classList.add('hidden');
      workspaceGate?.classList.add('hidden');
      workspaceGate?.classList.remove('flex');
      authenticatedApp?.classList.remove('hidden');
    }

    function renderWorkspaceNavigation() {
      const workspaces = workspaceState.workspaces || [];
      const activeWorkspace = workspaces.find(workspace => workspace.id === workspaceState.selectedWorkspaceId) || workspaceState.workspace;
      workspaceTriggerName.textContent = activeWorkspace?.name || 'Choose workspace';
      workspaceDialogTrigger.disabled = workspaces.length === 0;
      renderWorkspaceDialog();
    }

    function normalizeSearch(value) {
      return String(value || '').trim().toLowerCase();
    }

    function renderProjectCards() {
      const query = normalizeSearch(projectSearch?.value);
      const filtered = availableProjects.filter(project => {
        if (!query) return true;
        return [project.name, project.slug, project.framework].some(value => normalizeSearch(value).includes(query));
      });
      const visible = filtered.slice(0, projectDisplayLimit);
      projectCardList.replaceChildren();

      visible.forEach(project => {
        const selected = project.id === selectedProjectId;
        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('role', 'option');
        card.setAttribute('aria-selected', String(selected));
        card.className = 'flex min-h-[64px] w-full items-center gap-3 rounded-lg border-0 px-3 py-2.5 text-left font-sans transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none ' + (selected ? 'bg-neutral-800' : 'bg-neutral-950 hover:bg-neutral-900');

        const icon = document.createElement('span');
        icon.className = 'grid h-9 w-9 shrink-0 place-items-center text-neutral-500';
        icon.innerHTML = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"></path></svg>';

        const copy = document.createElement('span');
        copy.className = 'min-w-0 flex-1';
        const name = document.createElement('span');
        name.className = 'block truncate text-[11px] font-medium text-white';
        name.textContent = project.name || 'Untitled project';
        const detail = document.createElement('span');
        detail.className = 'mt-1 block truncate font-mono text-[9px] text-neutral-600';
        detail.textContent = [project.framework, project.slug ? '/' + project.slug : ''].filter(Boolean).join('  ·  ') || 'Project';
        copy.append(name, detail);

        const arrow = document.createElement('span');
        arrow.className = selected ? 'text-white' : 'text-neutral-600';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.innerHTML = selected
          ? '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10 3 3 7-7"></path></svg>'
          : '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5 5 5-5 5"></path></svg>';
        card.append(icon, copy, arrow);
        card.addEventListener('click', () => selectProject(project));
        projectCardList.appendChild(card);
      });

      projectSearchEmpty?.classList.toggle('hidden', filtered.length !== 0 || availableProjects.length === 0);
      showMoreProjectsButton?.classList.toggle('hidden', filtered.length <= projectDisplayLimit);
      showMoreProjectsButton?.classList.toggle('inline-flex', filtered.length > projectDisplayLimit);
      projectStatus.textContent = query ? filtered.length + ' found' : availableProjects.length + (availableProjects.length === 1 ? ' project' : ' projects');
      const selectedProject = availableProjects.find(project => project.id === selectedProjectId);
      projectMeta.textContent = selectedProject ? 'Current: ' + selectedProject.name : 'Select a project to open its tools.';
    }

    function renderWorkspaceDialog() {
      const workspaces = workspaceState.workspaces || [];
      const query = normalizeSearch(workspaceSearch?.value);
      const filtered = workspaces.filter(workspace => {
        if (!query) return true;
        return [workspace.name, workspace.slug].some(value => normalizeSearch(value).includes(query));
      });
      const visible = filtered.slice(0, workspaceDisplayLimit);
      workspaceCardList.replaceChildren();

      visible.forEach(workspace => {
        const selected = workspace.id === workspaceState.selectedWorkspaceId;
        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('role', 'option');
        card.setAttribute('aria-selected', String(selected));
        card.className = 'flex min-h-[60px] w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left font-sans transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52a9ff] motion-reduce:transition-none ' + (selected ? 'bg-neutral-800' : 'bg-neutral-900 hover:bg-neutral-800');

        const avatar = document.createElement('span');
        avatar.className = 'grid h-9 w-9 shrink-0 place-items-center font-mono text-[10px] font-medium text-neutral-500';
        avatar.textContent = getWorkspaceInitials(workspace.name);
        const copy = document.createElement('span');
        copy.className = 'min-w-0 flex-1';
        const name = document.createElement('span');
        name.className = 'block truncate text-[11px] font-medium text-white';
        name.textContent = workspace.name || 'Untitled workspace';
        const slug = document.createElement('span');
        slug.className = 'mt-1 block truncate font-mono text-[9px] text-neutral-600';
        slug.textContent = workspace.slug ? '/' + workspace.slug : 'Workspace';
        copy.append(name, slug);
        const check = document.createElement('span');
        check.className = selected ? 'text-white' : 'text-transparent';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10 3 3 7-7"></path></svg>';
        card.append(avatar, copy, check);
        card.addEventListener('click', () => chooseWorkspaceFromDialog(workspace));
        workspaceCardList.appendChild(card);
      });

      workspaceDialogCount.textContent = query ? filtered.length + ' found' : workspaces.length + (workspaces.length === 1 ? ' workspace' : ' workspaces');
      workspaceSearchEmpty?.classList.toggle('hidden', filtered.length !== 0);
      showMoreWorkspacesButton?.classList.toggle('hidden', filtered.length <= workspaceDisplayLimit);
      showMoreWorkspacesButton?.classList.toggle('inline-flex', filtered.length > workspaceDisplayLimit);
    }

    function openWorkspaceDialog() {
      workspaceDialogReturnFocus = document.activeElement;
      workspaceDisplayLimit = 20;
      workspaceSearch.value = '';
      renderWorkspaceDialog();
      workspaceDialog.classList.remove('hidden');
      workspaceDialog.classList.add('flex');
      requestAnimationFrame(() => workspaceSearch.focus());
    }

    function closeWorkspaceDialog() {
      const wasOpen = !workspaceDialog.classList.contains('hidden');
      workspaceDialog.classList.add('hidden');
      workspaceDialog.classList.remove('flex');
      if (wasOpen && workspaceDialogReturnFocus?.focus) requestAnimationFrame(() => workspaceDialogReturnFocus.focus());
      workspaceDialogReturnFocus = null;
    }

    function chooseWorkspaceFromDialog(workspace) {
      closeWorkspaceDialog();
      if (!workspace || workspace.id === workspaceState.selectedWorkspaceId) return;
      workspaceState = { ...workspaceState, state: 'loading', selectedWorkspaceId: workspace.id };
      availableProjects = [];
      selectedProjectId = null;
      contextPickerPinned = true;
      renderWorkspaceState();
      vscode.postMessage({ command: 'selectWorkspace', workspaceId: workspace.id });
    }

    function showContextPicker() {
      contextPicker?.classList.remove('hidden');
      projectView?.classList.add('hidden');
      projectTools?.classList.add('hidden');
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }

    function showProjectPrompt(mode) {
      showContextPicker();
      projectEmptyAction?.classList.add('hidden');
      projectEmptyAction?.classList.remove('inline-flex');

      if (mode === 'empty') {
        projectRequired?.classList.remove('hidden');
        projectStatus.textContent = 'No projects';
        projectRequiredTitle.textContent = 'Create your first project';
        projectRequiredCopy.textContent = 'Projects are created on the GuideKit website. Return here when it is ready.';
        projectEmptyAction?.classList.remove('hidden');
        projectEmptyAction?.classList.add('inline-flex');
        return;
      }
      if (mode === 'choose') {
        projectRequired?.classList.add('hidden');
        return;
      }
      projectRequired?.classList.remove('hidden');
      projectStatus.textContent = 'Loading…';
      projectRequiredTitle.textContent = 'Loading projects';
      projectRequiredCopy.textContent = 'Finding the projects available in this workspace…';
    }

    function showProjectTools(project) {
      if (!project) {
        showProjectPrompt('choose');
        return;
      }
      contextPickerPinned = false;
      contextPicker?.classList.add('hidden');
      projectView?.classList.remove('hidden');
      projectRequired?.classList.add('hidden');
      projectTools?.classList.remove('hidden');
      projectStatus.textContent = 'Active';
      activeProjectName.textContent = project.name || 'Project';
      updateProjectMeta(project);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }

    function selectProject(project) {
      if (!project) return;
      selectedProjectId = project.id;
      renderProjectCards();
      showProjectTools(project);
      vscode.postMessage({ command: 'selectProject', projectId: project.id });
    }

    function getWorkspaceInitials(name) {
      return String(name || 'W').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'W';
    }

    function renderWorkspaceOptions(workspaces) {
      workspaceOptions.replaceChildren();
      workspaces.forEach(workspace => {
        const option = document.createElement('button');
        const selected = workspace.id === pendingWorkspaceId;
        option.type = 'button';
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', String(selected));
        option.dataset.workspaceId = workspace.id;
        option.className = 'flex min-h-[60px] w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 motion-reduce:transition-none ' +
          (selected ? 'border-neutral-600 bg-neutral-900' : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900');

        const avatar = document.createElement('span');
        avatar.className = 'grid h-9 w-9 shrink-0 place-items-center font-mono text-[11px] font-medium text-neutral-500';
        avatar.textContent = getWorkspaceInitials(workspace.name);

        const copy = document.createElement('span');
        copy.className = 'min-w-0 flex-1';
        const name = document.createElement('span');
        name.className = 'block truncate text-[12px] font-medium text-white';
        name.textContent = workspace.name || 'Untitled workspace';
        const slug = document.createElement('span');
        slug.className = 'mt-1 block truncate font-mono text-[10px] text-neutral-600';
        slug.textContent = workspace.slug ? '/' + workspace.slug : 'Workspace';
        copy.append(name, slug);

        const check = document.createElement('span');
        check.className = 'grid h-5 w-5 shrink-0 place-items-center rounded-full border ' +
          (selected ? 'border-neutral-200 bg-neutral-200 text-neutral-950' : 'border-neutral-700 text-transparent');
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = '<svg viewBox="0 0 20 20" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10 3 3 7-7"></path></svg>';

        option.append(avatar, copy, check);
        option.addEventListener('click', () => {
          pendingWorkspaceId = workspace.id;
          renderWorkspaceOptions(workspaces);
          workspaceContinueButton.disabled = false;
          workspaceSelectionHint.textContent = workspace.name + ' selected.';
        });
        option.addEventListener('dblclick', () => selectPendingWorkspace());
        workspaceOptions.appendChild(option);
      });
    }

    function renderWorkspaceState() {
      if (workspaceState.state === 'ready') {
        renderWorkspaceNavigation();
        showProjectPrompt('loading');
        showAuthenticatedApp();
        return;
      }

      authGate?.classList.add('hidden');
      authenticatedApp?.classList.add('hidden');
      workspaceGate?.classList.remove('hidden');
      workspaceGate?.classList.add('flex');

      if (workspaceState.state === 'empty') {
        showWorkspaceView(workspaceEmptyView);
        requestAnimationFrame(() => document.getElementById('btn-create-workspace')?.focus());
        return;
      }
      if (workspaceState.state === 'selection_required') {
        pendingWorkspaceId = workspaceState.selectedWorkspaceId || null;
        renderWorkspaceOptions(workspaceState.workspaces || []);
        workspaceContinueButton.disabled = !pendingWorkspaceId;
        workspaceSelectionHint.textContent = pendingWorkspaceId ? 'Ready to continue.' : 'Choose a workspace to continue.';
        showWorkspaceView(workspaceSelectionView);
        requestAnimationFrame(() => workspaceOptions.querySelector('[role="radio"]')?.focus());
        return;
      }
      if (workspaceState.state === 'error') {
        workspaceErrorMessage.textContent = workspaceState.message || 'Check your connection and try again.';
        showWorkspaceView(workspaceErrorView);
        requestAnimationFrame(() => document.getElementById('btn-retry-workspaces')?.focus());
        return;
      }
      showWorkspaceView(workspaceLoadingView, 'flex');
    }

    function selectPendingWorkspace() {
      if (!pendingWorkspaceId) return;
      workspaceState = { ...workspaceState, state: 'loading', selectedWorkspaceId: pendingWorkspaceId };
      renderWorkspaceState();
      vscode.postMessage({ command: 'selectWorkspace', workspaceId: pendingWorkspaceId });
    }

    function setAuthScreen(state, message = '') {
      if (authSuccessTimer) {
        clearTimeout(authSuccessTimer);
        authSuccessTimer = null;
      }

      authGate?.classList.remove('hidden');
      workspaceGate?.classList.add('hidden');
      workspaceGate?.classList.remove('flex');
      authenticatedApp?.classList.add('hidden');
      googleAuthButton.disabled = false;

      if (state === 'idle') {
        authRetryMode = 'new-auth';
        showAuthView(authIdleView);
        return;
      }
      if (state === 'pending') {
        showAuthView(authPendingView);
        return;
      }
      if (state === 'success') {
        showAuthView(authSuccessView, 'flex');
        authSuccessTimer = setTimeout(() => {
          authSuccessTimer = null;
          renderWorkspaceState();
        }, 650);
        return;
      }
      if (state === 'error') {
        showAuthView(authErrorView);
        authErrorMessage.textContent = message || 'Check your connection and try again.';
        return;
      }

      showAuthView(authLoadingView, 'flex');
      authLoadingMessage.textContent = message || 'Checking your session…';
    }

    // Tab buttons & views
    const tabBtnManual = document.getElementById('tab-btn-manual');
    const tabBtnOpenCode = document.getElementById('tab-btn-opencode');
    const tabBtnFlows = document.getElementById('tab-btn-flows');
    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    const viewManual = document.getElementById('view-manual');
    const viewOpenCode = document.getElementById('view-opencode');
    const viewFlows = document.getElementById('view-flows');
    const viewKnowledge = document.getElementById('view-knowledge');

    tabBtnManual?.addEventListener('click', () => switchTab('manual'));
    tabBtnOpenCode?.addEventListener('click', () => switchTab('opencode'));
    tabBtnFlows?.addEventListener('click', () => {
      switchTab('flows');
      vscode.postMessage({ command: 'loadExistingFlows' });
    });
    tabBtnKnowledge?.addEventListener('click', () => {
      switchTab('knowledge');
      vscode.postMessage({ command: 'loadKnowledge' });
    });

    function switchTab(tab) {
      activeTab = tab;
      [tabBtnManual, tabBtnOpenCode, tabBtnFlows, tabBtnKnowledge].forEach(b => b?.classList.remove('active'));
      [viewManual, viewOpenCode, viewFlows, viewKnowledge].forEach(v => { if (v) v.style.display = 'none'; });

      if (tab === 'manual' && viewManual) {
        tabBtnManual?.classList.add('active');
        viewManual.style.display = 'block';
      } else if (tab === 'opencode' && viewOpenCode) {
        tabBtnOpenCode?.classList.add('active');
        viewOpenCode.style.display = 'block';
      } else if (tab === 'flows' && viewFlows) {
        tabBtnFlows?.classList.add('active');
        viewFlows.style.display = 'block';
      } else if (tab === 'knowledge' && viewKnowledge) {
        tabBtnKnowledge?.classList.add('active');
        viewKnowledge.style.display = 'block';
      }
    }

    // Google device authorization
    googleAuthButton?.addEventListener('click', () => {
      setAuthScreen('starting', 'Opening Google in your browser…');
      vscode.postMessage({ command: 'requestDeviceAuth' });
    });
    document.getElementById('btn-reopen-auth')?.addEventListener('click', () => vscode.postMessage({ command: 'reopenDeviceAuth' }));
    document.getElementById('btn-cancel-auth')?.addEventListener('click', () => vscode.postMessage({ command: 'cancelDeviceAuth' }));
    document.getElementById('btn-retry-auth')?.addEventListener('click', () => {
      setAuthScreen('starting', authRetryMode === 'restore-session' ? 'Checking your session…' : 'Opening Google in your browser…');
      vscode.postMessage({ command: authRetryMode === 'restore-session' ? 'ready' : 'requestDeviceAuth' });
    });

    document.getElementById('btn-create-workspace')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openWorkspaceSetup' });
    });
    document.getElementById('btn-refresh-empty-workspaces')?.addEventListener('click', () => {
      workspaceState = { ...workspaceState, state: 'loading' };
      renderWorkspaceState();
      vscode.postMessage({ command: 'loadWorkspaces' });
    });
    document.getElementById('btn-refresh-workspaces')?.addEventListener('click', () => {
      workspaceState = { ...workspaceState, state: 'loading' };
      renderWorkspaceState();
      vscode.postMessage({ command: 'loadWorkspaces' });
    });
    document.getElementById('btn-retry-workspaces')?.addEventListener('click', () => {
      workspaceState = { ...workspaceState, state: 'loading' };
      renderWorkspaceState();
      vscode.postMessage({ command: 'loadWorkspaces' });
    });
    workspaceContinueButton?.addEventListener('click', selectPendingWorkspace);
    workspaceOptions?.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
      const options = Array.from(workspaceOptions.querySelectorAll('[role="radio"]'));
      const currentIndex = options.indexOf(document.activeElement);
      if (currentIndex < 0 || options.length < 2) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      const next = options[(currentIndex + direction + options.length) % options.length];
      next.focus();
      next.click();
    });
    document.getElementById('btn-workspace-sign-out')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'signOut' });
    });

    workspaceDialogTrigger?.addEventListener('click', openWorkspaceDialog);
    document.getElementById('btn-close-workspace-dialog')?.addEventListener('click', closeWorkspaceDialog);
    workspaceDialog?.addEventListener('click', event => {
      if (event.target === workspaceDialog) closeWorkspaceDialog();
    });
    workspaceDialog?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWorkspaceDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(workspaceDialog.querySelectorAll('button:not([disabled]), input:not([disabled])')).filter(item => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    workspaceSearch?.addEventListener('input', () => {
      workspaceDisplayLimit = 20;
      renderWorkspaceDialog();
    });
    showMoreWorkspacesButton?.addEventListener('click', () => {
      workspaceDisplayLimit += 20;
      renderWorkspaceDialog();
    });
    projectSearch?.addEventListener('input', () => {
      projectDisplayLimit = 20;
      renderProjectCards();
    });
    showMoreProjectsButton?.addEventListener('click', () => {
      projectDisplayLimit += 20;
      renderProjectCards();
    });

    document.getElementById('btn-refresh-workspaces-nav')?.addEventListener('click', () => {
      contextPickerPinned = true;
      workspaceState = { ...workspaceState, state: 'loading' };
      renderWorkspaceState();
      vscode.postMessage({ command: 'loadWorkspaces' });
    });

    document.getElementById('btn-refresh-projects')?.addEventListener('click', () => {
      contextPickerPinned = true;
      projectStatus.textContent = 'Refreshing…';
      vscode.postMessage({ command: 'loadProjects' });
    });

    document.getElementById('btn-back-to-context')?.addEventListener('click', () => {
      contextPickerPinned = true;
      projectDisplayLimit = 20;
      projectSearch.value = '';
      renderProjectCards();
      showProjectPrompt('choose');
      requestAnimationFrame(() => projectSearch?.focus());
    });

    // Refresh Flows
    document.getElementById('btn-refresh-flows')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'loadExistingFlows' });
    });

    // Refresh Knowledge
    document.getElementById('btn-refresh-knowledge')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'loadKnowledge' });
    });

    // Upload Knowledge File
    document.getElementById('btn-upload-knowledge')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'uploadKnowledgeFile' });
    });

    // Toggle Paste Knowledge
    document.getElementById('toggle-paste-knowledge')?.addEventListener('click', () => {
      const f = document.getElementById('paste-knowledge-fields');
      const isHidden = f.style.display === 'none';
      f.style.display = isHidden ? 'block' : 'none';
      document.getElementById('toggle-paste-knowledge').textContent = isHidden ? 'Hide' : 'Show';
    });

    // Submit Paste Knowledge
    document.getElementById('btn-submit-paste-knowledge')?.addEventListener('click', () => {
      const title = document.getElementById('paste-doc-title').value.trim();
      const content = document.getElementById('paste-doc-content').value.trim();
      if (!title || !content) {
        alert('Please enter both title and content.');
        return;
      }
      vscode.postMessage({ command: 'indexKnowledgeText', title, content });
      document.getElementById('paste-doc-title').value = '';
      document.getElementById('paste-doc-content').value = '';
    });

    window.editExistingFlow = function(featureId) {
      vscode.postMessage({ command: 'editExistingFlow', featureId });
    };

    window.deleteExistingFlow = function(featureId) {
      vscode.postMessage({ command: 'deleteExistingFlow', featureId });
    };

    window.deleteKnowledgeSource = function(sourceId) {
      vscode.postMessage({ command: 'deleteKnowledge', sourceId });
    };

    // Toggle OpenCode settings
    document.getElementById('toggle-opencode-settings').addEventListener('click', () => {
      const body = document.getElementById('opencode-settings-body');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      document.getElementById('toggle-opencode-settings').textContent = isHidden ? 'Close' : 'Configure';
    });

    const btnHeaderSignOut = document.getElementById('btn-header-sign-out');
    if (btnHeaderSignOut) {
      btnHeaderSignOut.addEventListener('click', () => {
        vscode.postMessage({ command: 'signOut' });
      });
    }

    document.getElementById('btn-manage-workspaces')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openWorkspaceManagement' });
    });
    document.getElementById('btn-manage-workspaces-dialog')?.addEventListener('click', () => {
      closeWorkspaceDialog();
      vscode.postMessage({ command: 'openWorkspaceManagement' });
    });
    document.getElementById('btn-open-profile')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openProfile' });
    });

    projectEmptyAction?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openDashboard' });
    });

    document.getElementById('btn-open-studio')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openStudio', mode: 'studio' });
    });
    document.getElementById('btn-open-opencode-panel')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openStudio', mode: 'agent' });
    });
    document.getElementById('btn-open-flows-panel')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openStudio', mode: 'flows' });
    });
    document.getElementById('btn-open-knowledge-dashboard')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openKnowledgeDashboard' });
    });

    // Method 1: Capture Selection
    document.getElementById('btn-capture-selection').addEventListener('click', () => {
      const flowSlug = document.getElementById('manual-flow-slug').value.trim() || 'custom-flow';
      vscode.postMessage({ command: 'captureActiveSelection', flowSlug, stepOrder: manualSteps.length + 1 });
    });

    // Method 1: New Flow
    document.getElementById('btn-new-flow').addEventListener('click', () => {
      document.getElementById('manual-flow-title').value = '';
      document.getElementById('manual-flow-slug').value = '';
      manualSteps = [];
      renderManualSteps();
    });

    // Slug auto-derivation
    document.getElementById('manual-flow-title').addEventListener('input', (e) => {
      const slugInput = document.getElementById('manual-flow-slug');
      if (!slugInput.dataset.manualEdit) {
        slugInput.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
    });
    document.getElementById('manual-flow-slug').addEventListener('input', () => {
      document.getElementById('manual-flow-slug').dataset.manualEdit = 'true';
    });

    // Method 1: Save Flow to Drafts
    document.getElementById('btn-save-manual-flow').addEventListener('click', () => {
      const title = document.getElementById('manual-flow-title').value.trim() || 'Untitled Flow';
      const slug = document.getElementById('manual-flow-slug').value.trim() || 'untitled-flow';
      const requiresAuth = document.getElementById('manual-flow-auth').checked;
      const role = document.getElementById('manual-flow-role').value || null;
      const prereq = document.getElementById('manual-flow-prereq').value.trim() || null;

      if (manualSteps.length === 0) {
        alert('Please capture at least one step before saving.');
        return;
      }

      const flow = {
        slug,
        content: { en: { title, description: 'Workflow captured with GuideKit Hotkey Recorder.' } },
        example_queries: ['How do I ' + title.toLowerCase() + '?'],
        requires_auth: requiresAuth,
        required_role: role,
        prerequisite_feature_slug: prereq,
        steps: manualSteps,
      };

      stagedFlows.push(flow);
      renderStagedFlows();
      manualSteps = [];
      renderManualSteps();
      document.getElementById('manual-flow-title').value = '';
      document.getElementById('manual-flow-slug').value = '';
    });

    // Method 2: Prompt chips
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('opencode-goal-prompt').value = chip.dataset.prompt;
      });
    });

    // Method 2: Save OpenCode config
    document.getElementById('btn-save-opencode-settings').addEventListener('click', () => {
      const config = {
        providerPreset: document.getElementById('opencode-provider-preset').value,
        baseUrl: document.getElementById('opencode-base-url').value.trim(),
        apiKey: document.getElementById('opencode-api-key').value.trim(),
        modelId: document.getElementById('opencode-model-id').value.trim(),
        binaryPath: document.getElementById('opencode-binary').value.trim(),
      };
      vscode.postMessage({ command: 'saveOpenCodeConfig', config });
      document.getElementById('opencode-settings-body').style.display = 'none';
      document.getElementById('toggle-opencode-settings').textContent = 'Configure';
      document.getElementById('opencode-settings-summary').innerHTML =
        'Using ' + (config.providerPreset === 'inception' ? 'Inception Labs' : 'Custom Provider') +
        ' (<code style="color:var(--accent);">' + config.modelId + '</code>)';
    });

    // Method 2: Spawn OpenCode
    document.getElementById('btn-spawn-opencode').addEventListener('click', () => {
      const flowDescription = document.getElementById('opencode-goal-prompt').value.trim();
      if (!flowDescription) return;
      document.getElementById('opencode-running-banner').style.display = 'block';
      document.getElementById('agent-log-feed').textContent = '[guidekit] Spawning OpenCode agent...\\n';
      document.getElementById('opencode-review-card').style.display = 'none';
      vscode.postMessage({ command: 'spawnOpenCode', flowDescription });
    });

    // Method 2: Force Stop
    document.getElementById('btn-force-stop-opencode').addEventListener('click', () => {
      vscode.postMessage({ command: 'stopOpenCode' });
    });

    // Method 2: Accept detected flow
    document.getElementById('btn-accept-detected-flow').addEventListener('click', () => {
      if (currentDetectedFlow) {
        stagedFlows.push(currentDetectedFlow);
        renderStagedFlows();
        document.getElementById('opencode-review-card').style.display = 'none';
        currentDetectedFlow = null;
        vscode.postMessage({ command: 'acceptDetectedFlow', flow: currentDetectedFlow });
      }
    });

    // Method 2: Reject detected flow
    document.getElementById('btn-reject-detected-flow').addEventListener('click', () => {
      document.getElementById('opencode-review-card').style.display = 'none';
      currentDetectedFlow = null;
    });

    // Staged: Clear
    document.getElementById('btn-clear-staged').addEventListener('click', () => {
      stagedFlows = [];
      renderStagedFlows();
    });

    // Sync & Publish
    document.getElementById('btn-sync-publish').addEventListener('click', () => {
      if (stagedFlows.length === 0) {
        alert('No staged flows to publish. Create a flow first.');
        return;
      }
      const btn = document.getElementById('btn-sync-publish');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Syncing & Publishing...';
      vscode.postMessage({ command: 'syncAndPublishStaged', flows: stagedFlows });
    });

    // Render Manual Steps
    function renderManualSteps() {
      const container = document.getElementById('manual-steps-list');
      const countEl = document.getElementById('manual-steps-count');
      countEl.textContent = manualSteps.length;

      if (manualSteps.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px 0; color:var(--text-muted); font-size:11px;">No steps captured yet. Open a file in the editor, select an element, and press <strong>Cmd+Shift+G</strong>.</div>';
        return;
      }

      container.innerHTML = '';
      manualSteps.forEach((s, idx) => {
        const card = document.createElement('div');
        card.className = 'step-card';
        card.innerHTML = \`
          <div class="step-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="step-index-badge">\${idx + 1}</div>
              <span style="font-family:var(--font-mono); font-size:11px; font-weight:600; color:#FFFFFF;">\${s.guide_id}</span>
            </div>
            <div class="step-tools">
              <button class="step-tool-btn" onclick="moveStep(\${idx}, -1)">↑</button>
              <button class="step-tool-btn" onclick="moveStep(\${idx}, 1)">↓</button>
              <button class="step-tool-btn" style="color:var(--danger)" onclick="deleteStep(\${idx})">×</button>
            </div>
          </div>

          <label>Route Pattern</label>
          <input type="text" value="\${s.route_pattern}" onchange="updateStepField(\${idx}, 'route_pattern', this.value)" />

          <div class="input-row">
            <div>
              <label>Action</label>
              <select onchange="updateStepField(\${idx}, 'action_type', this.value)">
                <option value="click" \${s.action_type === 'click' ? 'selected' : ''}>Click</option>
                <option value="input" \${s.action_type === 'input' ? 'selected' : ''}>Input</option>
                <option value="select" \${s.action_type === 'select' ? 'selected' : ''}>Select</option>
                <option value="navigate" \${s.action_type === 'navigate' ? 'selected' : ''}>Navigate</option>
              </select>
            </div>
            <div>
              <label>Advance On</label>
              <select onchange="updateStepField(\${idx}, 'advance_on', this.value)">
                <option value="click" \${s.advance_on === 'click' ? 'selected' : ''}>Click</option>
                <option value="input_valid" \${s.advance_on === 'input_valid' ? 'selected' : ''}>Input Valid</option>
                <option value="route_change" \${s.advance_on === 'route_change' ? 'selected' : ''}>Route Change</option>
                <option value="manual_next" \${s.advance_on === 'manual_next' ? 'selected' : ''}>Manual Next</option>
              </select>
            </div>
          </div>

          <label>Title</label>
          <input type="text" value="\${s.content?.en?.title || ''}" onchange="updateStepContent(\${idx}, 'title', this.value)" />

          <div style="font-size:10px; color:var(--text-muted); margin-top:6px; font-family:var(--font-mono);">
            Selector: \${s.target_fingerprint?.css || s.target_fingerprint?.tag || 'none'}
          </div>
        \`;
        container.appendChild(card);
      });
    }

    window.moveStep = function(idx, delta) {
      const target = idx + delta;
      if (target < 0 || target >= manualSteps.length) return;
      const tmp = manualSteps[idx];
      manualSteps[idx] = manualSteps[target];
      manualSteps[target] = tmp;
      manualSteps.forEach((s, i) => s.step_order = i + 1);
      renderManualSteps();
    };

    window.deleteStep = function(idx) {
      manualSteps.splice(idx, 1);
      manualSteps.forEach((s, i) => s.step_order = i + 1);
      renderManualSteps();
    };

    window.updateStepField = function(idx, field, val) {
      manualSteps[idx][field] = val;
    };

    window.updateStepContent = function(idx, field, val) {
      if (!manualSteps[idx].content) manualSteps[idx].content = { en: { title: '', description: '' } };
      if (!manualSteps[idx].content.en) manualSteps[idx].content.en = { title: '', description: '' };
      manualSteps[idx].content.en[field] = val;
    };

    // Render Staged Flows
    function renderStagedFlows() {
      const container = document.getElementById('staged-flows-list');
      const countEl = document.getElementById('staged-count');
      countEl.textContent = stagedFlows.length;

      if (stagedFlows.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:12px 0; color:var(--text-muted); font-size:10px;">No staged workflows. Create one via Method 1 or Method 2.</div>';
        return;
      }

      container.innerHTML = '';
      stagedFlows.forEach((f, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'background:#0F1014; border:1px solid var(--card-border); border-radius:5px; padding:6px 10px; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between;';
        item.innerHTML = \`
          <div>
            <div style="font-weight:600; font-size:11px; color:#FFFFFF;">\${f.content?.en?.title || f.slug}</div>
            <div style="font-size:9px; color:var(--text-muted); font-family:var(--font-mono);">\${f.slug} • \${f.steps.length} steps</div>
          </div>
          <button class="step-tool-btn" style="color:var(--danger)" onclick="deleteStagedFlow(\${idx})">×</button>
        \`;
        container.appendChild(item);
      });
    }

    window.deleteStagedFlow = function(idx) {
      stagedFlows.splice(idx, 1);
      renderStagedFlows();
    };

    // Extension Host Message Listener
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'authState':
          if (msg.isAuthenticated) {
            setAuthScreen('success');
          } else {
            const shouldRestoreFocus = !authenticatedApp.classList.contains('hidden') || !workspaceGate.classList.contains('hidden');
            workspaceState = { state: 'loading', workspaces: [], selectedWorkspaceId: null };
            pendingWorkspaceId = null;
            availableProjects = [];
            selectedProjectId = null;
            contextPickerPinned = false;
            closeWorkspaceDialog();
            setAuthScreen('idle');
            if (shouldRestoreFocus) requestAnimationFrame(() => googleAuthButton.focus());
          }
          break;

        case 'workspaceState':
          workspaceState = {
            state: msg.state || 'error',
            workspaces: Array.isArray(msg.workspaces) ? msg.workspaces : [],
            selectedWorkspaceId: msg.selectedWorkspaceId || null,
            workspace: msg.workspace || null,
            message: msg.message || '',
          };
          if (!authSuccessTimer && msg.state !== 'signed_out') renderWorkspaceState();
          break;

        case 'deviceCodeRequested':
          authUserCode.textContent = msg.userCode;
          setAuthScreen('pending');
          break;

        case 'authProgress':
          if (msg.state === 'cancelled') {
            setAuthScreen('idle');
          } else if (msg.state === 'error' || msg.state === 'offline') {
            authRetryMode = msg.state === 'offline' ? 'restore-session' : 'new-auth';
            setAuthScreen('error', msg.message);
          } else if (msg.state === 'refreshing') {
            setAuthScreen('refreshing', msg.message || 'Refreshing your GuideKit session…');
          } else if (msg.state === 'starting') {
            setAuthScreen('starting', msg.message || 'Opening Google in your browser…');
          }
          break;

        case 'projectsLoaded':
          availableProjects = Array.isArray(msg.projects) ? msg.projects : [];
          selectedProjectId = msg.selectedProjectId || null;
          projectDisplayLimit = 20;
          renderProjectCards();
          if (availableProjects.length === 0) {
            projectMeta.textContent = 'Create projects on the GuideKit website.';
            showProjectPrompt('empty');
          } else {
            const selectedProject = availableProjects.find(p => p.id === selectedProjectId);
            if (selectedProject && !contextPickerPinned) showProjectTools(selectedProject);
            else {
              showProjectPrompt('choose');
            }
          }
          break;

        case 'stepCaptured':
          manualSteps.push(msg.step);
          manualSteps.forEach((s, i) => s.step_order = i + 1);
          renderManualSteps();
          break;

        case 'agentStatus':
          const banner = document.getElementById('opencode-running-banner');
          const statusText = document.getElementById('agent-status-text');
          if (msg.status === 'running') {
            banner.style.display = 'block';
            statusText.textContent = '🟢 Agent Spawned (PID: ' + (msg.pid || '...') + ')';
          } else if (msg.status === 'unspawning') {
            statusText.textContent = '⚪ Unspawning process...';
          } else if (msg.status === 'unspawned') {
            statusText.textContent = '⚪ Agent Process Unspawned Cleanly';
            setTimeout(() => {
              if (!currentDetectedFlow) banner.style.display = 'none';
            }, 3000);
          }
          break;

        case 'agentLog':
          const feed = document.getElementById('agent-log-feed');
          feed.textContent += msg.line + '\\n';
          feed.scrollTop = feed.scrollHeight;
          break;

        case 'flowDetected':
          currentDetectedFlow = msg.flow;
          document.getElementById('opencode-review-card').style.display = 'block';
          document.getElementById('detected-flow-slug').textContent = msg.flow.slug;
          document.getElementById('detected-flow-meta').textContent =
            (msg.flow.steps?.length || 0) + ' steps • Auth: ' + (msg.flow.requires_auth ? 'Yes' : 'No') +
            (msg.flow.required_role ? ' (' + msg.flow.required_role + ')' : '');

          const preview = document.getElementById('detected-steps-preview');
          preview.innerHTML = '';
          (msg.flow.steps || []).forEach((st, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'font-size:10px; padding:3px 0; border-bottom:1px solid #1C1E26; display:flex; justify-content:space-between;';
            row.innerHTML = '<span>' + (idx+1) + '. ' + (st.content?.en?.title || st.guide_id) + '</span><code style="color:var(--text-muted)">' + st.route_pattern + '</code>';
            preview.appendChild(row);
          });
          break;

        case 'publishSuccess':
          const pbtn = document.getElementById('btn-sync-publish');
          pbtn.disabled = false;
          pbtn.innerHTML = '🚀 Sync Workflows & Publish Manifest to CDN';
          document.getElementById('publish-result').innerHTML = \`
            <div style="background:var(--accent-bg); border:1px solid var(--accent-border); color:#6EE7B7; border-radius:5px; padding:8px; font-size:11px;">
              <strong>Published v\${msg.version_number}!</strong><br>
              ETag: <code style="font-family:var(--font-mono)">\${msg.etag.substring(0, 10)}...</code><br>
              Features: \${msg.published_features} compiled
            </div>
          \`;
          break;

        case 'existingFlowsLoaded':
          const hubFlows = document.getElementById('project-hub-flows');
          const hubCount = document.getElementById('project-hub-flow-count');
          if (hubFlows && hubCount) {
            const hubFeatures = Array.isArray(msg.features) ? msg.features : [];
            hubCount.textContent = hubFeatures.length + (hubFeatures.length === 1 ? ' flow' : ' flows');
            hubFlows.replaceChildren();
            if (hubFeatures.length === 0) {
              hubFlows.innerHTML = '<div class="py-4 text-[10px] leading-4 text-guidekit-faint">No flows yet. Open Studio or ask Open Code to draw one.</div>';
            } else {
              hubFeatures.slice(0, 3).forEach(feature => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'flex min-h-11 w-full items-center justify-between gap-3 border-0 bg-transparent py-2 text-left font-sans focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guidekit-focus';
                const title = feature.draft_version?.content?.en?.title || feature.published_version?.content?.en?.title || feature.slug;
                button.innerHTML = '<span class="min-w-0"><span class="block truncate text-[10px] font-medium text-guidekit-ink"></span><span class="mt-0.5 block font-mono text-[8px] text-guidekit-faint"></span></span><span class="shrink-0 text-[9px] text-guidekit-faint"></span>';
                button.querySelector('span span:first-child').textContent = title;
                button.querySelector('span span:nth-child(2)').textContent = feature.slug;
                button.lastElementChild.textContent = feature.draft_version ? 'Draft' : 'Published';
                button.addEventListener('click', () => vscode.postMessage({ command: 'openStudio', mode: 'flows' }));
                hubFlows.appendChild(button);
              });
            }
          }
          const flowsContainer = document.getElementById('existing-flows-list');
          if (flowsContainer) {
            if (!msg.features || msg.features.length === 0) {
              flowsContainer.innerHTML = '<div style="text-align:center; padding:16px 0; color:var(--text-muted); font-size:11px;">No workflows found in this project. Create one via Studio or OpenCode!</div>';
            } else {
              flowsContainer.innerHTML = '';
              msg.features.forEach(f => {
                const card = document.createElement('div');
                card.className = 'step-card';
                const isPub = Boolean(f.published_version);
                const badgeBg = isPub ? 'var(--accent-bg)' : 'var(--amber-bg)';
                const badgeColor = isPub ? 'var(--accent)' : 'var(--amber)';
                const badgeBorder = isPub ? 'var(--accent-border)' : 'var(--amber-border)';
                const badgeText = isPub ? 'Published' : 'Draft';
                const title = f.draft_version?.content?.en?.title || f.published_version?.content?.en?.title || f.slug;
                card.innerHTML = \`
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <strong style="color:#FFFFFF; font-size:12px;">\${title}</strong>
                    <span style="font-size:9px; padding:2px 6px; border-radius:4px; background:\${badgeBg}; color:\${badgeColor}; border:1px solid \${badgeBorder}; font-weight:600;">
                      \${badgeText}
                    </span>
                  </div>
                  <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:8px;">
                    \${f.slug} • \${f.step_count || 0} steps
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="editExistingFlow('\${f.id}')" style="flex:1;">✎ Edit Flow</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteExistingFlow('\${f.id}')" style="flex:1;">🗑 Delete</button>
                  </div>
                \`;
                flowsContainer.appendChild(card);
              });
            }
          }
          break;

        case 'loadFlowIntoStudio':
          manualSteps = msg.steps || [];
          const slugIn = document.getElementById('manual-flow-slug');
          const titleIn = document.getElementById('manual-flow-title');
          if (slugIn) slugIn.value = msg.slug || '';
          if (titleIn) titleIn.value = msg.title || '';
          if (document.getElementById('manual-flow-role')) {
            document.getElementById('manual-flow-role').value = msg.required_role || '';
          }
          if (document.getElementById('manual-flow-auth')) {
            document.getElementById('manual-flow-auth').checked = Boolean(msg.requires_auth);
          }
          switchTab('manual');
          renderManualSteps();
          break;

        case 'knowledgeLoaded':
          const kContainer = document.getElementById('knowledge-sources-list');
          if (kContainer) {
            if (!msg.sources || msg.sources.length === 0) {
              kContainer.innerHTML = '<div style="text-align:center; padding:12px 0; color:var(--text-muted); font-size:11px;">No knowledge sources indexed yet.</div>';
            } else {
              kContainer.innerHTML = '';
              msg.sources.forEach(src => {
                const row = document.createElement('div');
                row.className = 'step-card';
                row.innerHTML = \`
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>
                      <div style="color:#FFFFFF; font-weight:600; font-size:11px;">\${src.title}</div>
                      <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase;">
                        \${src.source_type} • <span style="color:var(--accent); font-weight:700;">\${src.chunk_count}</span> chunks
                      </div>
                    </div>
                    <button class="step-tool-btn" style="color:var(--danger);" onclick="deleteKnowledgeSource('\${src.id}')" title="Delete">🗑</button>
                  </div>
                \`;
                kContainer.appendChild(row);
              });
            }
          }
          break;

        case 'error':
          const btnErr = document.getElementById('btn-sync-publish');
          btnErr.disabled = false;
          btnErr.innerHTML = '🚀 Sync Workflows & Publish Manifest to CDN';
          document.getElementById('publish-result').innerHTML = \`
            <div style="background:var(--danger-bg); border:1px solid rgba(239,68,68,0.3); color:#FCA5A5; border-radius:5px; padding:8px; font-size:11px;">
              \${msg.message}
            </div>
          \`;
          break;
      }
    });

    function updateProjectMeta(p) {
      if (!p) { projectMeta.textContent = ''; return; }
      const framework = p.framework || 'Project';
      const locales = (p.supported_locales || ['en']).join(', ');
      projectMeta.textContent = framework + '  ·  ' + locales;
    }

    // Tell extension we are ready
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
}
//# sourceMappingURL=sidebarHtml.js.map