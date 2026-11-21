import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function runWidgetTests() {
  console.log("\nGuideKit widget UI tests");
  const bundle = await readFile(new URL("../dist/guidekit-sdk.iife.js", import.meta.url), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3000/demo",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });

  dom.window.eval(bundle);

  let soundStarts = 0;
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {
          soundStarts += 1;
        },
        stop() {},
        addEventListener(_name: string, callback: () => void) {
          callback();
        },
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  (dom.window as any).AudioContext = FakeAudioContext;

  const widget = dom.window.document.createElement("guidekit-widget") as HTMLElement & {
    open: () => void;
    close: () => void;
    setActiveTourProgress: (title: string | null) => void;
    setOptions: (options: Record<string, unknown>) => void;
  };
  dom.window.document.body.appendChild(widget);

  const root = widget.shadowRoot;
  assert(root, "widget renders inside Shadow DOM");
  assert(root?.querySelector('#gk-launcher[aria-label="Ask Guide"]'), "launcher exposes the concise default label");
  assert(root?.querySelector("#gk-launcher svg"), "launcher uses a chatbot glyph instead of a search glyph");
  assert(root?.querySelector(".gk-root")?.classList.contains("justify-center"), "launcher defaults to bottom-center alignment");

  widget.open();
  assert(root?.querySelector('[role="dialog"]'), "launcher opens an accessible guide dialog");
  assert(root?.querySelector(".chat-panel")?.classList.contains("gk-panel-opening"), "dialog uses the smooth opening transition");
  assert(root?.querySelector('input[type="text"][enterkeyhint="send"]'), "dialog exposes a message composer");
  assert(root?.querySelector('button[aria-label="Send message"]'), "composer exposes a named send action");
  assert(root?.querySelector('button[aria-label="Minimize assistant"]'), "header exposes an explicit minimize control");
  assert(root?.querySelectorAll(".icon-btn").length === 1, "default header keeps only the essential minimize control");
  (root?.querySelector('button[aria-label="Minimize assistant"]') as HTMLButtonElement | null)?.click();
  assert(!root?.querySelector('[role="dialog"]'), "minimize control collapses the assistant without removing its launcher");

  widget.open();
  widget.setActiveTourProgress("Book a ride");
  assert(root?.querySelector("#gk-stop-tour"), "active tours expose a visible stop action in the open assistant");
  (root?.querySelector("#gk-stop-tour") as HTMLButtonElement | null)?.click();
  assert(!root?.querySelector("#gk-stop-tour"), "stop action clears the active tour state");
  assert(root?.textContent?.includes("Tour stopped."), "stopping a tour confirms the outcome in the conversation");

  widget.setActiveTourProgress("Book a ride");
  widget.close();
  assert(root?.querySelector("#gk-stop-tour-compact"), "active tours keep a stop action available when minimized");
  (root?.querySelector("#gk-stop-tour-compact") as HTMLButtonElement | null)?.click();
  assert(!root?.querySelector("#gk-stop-tour-compact"), "minimized stop action also clears the active tour state");

  widget.setOptions({
    position: "bottom-right",
    panelWidth: 480,
    theme: { accent: "#38bdf8" },
  });
  assert(root?.querySelector(".gk-root")?.classList.contains("justify-end"), "position can be changed after mount");
  assert(widget.style.getPropertyValue("--gk-panel-width") === "480px", "panel width is exposed through a safe theme token");
  assert(widget.style.getPropertyValue("--gk-accent") === "#38bdf8", "accent color is customizable");

  widget.open();
  const input = root?.querySelector<HTMLInputElement>("#gk-input");
  input!.value = "How do I book?";
  input?.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  root?.querySelector("#gk-search-form")?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert(soundStarts === 1, "sending a message plays one restrained audio cue");
  await Promise.resolve();
  await Promise.resolve();

  widget.setOptions({ soundEnabled: false });
  const silentInput = root?.querySelector<HTMLInputElement>("#gk-input");
  silentInput!.value = "Stay quiet";
  silentInput?.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  root?.querySelector("#gk-search-form")?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert(soundStarts === 1, "audio feedback can be disabled through widget options");

  console.log("✓ Widget UI tests passed");
}

runWidgetTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
