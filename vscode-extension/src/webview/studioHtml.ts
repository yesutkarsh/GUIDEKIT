/** Full-width GuideKit Studio webview. Follows DESIGN.md Minimal Dark principles. */
export function getStudioHtml(tailwindCss: string, nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <title>GuideKit Studio</title>
  <style nonce="${nonce}">${tailwindCss}</style>
  <style nonce="${nonce}">
    :root {
      color-scheme: dark;
      --canvas: #0a0a0a;
      --surface: #141414;
      --surface-card: rgba(23, 23, 23, 0.75);
      --surface-hover: #1f1f1f;
      --ink: #ffffff;
      --muted: #d4d4d4;
      --faint: #737373;
      --mono: #525252;
      --border: #262626;
      --border-subtle: #171717;
      --accent: #52a9ff;
      --accent-soft: rgba(82, 169, 255, 0.12);
      --accent-hover: #75bbef;
      --danger: #f87171;
      --danger-bg: rgba(239, 68, 68, 0.12);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      background: var(--canvas);
      color: var(--muted);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      overflow: hidden;
      user-select: none;
    }
    button, input, select, textarea { font: inherit; }
    button { color: inherit; }
    .app { height: 100%; display: flex; flex-direction: column; }

    /* Topbar */
    .topbar {
      height: 52px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--canvas);
      z-index: 10;
    }
    .brand { min-width: 0; display: flex; align-items: center; gap: 10px; }
    .brand-eyebrow {
      font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .top-actions { display: flex; align-items: center; gap: 8px; }

    /* Buttons */
    .btn {
      min-height: 32px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      padding: 0 12px;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      transition: background-color .15s, color .15s, border-color .15s;
      white-space: nowrap;
    }
    .btn:hover { background: var(--surface-hover); color: var(--ink); border-color: #383838; }
    .btn:focus-visible, .tab:focus-visible, .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .btn-primary { background: #ffffff; border-color: #ffffff; color: #0a0a0a; font-weight: 500; }
    .btn-primary:hover { background: #e5e5e5; border-color: #e5e5e5; color: #0a0a0a; }
    .btn-secondary { background: transparent; border-color: var(--border); color: var(--muted); }
    .btn-danger { color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: var(--danger-bg); color: #fecaca; }
    .btn-sm { min-height: 28px; padding: 0 10px; font-size: 11px; }
    .btn:disabled { opacity: .4; cursor: not-allowed; }
    .icon-btn {
      height: 30px;
      width: 30px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: transparent;
      color: var(--faint);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color .15s, color .15s, border-color .15s;
    }
    .icon-btn:hover { background: var(--surface-hover); color: var(--ink); border-color: #383838; }

    /* Navigation Tabs */
    .nav {
      height: 38px;
      flex: none;
      display: flex;
      align-items: flex-end;
      gap: 20px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--canvas);
    }
    .tab {
      height: 38px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--faint);
      padding: 0 2px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: color .15s;
    }
    .tab:hover { color: var(--muted); }
    .tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }

    /* Views */
    .view { display: none !important; min-height: 0; flex: 1; position: relative; }
    .view:not(.active) { display: none !important; }
    .view.active { display: flex !important; }
    .view.active.studio { width: 100%; flex-direction: column; }
    .view.active.agent { width: 100%; display: grid !important; grid-template-columns: minmax(340px, 1fr) minmax(380px, 1.15fr); }
    .view.active.flows-view { width: 100%; flex-direction: column; }

    /* Canvas Shell */
    .canvas-shell {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      background: var(--canvas);
    }

    /* Flow Meta & Controls Header */
    .flow-toolbar {
      height: 46px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface);
      z-index: 5;
    }
    .flow-identity { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
    .field-flow-title {
      height: 30px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: var(--ink);
      font-size: 13px;
      font-weight: 500;
      padding: 0 6px;
      outline: none;
      min-width: 130px;
      max-width: 240px;
    }
    .field-flow-title:hover { border-color: var(--border); }
    .field-flow-title:focus { border-color: var(--accent); background: var(--canvas); }
    .field-flow-slug {
      height: 26px;
      background: var(--canvas);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--faint);
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 0 8px;
      outline: none;
      width: 120px;
    }
    .field-flow-slug:focus { border-color: var(--accent); color: var(--ink); }
    .canvas-controls { display: flex; align-items: center; gap: 6px; }

    /* Flow Canvas Viewport */
    .canvas-viewport {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background-color: var(--canvas);
      background-image: radial-gradient(#262626 1px, transparent 1px);
      background-size: 20px 20px;
      cursor: grab;
    }
    .canvas-viewport.panning { cursor: grabbing; }

    .canvas-world {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
    }

    /* SVG Connections Layer */
    .canvas-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 5000px;
      height: 5000px;
      pointer-events: none;
      overflow: visible;
      z-index: 1;
    }
    .connection-line {
      fill: none;
      stroke: #333333;
      stroke-width: 2px;
      transition: stroke .2s;
    }
    .connection-line.active {
      stroke: var(--accent);
      stroke-width: 2.2px;
    }
    .connection-btn {
      pointer-events: auto;
      cursor: pointer;
    }
    .connection-btn circle {
      fill: var(--surface);
      stroke: var(--border);
      stroke-width: 1.5px;
      transition: fill .15s, stroke .15s;
    }
    .connection-btn:hover circle {
      fill: var(--accent);
      stroke: var(--accent);
    }
    .connection-btn text {
      fill: var(--faint);
      font-size: 13px;
      font-family: ui-monospace, monospace;
      font-weight: bold;
      pointer-events: none;
      transition: fill .15s;
    }
    .connection-btn:hover text { fill: #0a0a0a; }

    /* Nodes Container */
    .canvas-nodes {
      position: absolute;
      top: 0;
      left: 0;
      display: flex;
      align-items: center;
      gap: 76px;
      padding: 90px 80px;
      z-index: 2;
    }
    .canvas-nodes.vertical {
      flex-direction: column;
      gap: 64px;
      padding: 60px 100px;
    }

    /* N8N Style Nodes */
    .flow-node {
      width: 236px;
      min-height: 114px;
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      position: relative;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: border-color .15s, background-color .15s, box-shadow .15s, transform .15s;
      user-select: none;
    }
    .flow-node:hover {
      border-color: #404040;
      background: var(--surface-hover);
    }
    .flow-node.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent), 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      background: #171717;
    }
    .flow-node.dragging { opacity: .35; }
    .flow-node.drop-target-before {
      border-left: 2px solid var(--accent);
      box-shadow: -4px 0 10px -2px rgba(82, 169, 255, 0.4);
    }
    .flow-node.drop-target-after {
      border-right: 2px solid var(--accent);
      box-shadow: 4px 0 10px -2px rgba(82, 169, 255, 0.4);
    }
    .canvas-nodes.vertical .flow-node.drop-target-before {
      border-left: 1px solid var(--border);
      border-top: 2px solid var(--accent);
      box-shadow: 0 -4px 10px -2px rgba(82, 169, 255, 0.4);
    }
    .canvas-nodes.vertical .flow-node.drop-target-after {
      border-right: 1px solid var(--border);
      border-bottom: 2px solid var(--accent);
      box-shadow: 0 4px 10px -2px rgba(82, 169, 255, 0.4);
    }

    /* Port Handles */
    .node-port {
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--canvas);
      border: 2px solid var(--border);
      transition: border-color .15s, background-color .15s;
      z-index: 3;
    }
    .flow-node:hover .node-port, .flow-node.selected .node-port {
      border-color: var(--accent);
      background: var(--accent);
    }
    .port-left { left: -5px; top: calc(50% - 4.5px); }
    .port-right { right: -5px; top: calc(50% - 4.5px); }
    .port-top { top: -5px; left: calc(50% - 4.5px); }
    .port-bottom { bottom: -5px; left: calc(50% - 4.5px); }

    /* Node Internals */
    .node-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .drag-grip {
      color: var(--mono);
      font-size: 11px;
      cursor: grab;
      padding: 0 2px;
      letter-spacing: -1px;
    }
    .drag-grip:hover { color: var(--muted); }
    .node-step-badge {
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      letter-spacing: 0.05em;
    }
    .node-action-badge {
      font: 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 2.5px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 500;
    }
    .action-click { background: rgba(82, 169, 255, 0.12); color: var(--accent); border: 1px solid rgba(82, 169, 255, 0.25); }
    .action-input { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
    .action-navigate { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }
    .action-select { background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }

    .node-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink);
      margin-top: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-route {
      font: 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--faint);
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-target {
      font: 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      margin-top: 5px;
      padding: 2.5px 6px;
      background: var(--canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
      font-size: 10px;
    }
    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      margin-right: 5px;
    }
    .status-dot.pending { background: var(--accent); }
    .node-actions-hover {
      display: none;
      align-items: center;
      gap: 3px;
    }
    .flow-node:hover .node-actions-hover { display: flex; }
    .mini-btn {
      width: 18px;
      height: 18px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--canvas);
      color: var(--faint);
      display: grid;
      place-content: center;
      font-size: 10px;
      cursor: pointer;
    }
    .mini-btn:hover { color: var(--ink); border-color: var(--accent); }

    /* Trigger / Outcome Nodes */
    .terminal-node {
      width: 160px;
      min-height: 88px;
      background: var(--canvas);
      border: 1px dashed var(--border);
      border-radius: 14px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }
    .terminal-node.trigger-node { border-style: solid; border-color: var(--border); background: var(--surface); }
    .terminal-kicker {
      font: 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .terminal-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink);
      margin-top: 3px;
    }
    .terminal-subtitle {
      font: 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--faint);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Minimal Step Details Modal (Following DESIGN.md) */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-dialog {
      width: 100%;
      max-width: 440px;
      max-height: calc(100vh - 48px);
      background: #141414;
      border: 1px solid var(--border);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      animation: modal-enter 0.15s ease-out;
    }
    @keyframes modal-enter {
      from { opacity: 0; transform: scale(0.97) translateY(4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      height: 48px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      background: #171717;
      flex: none;
    }
    .modal-header-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-header-nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .modal-body {
      padding: 16px;
      overflow-y: auto;
      max-height: 65vh;
      font-size: 12px;
    }
    .modal-footer {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border-subtle);
      background: #171717;
      flex: none;
    }
    .modal-footer-left { display: flex; align-items: center; gap: 8px; }
    .modal-footer-right { display: flex; align-items: center; gap: 8px; }

    /* Form Fields */
    .form-group { margin-bottom: 12px; }
    .form-group:last-child { margin-bottom: 0; }
    label { display: block; font-size: 11px; font-weight: 500; color: var(--faint); margin-bottom: 4px; }
    .field {
      width: 100%;
      height: 32px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--canvas);
      color: var(--ink);
      padding: 0 10px;
      font-size: 12px;
      outline: none;
      transition: border-color .15s;
    }
    .field:focus { border-color: var(--accent); }
    .textarea {
      width: 100%;
      min-height: 56px;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--canvas);
      color: var(--ink);
      padding: 7px 10px;
      font-size: 12px;
      outline: none;
      transition: border-color .15s;
    }
    .textarea:focus { border-color: var(--accent); }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    .source-box {
      margin-top: 10px;
      padding: 9px 11px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--canvas);
      color: var(--faint);
      font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
    .approval-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 11px;
    }
    .approval-row input { margin-top: 3px; accent-color: var(--accent); }
    .code-review {
      margin-top: 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--canvas);
    }
    .code-review summary { padding: 5px 8px; color: var(--faint); font-size: 10px; cursor: pointer; }
    .code-review pre { margin: 0; padding: 0 8px 8px; color: var(--muted); font: 10px/1.4 ui-monospace, monospace; white-space: pre-wrap; }

    /* Dedicated Flows Screen */
    .flows-view {
      width: 100%;
      height: 100%;
      min-height: 0;
      flex: 1;
      overflow-y: auto;
      background: var(--canvas);
      padding: 32px 24px;
    }
    .flows-screen-container {
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .flows-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .flows-header-info { min-width: 0; }
    .flows-eyebrow {
      font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .flows-title {
      font-size: 20px;
      font-weight: 500;
      color: var(--ink);
      margin: 0 0 6px 0;
      letter-spacing: -0.01em;
    }
    .flows-description {
      color: var(--faint);
      font-size: 13px;
      margin: 0;
      line-height: 1.5;
    }
    .flows-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .flows-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .flows-search-wrap {
      flex: 1;
      max-width: 380px;
    }
    .flows-search-input {
      width: 100%;
      height: 34px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--ink);
      padding: 0 12px;
      font-size: 12px;
      outline: none;
      transition: border-color .15s;
    }
    .flows-search-input:focus {
      border-color: var(--accent);
    }
    .flows-stats {
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--faint);
    }
    .flow-cards-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .flow-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-card);
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      transition: border-color .15s, background-color .15s;
    }
    .flow-card:hover {
      border-color: #383838;
      background: var(--surface-hover);
    }
    .flow-card-main { min-width: 0; flex: 1; }
    .flow-card-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .flow-card-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .flow-card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--faint);
    }
    .flow-badge {
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 3px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .flow-badge-draft {
      background: rgba(82, 169, 255, 0.12);
      color: var(--accent);
      border: 1px solid rgba(82, 169, 255, 0.25);
    }
    .flow-badge-published {
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .flow-badge-empty {
      background: rgba(115, 115, 115, 0.12);
      color: var(--faint);
      border: 1px solid var(--border);
    }
    .flow-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .flows-loading, .flows-empty {
      padding: 48px 24px;
      text-align: center;
      color: var(--faint);
      border: 1px dashed var(--border-subtle);
      border-radius: 12px;
      background: rgba(20, 20, 20, 0.3);
    }

    /* Open Code AI Chatbot View */
    .agent {
      min-height: 0;
      width: 100%;
      height: 100%;
      background: var(--canvas);
    }
    .chat {
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-subtle);
      background: var(--canvas);
    }
    .chat-header {
      height: 48px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface);
    }
    .chat-identity {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .chat-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink);
      letter-spacing: -0.01em;
    }
    .chat-subtitle {
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
    }
    .chat-status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
    }
    .chat-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      flex: none;
      transition: background-color 0.2s;
    }
    .chat-status-dot.active {
      background: #ffffff;
    }

    /* Starter prompt suggestions chips */
    .starter-chips {
      padding: 10px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--canvas);
      flex: none;
    }
    .chip-btn {
      font-size: 11px;
      font-family: inherit;
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      background: transparent;
      color: var(--muted);
      padding: 4px 11px;
      cursor: pointer;
      line-height: 1.4;
      transition: color .15s, border-color .15s, background-color .15s;
    }
    .chip-btn:hover {
      color: var(--ink);
      border-color: var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    /* Chat Log */
    .chat-log {
      min-height: 0;
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .chat-bubble-wrap {
      display: flex;
      flex-direction: column;
      max-width: 88%;
    }
    .chat-bubble-wrap.user {
      align-self: flex-end;
      align-items: flex-end;
    }
    .chat-bubble-wrap.assistant {
      align-self: flex-start;
      align-items: flex-start;
    }
    .chat-sender {
      font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      margin-bottom: 4px;
      padding: 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .chat-bubble {
      padding: 9px 13px;
      border-radius: 8px;
      font-size: 12.5px;
      line-height: 1.55;
      word-break: break-word;
    }
    .chat-bubble-wrap.user .chat-bubble {
      background: #ffffff;
      color: #0a0a0a;
      font-weight: 500;
    }
    .chat-bubble-wrap.assistant .chat-bubble {
      background: #121212;
      border: 1px solid var(--border-subtle);
      color: var(--muted);
    }
    .chat-bubble code {
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.07);
      color: var(--ink);
    }
    .chat-activity-details {
      margin-top: 4px;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: var(--surface);
      font-size: 11px;
      max-width: 100%;
    }
    .chat-activity-details summary {
      padding: 5px 8px;
      color: var(--mono);
      cursor: pointer;
      user-select: none;
      font: 10.5px ui-monospace, monospace;
    }
    .chat-activity-details pre {
      margin: 0;
      padding: 6px 10px 8px;
      color: var(--mono);
      font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      max-height: 140px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    /* Modern Minimal Composer */
    .composer {
      padding: 12px 16px 14px;
      border-top: 1px solid var(--border-subtle);
      background: var(--surface);
      flex: none;
    }
    .chat-input-box {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--canvas);
      padding: 10px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color .15s;
    }
    .chat-input-box:focus-within {
      border-color: #525252;
    }
    .chat-input-box .textarea {
      width: 100%;
      min-height: 52px;
      max-height: 120px;
      margin: 0;
      padding: 0;
      background: transparent;
      border: none;
      outline: none;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--ink);
      resize: none;
      font-family: inherit;
    }
    .chat-input-box .textarea::placeholder {
      color: var(--mono);
    }
    .chat-input-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .chat-input-hint {
      font: 10.5px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      user-select: none;
    }
    .chat-send-btn {
      height: 28px;
      padding: 0 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      color: #0a0a0a;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background-color .15s, opacity .15s;
    }
    .chat-send-btn:hover {
      background: #e5e5e5;
    }
    .chat-send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .chat-stop-btn {
      height: 28px;
      padding: 0 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #2a1515;
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
      cursor: pointer;
      transition: background-color .15s;
    }
    .chat-stop-btn:hover {
      background: #3b1818;
    }

    /* Proposal View Panel */
    .proposal {
      min-width: 0;
      height: 100%;
      overflow-y: auto;
      padding: 20px 24px;
      background: var(--canvas);
      display: flex;
      flex-direction: column;
    }
    .proposal-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .proposal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .proposal-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink);
      margin: 0 0 3px;
    }
    .proposal-slug {
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
    }
    .proposal-badge {
      font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--canvas);
      border: 1px solid var(--border);
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .proposal-steps-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .proposal-step-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: var(--canvas);
    }
    .proposal-step-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .proposal-step-badge {
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
      background: var(--surface);
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      flex: none;
    }
    .proposal-step-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .proposal-step-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    .proposal-step-route {
      font: 10.5px ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--mono);
    }
    .proposal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
    }
    .proposal-empty {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      max-width: 360px;
      margin: 0 auto;
      text-align: left;
    }
    .proposal-empty-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .proposal-empty-desc {
      font-size: 12px;
      color: var(--mono);
      line-height: 1.6;
      margin: 0;
    }

    /* Alerts */
    .alert {
      border: 1px solid rgba(248, 113, 113, 0.35);
      border-radius: 8px;
      background: var(--danger-bg);
      color: #fecaca;
      padding: 10px 14px;
      margin: 10px 16px 0;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .hidden { display: none !important; }
    .spinner { width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.2); border-top-color: currentColor; border-radius: 50%; animation: spin .8s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Responsive Edge Cases: 13-inch laptop, narrow splits */
    @media (max-width: 640px) {
      .topbar { padding: 0 10px; }
      .top-actions .wide-label { display: none; }
      .nav { padding: 0 10px; gap: 14px; }
      .flow-toolbar { padding: 0 10px; }
      .modal-dialog { max-width: 95vw; }
      .flows-view { padding: 16px 12px; }
      .flows-header { flex-direction: column; align-items: stretch; gap: 12px; }
      .flows-header-actions { justify-content: flex-start; }
      .flows-toolbar { flex-direction: column; align-items: stretch; }
      .flows-search-wrap { max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="app">
  <!-- Topbar -->
  <header class="topbar">
    <div class="brand">
      <span class="brand-eyebrow" id="workspace-name">GuideKit</span>
      <h1 class="brand-title" id="project-name">Loading project…</h1>
    </div>
    <div class="top-actions">
      <span class="brand-eyebrow" id="save-state">Draft saved</span>
      <button class="btn btn-secondary" id="save-draft" type="button">
        <span class="wide-label">Save draft</span><span class="short-label">Save</span>
      </button>
      <button class="btn btn-primary" id="publish-flow" type="button" disabled>
        <span class="wide-label">Publish flow</span><span class="short-label">Publish</span>
      </button>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <nav class="nav" aria-label="Studio modes">
    <button class="tab" data-tab="studio" aria-selected="true" type="button">Studio</button>
    <button class="tab" data-tab="agent" aria-selected="false" type="button">Open Code</button>
    <button class="tab" data-tab="flows" aria-selected="false" type="button">Flows</button>
  </nav>

  <div id="global-alert" class="alert hidden" role="alert"></div>

  <!-- STUDIO VIEW -->
  <main class="view studio active" id="view-studio">
    <section class="canvas-shell" aria-label="Flow Studio Canvas">
      <!-- Flow Toolbar -->
      <div class="flow-toolbar">
        <div class="flow-identity">
          <input class="field-flow-title" id="flow-title" value="Untitled flow" title="Edit flow title" placeholder="Flow title" />
          <input class="field-flow-slug" id="flow-slug" value="untitled-flow" title="Edit flow slug" placeholder="flow-slug" />
          <button class="btn btn-secondary btn-sm" id="new-flow" type="button">+ New flow</button>
          <button class="btn btn-secondary btn-sm" id="btn-toolbar-add-step" type="button">+ Add step</button>
        </div>
        <div class="canvas-controls">
          <button class="btn btn-secondary btn-sm" id="btn-layout-toggle" type="button" title="Switch between Horizontal and Vertical flow">
            <span id="layout-label">Vertical</span>
          </button>
          <button class="icon-btn" id="btn-zoom-out" type="button" title="Zoom out">−</button>
          <button class="btn btn-secondary btn-sm" id="btn-zoom-reset" type="button" title="Reset zoom (100%)">
            <span id="zoom-value">100%</span>
          </button>
          <button class="icon-btn" id="btn-zoom-in" type="button" title="Zoom in">+</button>
          <button class="btn btn-secondary btn-sm" id="btn-zoom-fit" type="button" title="Fit all steps on screen">Fit</button>
        </div>
      </div>

      <!-- Interactive Canvas Viewport -->
      <div class="canvas-viewport" id="canvas-viewport">
        <div class="canvas-world" id="canvas-world">
          <svg class="canvas-svg" id="canvas-svg">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#52a9ff" />
              </marker>
              <marker id="arrow-neutral" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#444444" />
              </marker>
            </defs>
            <g id="svg-paths-layer"></g>
          </svg>
          <div class="canvas-nodes" id="canvas-nodes"></div>
        </div>
      </div>
    </section>

    <!-- Minimal Step Details Modal (Following DESIGN.md) -->
    <div id="step-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="modal-step-title">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-header-meta">
            <span class="node-step-badge" id="modal-step-badge">STEP 01</span>
            <span class="node-action-badge action-click" id="modal-action-badge">CLICK</span>
            <span class="status" id="step-pager" style="margin-left:4px;">
              <span id="step-pager-indicator">1 of 1</span>
            </span>
          </div>
          <div class="modal-header-nav">
            <button class="icon-btn" id="btn-prev-step" type="button" title="Previous step" style="height:24px;width:24px;font-size:11px;">←</button>
            <button class="icon-btn" id="btn-next-step" type="button" title="Next step" style="height:24px;width:24px;font-size:11px;">→</button>
            <button class="icon-btn" id="btn-back-to-flow" type="button" title="Close (Esc)" style="height:24px;width:24px;font-size:13px;">×</button>
          </div>
        </div>

        <div class="modal-body" id="modal-body"></div>

        <div class="modal-footer">
          <div class="modal-footer-left">
            <button class="btn btn-secondary btn-sm" id="btn-open-source" type="button">Open in Editor</button>
            <button class="btn btn-danger btn-sm" id="btn-delete-step" type="button">Delete</button>
          </div>
          <div class="modal-footer-right">
            <button class="btn btn-primary btn-sm" id="btn-step-done" type="button">Done</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- OPEN CODE AGENT VIEW (AI Chatbot & Flow Proposal) -->
  <main class="view agent" id="view-agent">
    <section class="chat" aria-label="Open Code AI Chatbot">
      <div class="chat-header">
        <div class="chat-identity">
          <span class="chat-title">Open Code</span>
          <span class="chat-subtitle">Flow synthesizer</span>
        </div>
        <div class="chat-status-pill">
          <span class="chat-status-dot" id="agent-status-dot"></span>
          <span id="agent-status-text">Ready</span>
        </div>
      </div>

      <div class="starter-chips" id="starter-chips">
        <button class="chip-btn" data-prompt="Synthesize an onboarding tour for new users" type="button">Onboarding tour</button>
        <button class="chip-btn" data-prompt="Discover and map the checkout walkthrough" type="button">Checkout walkthrough</button>
        <button class="chip-btn" data-prompt="Detect authentication and login flow" type="button">Authentication flow</button>
        <button class="chip-btn" data-prompt="Build a settings and profile tour" type="button">Settings tour</button>
      </div>

      <div class="chat-log" id="chat-log" aria-live="polite">
        <div class="chat-bubble-wrap assistant">
          <span class="chat-sender">Open Code</span>
          <div class="chat-bubble">
            Describe a user flow to synthesize into a product tour. Open Code analyzes routes, buttons, and views across your workspace to draft steps.
          </div>
        </div>
      </div>

      <div class="composer">
        <div class="chat-input-box">
          <textarea class="textarea" id="agent-prompt" placeholder="Ask Open Code to synthesize a tour (e.g. 'Build checkout tour')…"></textarea>
          <div class="chat-input-actions">
            <span class="chat-input-hint">Enter to send · Shift+Enter for new line</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="chat-send-btn" id="run-agent" type="button">Send</button>
              <button class="chat-stop-btn hidden" id="stop-agent" type="button">Stop</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="proposal" id="proposal" aria-label="Flow Proposal Review">
      <div class="proposal-empty">
        <div class="proposal-empty-title">No Flow Proposal Yet</div>
        <p class="proposal-empty-desc">Ask Open Code to detect interactive routes and buttons. Once synthesized, the reviewable tour will appear here.</p>
      </div>
    </section>
  </main>

  <!-- FLOWS LIST VIEW (Dedicated Full-Screen View) -->
  <main class="view flows-view" id="view-flows">
    <div class="flows-screen-container">
      <div class="flows-header">
        <div class="flows-header-info">
          <div class="flows-eyebrow">WORKSPACE FLOWS</div>
          <h2 class="flows-title">Project Flows</h2>
          <p class="flows-description">Inspect, modify, and manage onboarding tours and product flows in this workspace.</p>
        </div>
        <div class="flows-header-actions">
          <button class="btn btn-secondary btn-sm" id="refresh-flows" type="button">Refresh</button>
          <button class="btn btn-primary btn-sm" id="btn-flows-new" type="button">+ New Flow</button>
        </div>
      </div>

      <div class="flows-toolbar">
        <div class="flows-search-wrap">
          <input class="flows-search-input" id="flows-search" type="search" placeholder="Filter flows by title or slug…" />
        </div>
        <div class="flows-stats" id="flows-stats-badge">0 flows</div>
      </div>

      <div class="flow-cards-container" id="flow-list">
        <div class="flows-loading">Loading flows…</div>
      </div>
    </div>
  </main>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const state = {
    project: null,
    flow: null,
    steps: [],
    selected: -1,
    features: [],
    dirty: false,
    savedFeatureIds: [],
    proposal: null,
    running: false,
    provider: null,
    isVertical: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0
  };

  let isDraggingNode = false;
  let dragJustFinished = false;

  const byId = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const post = (command, payload={}) => vscode.postMessage(Object.assign({command}, payload));

  let alertTimeout = null;
  function showAlert(message) {
    const el = byId('global-alert');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.innerHTML = '';
      if (alertTimeout) clearTimeout(alertTimeout);
      return;
    }
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Notice:</span>' +
        '<span>' + esc(message) + '</span>' +
      '</div>' +
      '<button class="icon-btn" id="btn-close-alert" type="button" title="Dismiss" style="height:22px;width:22px;font-size:13px;border:none;flex:none;cursor:pointer;">×</button>';
    el.classList.remove('hidden');
    const closeBtn = byId('btn-close-alert');
    if (closeBtn) closeBtn.addEventListener('click', () => showAlert(''));
    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => showAlert(''), 6000);
  }

  function setDirty(value=true) {
    state.dirty = value;
    byId('save-state').textContent = value ? 'Unsaved changes' : 'Draft saved';
    byId('publish-flow').disabled = value || !state.savedFeatureIds.length;
    sendDraftState();
  }

  function sendDraftState() {
    post('studioDraftState', {
      slug: byId('flow-slug').value.trim() || 'untitled-flow',
      title: byId('flow-title').value.trim() || 'Untitled flow',
      stepCount: state.steps.length
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    byId('view-' + name).classList.add('active');
    if (name === 'flows') {
      renderFlows();
      post('loadExistingFlows');
    }
    if (name === 'studio') requestAnimationFrame(renderCanvas);
  }
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  function normalizeSteps() {
    state.steps.forEach((step, index) => {
      step.step_order = index + 1;
      if (!step.guide_id) {
        step.guide_id = (byId('flow-slug').value.trim() || 'flow') + '-step-' + (index + 1);
      }
    });
  }

  /* Canvas Transformation & Zooming */
  function updateWorldTransform() {
    const world = byId('canvas-world');
    world.style.transform = 'translate(' + state.panX + 'px, ' + state.panY + 'px) scale(' + state.zoom + ')';
    byId('zoom-value').textContent = Math.round(state.zoom * 100) + '%';
  }

  function setZoom(newZoom, centerX, centerY) {
    const clamped = Math.max(0.35, Math.min(2.2, newZoom));
    if (centerX !== undefined && centerY !== undefined) {
      const scaleChange = clamped / state.zoom;
      state.panX = centerX - (centerX - state.panX) * scaleChange;
      state.panY = centerY - (centerY - state.panY) * scaleChange;
    }
    state.zoom = clamped;
    updateWorldTransform();
  }

  function fitToScreen() {
    const nodes = document.querySelectorAll('.flow-node, .terminal-node');
    if (!nodes.length) {
      state.zoom = 1; state.panX = 40; state.panY = 40;
      updateWorldTransform();
      return;
    }
    const container = byId('canvas-viewport').getBoundingClientRect();
    const nodesLayer = byId('canvas-nodes').getBoundingClientRect();
    const contentW = nodesLayer.width / state.zoom;
    const contentH = nodesLayer.height / state.zoom;
    const scaleX = (container.width - 100) / contentW;
    const scaleY = (container.height - 100) / contentH;
    const fitScale = Math.max(0.4, Math.min(1.15, Math.min(scaleX, scaleY)));
    state.zoom = fitScale;
    state.panX = Math.max(20, (container.width - contentW * fitScale) / 2);
    state.panY = Math.max(20, (container.height - contentH * fitScale) / 2);
    updateWorldTransform();
  }

  /* Pan and Zoom Event Listeners */
  const viewport = byId('canvas-viewport');
  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.flow-node, .terminal-node, .connection-btn')) return;
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    viewport.classList.add('panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isPanning) return;
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    updateWorldTransform();
  });

  window.addEventListener('mouseup', () => {
    if (state.isPanning) {
      state.isPanning = false;
      viewport.classList.remove('panning');
    }
  });

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom(state.zoom * zoomFactor, mouseX, mouseY);
    } else {
      state.panX -= e.deltaX;
      state.panY -= e.deltaY;
      updateWorldTransform();
    }
  }, { passive: false });

  viewport.addEventListener('dblclick', (e) => {
    if (e.target.closest('.flow-node, .terminal-node')) return;
    fitToScreen();
  });

  byId('btn-zoom-in').addEventListener('click', () => {
    const rect = viewport.getBoundingClientRect();
    setZoom(state.zoom * 1.15, rect.width / 2, rect.height / 2);
  });
  byId('btn-zoom-out').addEventListener('click', () => {
    const rect = viewport.getBoundingClientRect();
    setZoom(state.zoom * 0.85, rect.width / 2, rect.height / 2);
  });
  byId('btn-zoom-reset').addEventListener('click', () => {
    const rect = viewport.getBoundingClientRect();
    setZoom(1, rect.width / 2, rect.height / 2);
  });
  byId('btn-zoom-fit').addEventListener('click', fitToScreen);

  byId('btn-layout-toggle').addEventListener('click', () => {
    state.isVertical = !state.isVertical;
    byId('layout-label').textContent = state.isVertical ? 'Horizontal' : 'Vertical';
    byId('canvas-nodes').classList.toggle('vertical', state.isVertical);
    renderCanvas();
    fitToScreen();
  });

  /* Node Graph & Smooth SVG Bezier Path Rendering */
  function renderCanvas() {
    normalizeSteps();
    const container = byId('canvas-nodes');
    container.classList.toggle('vertical', state.isVertical);
    container.replaceChildren();

    // 1. Start / Trigger Node
    const prereq = state.flow && state.flow.prerequisite_feature_slug;
    const startNode = document.createElement('div');
    startNode.className = 'terminal-node trigger-node';
    startNode.id = 'node-start';
    startNode.innerHTML = '<div class="node-port ' + (state.isVertical ? 'port-bottom' : 'port-right') + '"></div>' +
      '<div class="terminal-kicker">TRIGGER</div>' +
      '<div class="terminal-title">Tour Start</div>' +
      '<div class="terminal-subtitle">' + esc(prereq ? 'After: ' + prereq : (state.steps[0] ? state.steps[0].route_pattern : '/')) + '</div>';
    startNode.addEventListener('click', () => {
      closeStepModal();
    });
    container.appendChild(startNode);

    // 2. Interactive Steps
    state.steps.forEach((step, index) => {
      const node = document.createElement('div');
      node.className = 'flow-node' + (state.selected === index ? ' selected' : '');
      node.id = 'node-step-' + index;
      node.draggable = true;
      node.dataset.index = String(index);

      const actionClass = 'action-' + (step.action_type || 'click');
      const actionLabel = (step.action_type || 'click').toUpperCase();
      const title = (step.content && step.content.en && step.content.en.title) || step.guide_id || ('Step ' + (index + 1));
      const route = step.route_pattern || '/';
      const selector = (step.target_fingerprint && (step.target_fingerprint.css || step.target_fingerprint.tag)) || step.guide_id;

      node.innerHTML =
        '<div class="node-port ' + (state.isVertical ? 'port-top' : 'port-left') + '"></div>' +
        '<div class="node-port ' + (state.isVertical ? 'port-bottom' : 'port-right') + '"></div>' +
        '<div class="node-header">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span class="drag-grip" title="Drag to reorder">⋮⋮</span>' +
            '<span class="node-step-badge">STEP ' + String(index + 1).padStart(2, '0') + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span class="node-action-badge ' + actionClass + '">' + esc(actionLabel) + '</span>' +
            '<div class="node-actions-hover">' +
              (index > 0 ? '<button class="mini-btn move-prev" type="button" title="Move earlier">' + (state.isVertical ? '↑' : '←') + '</button>' : '') +
              (index < state.steps.length - 1 ? '<button class="mini-btn move-next" type="button" title="Move later">' + (state.isVertical ? '↓' : '→') + '</button>' : '') +
              '<button class="mini-btn del-step" type="button" title="Delete step">×</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="node-title">' + esc(title) + '</div>' +
        '<div class="node-route">' + esc(route) + '</div>' +
        '<div class="node-target">' + esc(selector) + '</div>' +
        '<div class="node-footer">' +
          '<span><span class="status-dot ' + (step.source_edit ? 'pending' : '') + '"></span>' + (step.source_edit ? 'Source edit pending' : 'Target verified') + '</span>' +
          (step.source_file ? '<span class="status">' + esc(step.source_file.split(/[\\/]/).pop() || '') + '</span>' : '') +
        '</div>';

      /* Drag & Drop Reordering without opening modal */
      node.addEventListener('dragstart', (e) => {
        isDraggingNode = true;
        dragJustFinished = true;
        node.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(index));
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
        document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('drop-target-before', 'drop-target-after'));
        isDraggingNode = false;
        setTimeout(() => {
          dragJustFinished = false;
        }, 120);
      });

      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = node.getBoundingClientRect();
        const mid = state.isVertical ? (rect.top + rect.height / 2) : (rect.left + rect.width / 2);
        const isBefore = state.isVertical ? (e.clientY < mid) : (e.clientX < mid);
        node.classList.toggle('drop-target-before', isBefore);
        node.classList.toggle('drop-target-after', !isBefore);
      });

      node.addEventListener('dragleave', () => {
        node.classList.remove('drop-target-before', 'drop-target-after');
      });

      node.addEventListener('drop', (e) => {
        e.preventDefault();
        node.classList.remove('drop-target-before', 'drop-target-after');
        const fromIdxStr = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
        const fromIdx = Number(fromIdxStr);
        if (!Number.isInteger(fromIdx) || fromIdx === index) return;

        const rect = node.getBoundingClientRect();
        const mid = state.isVertical ? (rect.top + rect.height / 2) : (rect.left + rect.width / 2);
        const isBefore = state.isVertical ? (e.clientY < mid) : (e.clientX < mid);

        const movedItem = state.steps.splice(fromIdx, 1)[0];
        let targetIdx = index;
        if (fromIdx < index && isBefore) targetIdx = index - 1;
        else if (fromIdx > index && !isBefore) targetIdx = index + 1;

        state.steps.splice(targetIdx, 0, movedItem);
        setDirty();
        renderCanvas();
      });

      /* Click to open minimal modal (suppressed if drag just finished) */
      node.addEventListener('click', (e) => {
        if (dragJustFinished || isDraggingNode) return;
        if (e.target.closest('.mini-btn')) return;
        openStepModal(index);
      });

      const btnPrev = node.querySelector('.move-prev');
      if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); moveStep(index, -1); });
      const btnNext = node.querySelector('.move-next');
      if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); moveStep(index, 1); });
      const btnDel = node.querySelector('.del-step');
      if (btnDel) btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        state.steps.splice(index, 1);
        state.selected = Math.min(state.selected, state.steps.length - 1);
        setDirty();
        renderCanvas();
        if (!byId('step-modal').classList.contains('hidden')) {
          if (state.selected >= 0 && state.steps[state.selected]) {
            renderModalContent();
          } else {
            closeStepModal();
          }
        }
      });

      container.appendChild(node);
    });

    // 3. Complete / Outcome Node
    const completeNode = document.createElement('div');
    completeNode.className = 'terminal-node';
    completeNode.id = 'node-complete';
    completeNode.innerHTML = '<div class="node-port ' + (state.isVertical ? 'port-top' : 'port-left') + '"></div>' +
      '<div class="terminal-kicker">OUTCOME</div>' +
      '<div class="terminal-title">Tour Complete</div>' +
      '<div class="terminal-subtitle">' + state.steps.length + ' guided ' + (state.steps.length === 1 ? 'step' : 'steps') + '</div>';
    completeNode.addEventListener('click', () => {
      closeStepModal();
    });
    container.appendChild(completeNode);

    // Render smooth SVG bezier lines after DOM placement
    requestAnimationFrame(drawSvgConnectors);
  }

  function drawSvgConnectors() {
    const svgGroup = byId('svg-paths-layer');
    svgGroup.replaceChildren();

    const nodeElements = [];
    const startNode = byId('node-start');
    if (startNode) nodeElements.push(startNode);
    state.steps.forEach((_, i) => {
      const el = byId('node-step-' + i);
      if (el) nodeElements.push(el);
    });
    const completeNode = byId('node-complete');
    if (completeNode) nodeElements.push(completeNode);

    for (let i = 0; i < nodeElements.length - 1; i++) {
      const fromEl = nodeElements[i];
      const toEl = nodeElements[i + 1];

      const fromRect = {
        x: fromEl.offsetLeft,
        y: fromEl.offsetTop,
        w: fromEl.offsetWidth,
        h: fromEl.offsetHeight
      };
      const toRect = {
        x: toEl.offsetLeft,
        y: toEl.offsetTop,
        w: toEl.offsetWidth,
        h: toEl.offsetHeight
      };

      let startX, startY, endX, endY, d;
      if (state.isVertical) {
        startX = fromRect.x + fromRect.w / 2;
        startY = fromRect.y + fromRect.h;
        endX = toRect.x + toRect.w / 2;
        endY = toRect.y;
        const dy = Math.max(28, (endY - startY) * 0.5);
        d = 'M ' + startX + ' ' + startY + ' C ' + startX + ' ' + (startY + dy) + ', ' + endX + ' ' + (endY - dy) + ', ' + endX + ' ' + endY;
      } else {
        startX = fromRect.x + fromRect.w;
        startY = fromRect.y + fromRect.h / 2;
        endX = toRect.x;
        endY = toRect.y + toRect.h / 2;
        const dx = Math.max(32, (endX - startX) * 0.45);
        d = 'M ' + startX + ' ' + startY + ' C ' + (startX + dx) + ' ' + startY + ', ' + (endX - dx) + ' ' + endY + ', ' + endX + ' ' + endY;
      }

      // Smooth path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'connection-line' + (state.selected === i - 1 || state.selected === i ? ' active' : ''));
      path.setAttribute('marker-end', (state.selected === i - 1 || state.selected === i) ? 'url(#arrow)' : 'url(#arrow-neutral)');
      svgGroup.appendChild(path);

      // Midpoint "+" insert button
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'connection-btn');
      g.setAttribute('transform', 'translate(' + midX + ',' + midY + ')');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '8.5');
      g.appendChild(circle);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dy', '3.5');
      txt.textContent = '+';
      g.appendChild(txt);

      const insertIndex = i; // inserts between step i and i+1
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        insertStepAt(insertIndex);
      });
      svgGroup.appendChild(g);
    }
  }

  function moveStep(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.steps.length) return;
    const item = state.steps.splice(index, 1)[0];
    state.steps.splice(target, 0, item);
    state.selected = target;
    setDirty();
    renderCanvas();
    if (!byId('step-modal').classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function insertStepAt(index) {
    const newStep = {
      step_order: index + 1,
      guide_id: (byId('flow-slug').value.trim() || 'flow') + '-step-' + (index + 1),
      route_pattern: state.steps[index - 1] ? state.steps[index - 1].route_pattern : '/',
      action_type: 'click',
      advance_on: 'click',
      content: { en: { title: 'New step', description: '' } },
      target_fingerprint: { tag: 'button' },
      is_optional: false,
      wait_timeout_ms: 5000
    };
    state.steps.splice(index, 0, newStep);
    setDirty();
    renderCanvas();
    openStepModal(index);
  }

  /* Minimal Step Details Modal Controller */
  function openStepModal(index) {
    if (index < 0 || index >= state.steps.length) return;
    state.selected = index;
    document.querySelectorAll('.flow-node').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });
    renderModalContent();
    byId('step-modal').classList.remove('hidden');
  }

  function closeStepModal() {
    state.selected = -1;
    document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));
    byId('step-modal').classList.add('hidden');
    drawSvgConnectors();
  }

  function renderModalContent() {
    if (state.selected < 0 || !state.steps[state.selected]) {
      closeStepModal();
      return;
    }
    const step = state.steps[state.selected];
    const total = state.steps.length;

    byId('modal-step-badge').textContent = 'STEP ' + String(state.selected + 1).padStart(2, '0');
    byId('modal-action-badge').textContent = (step.action_type || 'click').toUpperCase();
    byId('modal-action-badge').className = 'node-action-badge action-' + (step.action_type || 'click');
    byId('step-pager-indicator').textContent = (state.selected + 1) + ' of ' + total;

    byId('btn-prev-step').disabled = state.selected <= 0;
    byId('btn-next-step').disabled = state.selected >= total - 1;

    const sourceApproval = step.source_edit
      ? '<label class="approval-row"><input id="approve-step-source" type="checkbox" ' + (step.source_edit.approved === false ? '' : 'checked') + '><span>Inject reviewed <code>data-guide-id</code> into source on save.</span></label>' +
        '<details class="code-review"><summary>Review code change</summary><pre>- ' + esc(step.source_edit.before) + '\\n+ ' + esc(step.source_edit.after) + '</pre></details>'
      : '';

    const body = byId('modal-body');
    body.innerHTML =
      '<div class="form-group">' +
        '<label>Step Title</label>' +
        '<input class="field" id="step-title" value="' + esc((step.content && step.content.en && step.content.en.title) || '') + '" placeholder="e.g. Click checkout button" />' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Description / Instruction</label>' +
        '<textarea class="textarea" id="step-description" placeholder="Guide instruction for the user">' + esc((step.content && step.content.en && step.content.en.description) || '') + '</textarea>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Route Pattern</label>' +
        '<input class="field" id="step-route" value="' + esc(step.route_pattern || '/') + '" placeholder="/dashboard" />' +
      '</div>' +
      '<div class="form-group two-col">' +
        '<div>' +
          '<label>Action</label>' +
          '<select class="field" id="step-action">' + options(['click', 'input', 'select', 'navigate'], step.action_type) + '</select>' +
        '</div>' +
        '<div>' +
          '<label>Advance Trigger</label>' +
          '<select class="field" id="step-advance">' + options(['click', 'input_valid', 'route_change', 'manual_next'], step.advance_on) + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="source-box">' +
        '<div><strong>Target:</strong> <code>' + esc((step.target_fingerprint && step.target_fingerprint.css) || step.guide_id || 'button') + '</code></div>' +
        '<div style="margin-top:3px;"><strong>File:</strong> ' + esc(step.source_file || 'Unavailable') + (step.source_line ? ' :' + step.source_line : '') + '</div>' +
      '</div>' +
      sourceApproval;

    // Field change bindings
    ['title', 'description', 'route', 'action', 'advance'].forEach(field => {
      const el = byId('step-' + field);
      if (!el) return;
      el.addEventListener('input', () => {
        if (field === 'title' || field === 'description') {
          step.content = step.content || { en: {} };
          step.content.en = step.content.en || {};
          step.content.en[field] = el.value;
        } else if (field === 'route') {
          step.route_pattern = el.value;
        } else if (field === 'action') {
          step.action_type = el.value;
        } else if (field === 'advance') {
          step.advance_on = el.value;
        }
        setDirty();
        // Update live card text on the canvas behind the modal
        const nodeEl = byId('node-step-' + state.selected);
        if (nodeEl) {
          const titleEl = nodeEl.querySelector('.node-title');
          if (titleEl) titleEl.textContent = (step.content && step.content.en && step.content.en.title) || step.guide_id;
          const routeEl = nodeEl.querySelector('.node-route');
          if (routeEl) routeEl.textContent = step.route_pattern || '/';
        }
      });
    });

    const approval = byId('approve-step-source');
    if (approval) {
      approval.addEventListener('change', () => {
        step.source_edit.approved = approval.checked;
        setDirty();
      });
    }
  }

  function options(values, selected) {
    return values.map(v => '<option value="' + v + '" ' + (v === selected ? 'selected' : '') + '>' + v.replaceAll('_', ' ') + '</option>').join('');
  }

  /* Modal Action Listeners */
  byId('btn-back-to-flow').addEventListener('click', closeStepModal);
  byId('btn-step-done').addEventListener('click', closeStepModal);

  byId('step-modal').addEventListener('click', (e) => {
    if (e.target === byId('step-modal')) closeStepModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !byId('step-modal').classList.contains('hidden')) {
      closeStepModal();
    }
  });

  byId('btn-prev-step').addEventListener('click', () => {
    if (state.selected > 0) openStepModal(state.selected - 1);
  });
  byId('btn-next-step').addEventListener('click', () => {
    if (state.selected < state.steps.length - 1) openStepModal(state.selected + 1);
  });

  byId('btn-open-source').addEventListener('click', () => {
    if (state.selected >= 0 && state.steps[state.selected]) {
      const step = state.steps[state.selected];
      post('openSource', { filePath: step.source_file, line: step.source_line });
    }
  });

  byId('btn-delete-step').addEventListener('click', () => {
    if (state.selected >= 0 && state.steps[state.selected]) {
      state.steps.splice(state.selected, 1);
      state.selected = Math.min(state.selected, state.steps.length - 1);
      setDirty();
      renderCanvas();
      if (state.selected >= 0 && state.steps[state.selected]) {
        renderModalContent();
      } else {
        closeStepModal();
      }
    }
  });

  /* Draft & Publish Pipeline */
  function currentFlow() {
    return {
      featureId: state.flow && state.flow.featureId || null,
      baseVersionId: state.flow && state.flow.baseVersionId || null,
      slug: byId('flow-slug').value.trim() || 'untitled-flow',
      content: {
        en: {
          title: byId('flow-title').value.trim() || 'Untitled flow',
          description: state.flow && state.flow.content && state.flow.content.en && state.flow.content.en.description || ''
        }
      },
      example_queries: state.flow && state.flow.example_queries || [],
      requires_auth: Boolean(state.flow && state.flow.requires_auth),
      required_role: state.flow && state.flow.required_role || null,
      prerequisite_feature_slug: state.flow && state.flow.prerequisite_feature_slug || null,
      steps: state.steps
    };
  }

  function loadDraft(flow) {
    state.flow = flow || {};
    state.steps = Array.isArray(flow && flow.steps) ? flow.steps : [];
    state.selected = -1;
    state.savedFeatureIds = flow && flow.featureId ? [flow.featureId] : [];
    byId('flow-title').value = flow && flow.content && flow.content.en && flow.content.en.title || 'Untitled flow';
    byId('flow-slug').value = flow && flow.slug || 'untitled-flow';
    byId('flow-slug').disabled = Boolean(flow && flow.featureId);
    setDirty(false);
    renderCanvas();
    closeStepModal();
    switchTab('studio');
    requestAnimationFrame(fitToScreen);
  }

  function validateFlow(flow) {
    if (!flow || !flow.steps || !flow.steps.length) {
      return ['Cannot save or publish an empty flow. Please capture or add at least one step first.'];
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flow.slug || '')) {
      return ['Use a lowercase alphanumeric kebab-case slug (e.g. checkout-flow).'];
    }
    if (!flow.content || !flow.content.en || !flow.content.en.title || !flow.content.en.title.trim()) {
      return ['Please enter a title for this flow.'];
    }
    const ids = flow.steps.map(s => s.guide_id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return ['Step guide IDs must be unique across the flow.'];
    }
    for (let i = 0; i < flow.steps.length; i++) {
      const s = flow.steps[i];
      if (!s.route_pattern || !s.route_pattern.startsWith('/')) {
        return ['Step ' + (i + 1) + ' needs a route starting with / (e.g. /dashboard).'];
      }
      if (!s.content || !s.content.en || !s.content.en.title) {
        return ['Step ' + (i + 1) + ' needs a title.'];
      }
    }
    return [];
  }

  byId('flow-title').addEventListener('input', (e) => {
    if (!state.flow || !state.flow.featureId) {
      byId('flow-slug').value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    setDirty();
  });
  byId('flow-slug').addEventListener('input', () => setDirty());

  byId('new-flow').addEventListener('click', () => {
    loadDraft({
      slug: 'untitled-flow',
      content: { en: { title: 'Untitled flow', description: '' } },
      steps: []
    });
  });

  const btnToolbarAddStep = byId('btn-toolbar-add-step');
  if (btnToolbarAddStep) {
    btnToolbarAddStep.addEventListener('click', () => {
      insertStepAt(state.steps.length);
    });
  }

  byId('save-draft').addEventListener('click', () => {
    const flow = currentFlow();
    const errors = validateFlow(flow);
    if (errors.length) {
      showAlert(errors.join(' '));
      return;
    }
    showAlert('');
    byId('save-draft').disabled = true;
    byId('save-draft').innerHTML = '<span class="spinner"></span> Saving…';
    post('saveStudioDraft', { flow });
  });

  byId('publish-flow').addEventListener('click', () => {
    if (!state.steps.length) {
      showAlert('Cannot publish an empty flow. Please capture or add at least one step first.');
      return;
    }
    if (state.dirty) {
      showAlert('You have unsaved changes. Please click "Save draft" before publishing.');
      return;
    }
    if (!state.savedFeatureIds.length) {
      showAlert('Please save this flow draft before publishing.');
      return;
    }
    byId('publish-flow').disabled = true;
    byId('publish-flow').innerHTML = '<span class="spinner"></span> Publishing…';
    post('publishStudioDraft', { featureIds: state.savedFeatureIds });
  });

  /* Flows Tab (Dedicated Screen) */
  let flowsSearchQuery = '';

  function renderFlows() {
    const list = byId('flow-list');
    const statsEl = byId('flows-stats-badge');
    if (!list) return;

    const query = flowsSearchQuery.toLowerCase().trim();
    const filtered = (state.features || []).filter(feature => {
      if (!query) return true;
      const title = (feature.draft_version && feature.draft_version.content && feature.draft_version.content.en && feature.draft_version.content.en.title) ||
        (feature.published_version && feature.published_version.content && feature.published_version.content.en && feature.published_version.content.en.title) || feature.slug || '';
      return title.toLowerCase().includes(query) || (feature.slug || '').toLowerCase().includes(query);
    });

    if (statsEl) {
      const total = (state.features || []).length;
      statsEl.textContent = total + ' ' + (total === 1 ? 'flow' : 'flows') + (query ? ' (' + filtered.length + ' matching)' : '');
    }

    if (!filtered.length) {
      if (query) {
        list.innerHTML = '<div class="flows-empty">No flows matching "' + esc(flowsSearchQuery) + '".</div>';
      } else {
        list.innerHTML = '<div class="flows-empty">' +
          '<div style="font-size:14px; font-weight:500; color:var(--ink); margin-bottom:6px;">No flows in this project yet</div>' +
          '<p style="margin:0 0 16px 0;">Select code in your editor to add steps, or click below to start a flow.</p>' +
          '<button class="btn btn-primary btn-sm" id="btn-empty-new-flow" type="button">+ Create First Flow</button>' +
        '</div>';
        const emptyBtn = byId('btn-empty-new-flow');
        if (emptyBtn) {
          emptyBtn.addEventListener('click', () => {
            byId('new-flow').click();
          });
        }
      }
      return;
    }

    list.innerHTML = '';
    filtered.forEach(feature => {
      const title = (feature.draft_version && feature.draft_version.content && feature.draft_version.content.en && feature.draft_version.content.en.title) ||
        (feature.published_version && feature.published_version.content && feature.published_version.content.en && feature.published_version.content.en.title) || feature.slug;
      const isDraft = Boolean(feature.draft_version);
      const isPublished = Boolean(feature.published_version);
      const statusBadge = isDraft
        ? '<span class="flow-badge flow-badge-draft">Draft</span>'
        : (isPublished ? '<span class="flow-badge flow-badge-published">Published</span>' : '<span class="flow-badge flow-badge-empty">Empty</span>');
      const stepCount = Number(feature.step_count || 0);

      const card = document.createElement('div');
      card.className = 'flow-card';
      card.innerHTML =
        '<div class="flow-card-main">' +
          '<div class="flow-card-head">' +
            '<span class="flow-card-title">' + esc(title) + '</span>' +
            statusBadge +
          '</div>' +
          '<div class="flow-card-meta">' +
            '<span>' + esc(feature.slug) + '</span>' +
            '<span>·</span>' +
            '<span>' + stepCount + ' ' + (stepCount === 1 ? 'step' : 'steps') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="flow-card-actions">' +
          '<button class="btn btn-primary btn-sm btn-open-flow" type="button">Open in Studio</button>' +
        '</div>';

      card.querySelector('.btn-open-flow').addEventListener('click', () => {
        post('loadStudioFlow', { featureId: feature.id });
      });
      list.appendChild(card);
    });
  }

  const searchInput = byId('flows-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      flowsSearchQuery = e.target.value.trim();
      renderFlows();
    });
  }

  byId('refresh-flows').addEventListener('click', () => post('loadExistingFlows'));
  const btnFlowsNew = byId('btn-flows-new');
  if (btnFlowsNew) {
    btnFlowsNew.addEventListener('click', () => {
      byId('new-flow').click();
    });
  }

  /* Open Code Agent Chatbot */
  function appendMessage(role, text) {
    const log = byId('chat-log');
    if (!log) return;

    if (role === 'user') {
      const wrap = document.createElement('div');
      wrap.className = 'chat-bubble-wrap user';
      wrap.innerHTML = '<span class="chat-sender">You</span><div class="chat-bubble">' + esc(text) + '</div>';
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return;
    }

    if (role === 'assistant') {
      const wrap = document.createElement('div');
      wrap.className = 'chat-bubble-wrap assistant';
      const cleanText = text.replace(/^💬\s*/, '');
      wrap.innerHTML = '<span class="chat-sender">Open Code</span><div class="chat-bubble">' + formatChatContent(cleanText) + '</div>';
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return;
    }

    // Activity / System Logs
    if (text.startsWith('💬')) {
      appendMessage('assistant', text.substring(2).trim());
      return;
    }

    // Group tool calls & reasoning into collapsible details element
    let lastDetails = log.querySelector('.chat-activity-details:last-child');
    if (!lastDetails) {
      lastDetails = document.createElement('details');
      lastDetails.className = 'chat-activity-details';
      lastDetails.innerHTML = '<summary>Codebase scanning activity</summary><pre></pre>';
      log.appendChild(lastDetails);
    }
    const pre = lastDetails.querySelector('pre');
    if (pre) {
      pre.textContent += (pre.textContent ? '\\n' : '') + text;
    }
    log.scrollTop = log.scrollHeight;
  }

  function formatChatContent(str) {
    return esc(str)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>')
      .replace(/\\n/g, '<br/>');
  }

  // Starter chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (!prompt) return;
      byId('agent-prompt').value = prompt;
      byId('run-agent').click();
    });
  });

  // Enter to send in composer
  const agentTextarea = byId('agent-prompt');
  if (agentTextarea) {
    agentTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        byId('run-agent').click();
      }
    });
  }

  function updateAgentStatus(status, detail) {
    const dot = byId('agent-status-dot');
    const text = byId('agent-status-text');
    if (!dot || !text) return;
    if (status === 'running') {
      dot.className = 'chat-status-dot active';
      text.textContent = detail || 'Scanning…';
    } else if (status === 'spawning') {
      dot.className = 'chat-status-dot active';
      text.textContent = 'Spawning…';
    } else {
      dot.className = 'chat-status-dot';
      text.textContent = 'Ready';
    }
  }

  byId('run-agent').addEventListener('click', () => {
    const prompt = byId('agent-prompt').value.trim();
    if (!prompt || state.running) return;
    appendMessage('user', prompt);
    byId('agent-prompt').value = '';
    state.running = true;
    updateAgentStatus('running', 'Analyzing codebase…');
    byId('run-agent').classList.add('hidden');
    byId('stop-agent').classList.remove('hidden');
    post('runOpenCode', { prompt, currentFlow: currentFlow() });
  });
  byId('stop-agent').addEventListener('click', () => post('stopOpenCode'));

  function renderProposal() {
    const box = byId('proposal');
    const flow = state.proposal;
    if (!flow) {
      box.innerHTML =
        '<div class="proposal-empty">' +
          '<div class="proposal-empty-title">No Flow Proposal Yet</div>' +
          '<p class="proposal-empty-desc">Ask Open Code on the left to detect interactive routes and buttons. Once synthesized, the reviewable tour will appear here.</p>' +
        '</div>';
      return;
    }
    const title = (flow.content && flow.content.en && flow.content.en.title) || flow.slug;
    const steps = flow.steps || [];
    const sourceEdits = flow.source_edits || [];

    box.innerHTML =
      '<div class="proposal-card">' +
        '<div class="proposal-header">' +
          '<div>' +
            '<h2 class="proposal-title">' + esc(title) + '</h2>' +
            '<div class="proposal-slug">' + esc(flow.slug) + ' · ' + steps.length + ' ' + (steps.length === 1 ? 'step' : 'steps') + (flow.requires_auth ? ' · Requires auth' : '') + '</div>' +
          '</div>' +
          '<span class="proposal-badge">Proposal</span>' +
        '</div>' +
        '<div class="proposal-steps-list">' +
          steps.map((s, idx) => {
            const stepTitle = (s.content && s.content.en && s.content.en.title) || s.guide_id || ('Step ' + (idx + 1));
            const action = (s.action_type || 'click').toUpperCase();
            const actionClass = 'action-' + (s.action_type || 'click');
            return '<div class="proposal-step-row">' +
              '<div class="proposal-step-left">' +
                '<span class="proposal-step-badge">STEP ' + String(idx + 1).padStart(2, '0') + '</span>' +
                '<span class="node-action-badge ' + actionClass + '">' + esc(action) + '</span>' +
                '<span class="proposal-step-title">' + esc(stepTitle) + '</span>' +
              '</div>' +
              '<div class="proposal-step-right">' +
                '<span class="proposal-step-route">' + esc(s.route_pattern || '/') + '</span>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        (sourceEdits.length ? '<details class="code-review"><summary>Review ' + sourceEdits.length + ' source locator injection(s)</summary><pre>' + esc(JSON.stringify(sourceEdits.map(e => ({ file: e.file_path, line: e.line, element: e.element_text })), null, 2)) + '</pre></details>' : '') +
        '<div class="proposal-actions">' +
          '<button class="btn btn-primary btn-sm" id="apply-proposal" type="button">Apply to Studio Canvas</button>' +
          '<button class="btn btn-secondary btn-sm" id="reject-proposal" type="button">Reject</button>' +
        '</div>' +
      '</div>';

    byId('apply-proposal').addEventListener('click', () => {
      post('applyOpenCodeProposal', { flow, currentFeatureId: state.flow && state.flow.featureId || null });
    });
    byId('reject-proposal').addEventListener('click', () => {
      state.proposal = null;
      renderProposal();
    });
  }

  /* Host Message Dispatcher */
  window.addEventListener('message', (event) => {
    const msg = event.data || {};
    switch (msg.type) {
      case 'studioInit':
        state.project = msg.project;
        state.features = msg.features || [];
        state.provider = msg.provider || null;
        byId('project-name').textContent = (msg.project && msg.project.name) || 'Project';
        byId('workspace-name').textContent = (msg.workspace && msg.workspace.name) || 'GuideKit';
        renderFlows();
        if (msg.mode) switchTab(msg.mode);
        break;

      case 'loadDraft':
        loadDraft(msg.flow);
        break;

      case 'stepCaptured':
        state.steps.push(msg.step);
        setDirty();
        renderCanvas();
        openStepModal(state.steps.length - 1);
        break;

      case 'activeSelectionChange':
        break;

      case 'existingFlowsLoaded':
        state.features = msg.features || [];
        renderFlows();
        break;

      case 'draftSaved':
        state.savedFeatureIds = msg.featureIds || [];
        state.flow = Object.assign({}, currentFlow(), { featureId: state.savedFeatureIds[0] || (state.flow && state.flow.featureId) });
        setDirty(false);
        byId('save-draft').disabled = false;
        byId('save-draft').textContent = 'Save draft';
        appendMessage('assistant', 'Draft saved. Manifest publication is separate.');
        break;

      case 'publishSuccess':
        byId('publish-flow').disabled = false;
        byId('publish-flow').textContent = 'Publish flow';
        appendMessage('assistant', 'Published manifest v' + msg.version_number + '.');
        break;

      case 'agentLog':
        appendMessage('activity', msg.line);
        break;

      case 'agentStatus':
        updateAgentStatus(msg.status, msg.detail);
        if (msg.status === 'unspawned' || msg.status === 'idle') {
          state.running = false;
          byId('run-agent').classList.remove('hidden');
          byId('stop-agent').classList.add('hidden');
        }
        break;

      case 'flowDetected':
        state.proposal = msg.flow;
        renderProposal();
        appendMessage('assistant', 'Synthesized **' + (msg.flow.content && msg.flow.content.en && msg.flow.content.en.title || msg.flow.slug) + '** with ' + (msg.flow.steps ? msg.flow.steps.length : 0) + ' steps. Review the tour on the right or click **Apply to Studio Canvas** to open it on the visual canvas.');
        break;

      case 'error':
        byId('save-draft').disabled = false;
        byId('save-draft').textContent = 'Save draft';
        byId('publish-flow').disabled = false;
        byId('publish-flow').textContent = 'Publish flow';
        state.running = false;
        updateAgentStatus('idle');
        byId('run-agent').classList.remove('hidden');
        byId('stop-agent').classList.add('hidden');
        showAlert(msg.message || 'Something went wrong.');
        break;
    }
  });

  window.addEventListener('resize', () => {
    drawSvgConnectors();
  });

  renderCanvas();
  post('studioReady');
</script>
</body>
</html>`;
}