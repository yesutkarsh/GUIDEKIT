"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferRouteFromFilePath = inferRouteFromFilePath;
exports.parseAttributes = parseAttributes;
exports.expandTagSelection = expandTagSelection;
exports.injectGuideIdIntoOpeningTag = injectGuideIdIntoOpeningTag;
exports.buildSelectorFromAttrs = buildSelectorFromAttrs;
exports.createStepFromTagInfo = createStepFromTagInfo;
exports.captureStepFromActiveEditor = captureStepFromActiveEditor;
const path = __importStar(require("path"));
// Lazy-load vscode only if running inside VS Code extension runtime
function getVsCode() {
    try {
        return require("vscode");
    }
    catch {
        return null;
    }
}
/**
 * Infer route pattern from a file path.
 * Checks Next.js App Router, Pages Router, and SvelteKit conventions.
 */
function inferRouteFromFilePath(filePath, workspaceRoot) {
    const normalized = filePath.replace(/\\/g, "/");
    // 1. SvelteKit: src/routes/.../+page.(svelte|ts|js)
    const svelteMatch = normalized.match(/src\/routes\/(.+?)\/\+page\.(svelte|ts|js)/);
    if (svelteMatch) {
        return { route: `/${svelteMatch[1]}`, isAmbiguous: false };
    }
    if (normalized.includes("src/routes/+page.svelte")) {
        return { route: "/", isAmbiguous: false };
    }
    // 2. Next.js App Router: (app|src/app)/.../page.(tsx|jsx|js|ts)
    const appMatch = normalized.match(/(?:src\/)?app\/(.+?)\/page\.(tsx|jsx|js|ts)/);
    if (appMatch) {
        // Strip route groups like (dashboard), (auth), etc.
        let route = "/" + appMatch[1].split("/").filter((seg) => !seg.startsWith("(") || !seg.endsWith(")")).join("/");
        route = route.replace(/\/+/g, "/");
        return { route: route === "" ? "/" : route, isAmbiguous: false };
    }
    if (normalized.match(/(?:src\/)?app\/page\.(tsx|jsx|js|ts)/)) {
        return { route: "/", isAmbiguous: false };
    }
    // 3. Next.js Pages Router: (pages|src/pages)/...
    const pagesMatch = normalized.match(/(?:src\/)?pages\/(.+?)\.(tsx|jsx|js|ts)/);
    if (pagesMatch) {
        let route = `/${pagesMatch[1]}`;
        if (route.endsWith("/index") || route === "/index") {
            route = route.replace(/\/index$/, "") || "/";
        }
        return { route, isAmbiguous: false };
    }
    // If in components, shared, lib or non-standard directory, it is ambiguous
    const fileName = path.basename(filePath, path.extname(filePath));
    return {
        route: `/${fileName.toLowerCase()}`,
        isAmbiguous: true,
    };
}
/**
 * Parse attributes from an HTML/JSX opening tag string
 */
function parseAttributes(openingTag) {
    const attrs = {};
    // Match key="value", key='value', key={value}, or boolean key
    const attrRegex = /([a-zA-Z0-9_\-:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|{([^}]*)}|([^\s>]+)))?/g;
    // Skip the tag name itself (<button ...)
    const firstSpace = openingTag.indexOf(" ");
    if (firstSpace === -1)
        return attrs;
    const tagContent = openingTag.substring(firstSpace, openingTag.length - (openingTag.endsWith("/>") ? 2 : 1));
    let match;
    while ((match = attrRegex.exec(tagContent)) !== null) {
        const key = match[1];
        if (key.startsWith("<") || key === "/" || key === ">")
            continue;
        const val = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "true";
        attrs[key] = val;
    }
    return attrs;
}
/**
 * Helper to check if text at index `i` is the start of an opening JSX/HTML tag
 */
function isOpeningTagAt(text, i) {
    if (text[i] !== "<")
        return { isOpening: false };
    if (i > 0 && text[i - 1] === "\\")
        return { isOpening: false };
    if (text[i + 1] === "/" || text[i + 1] === "!" || text[i + 1] === "?")
        return { isOpening: false };
    // Must be followed by a valid tag name character (letter or _)
    const rest = text.substring(i + 1);
    const tagMatch = rest.match(/^([a-zA-Z][a-zA-Z0-9_\-:]*)/);
    if (!tagMatch)
        return { isOpening: false };
    const tag = tagMatch[1];
    // Disallow common TypeScript generic types
    const tsGenerics = new Set(["Promise", "Array", "Record", "Map", "Set", "Partial", "Omit", "Pick", "Readonly", "Tuple"]);
    if (tsGenerics.has(tag))
        return { isOpening: false };
    // Verify not preceded by alphanumeric (like foo<T> or Map<K>)
    if (i > 0 && /[a-zA-Z0-9_$]/.test(text[i - 1]))
        return { isOpening: false };
    return { isOpening: true, tagName: tag };
}
/**
 * Expand selection in documentText outwards to find the full element tag
 */
function expandTagSelection(documentText, selectionStart, selectionEnd) {
    // If selection is inside an opening tag or an element, find the nearest valid '<' preceding selectionStart
    let tagStart = -1;
    for (let i = Math.min(selectionStart, documentText.length - 1); i >= 0; i--) {
        const check = isOpeningTagAt(documentText, i);
        if (check.isOpening) {
            tagStart = i;
            break;
        }
    }
    if (tagStart === -1) {
        // If not found backwards, search forwards within a reasonable window (e.g. 500 chars)
        for (let i = selectionStart; i < Math.min(selectionStart + 500, documentText.length); i++) {
            const check = isOpeningTagAt(documentText, i);
            if (check.isOpening) {
                tagStart = i;
                break;
            }
        }
    }
    if (tagStart === -1) {
        // If user has highlighted text, check if the current line has an opening tag
        const lineStart = documentText.lastIndexOf("\n", selectionStart) + 1;
        const lineEnd = documentText.indexOf("\n", selectionEnd);
        const effectiveEnd = lineEnd === -1 ? documentText.length : lineEnd;
        for (let i = lineStart; i < effectiveEnd; i++) {
            const check = isOpeningTagAt(documentText, i);
            if (check.isOpening) {
                tagStart = i;
                break;
            }
        }
    }
    if (tagStart === -1)
        return null;
    // Find the end of the opening tag '>', accounting for quotes and JSX expressions
    let openingTagEnd = -1;
    let inQuotes = null;
    let braceDepth = 0;
    for (let i = tagStart; i < documentText.length; i++) {
        const ch = documentText[i];
        if (!inQuotes && (ch === '"' || ch === "'" || ch === "`")) {
            inQuotes = ch;
        }
        else if (inQuotes && ch === inQuotes) {
            inQuotes = null;
        }
        else if (!inQuotes && ch === "{") {
            braceDepth++;
        }
        else if (!inQuotes && ch === "}") {
            if (braceDepth > 0)
                braceDepth--;
        }
        else if (!inQuotes && braceDepth === 0 && ch === ">") {
            openingTagEnd = i + 1;
            break;
        }
    }
    if (openingTagEnd === -1)
        return null;
    const openingTagText = documentText.substring(tagStart, openingTagEnd);
    // Extract tag name (e.g. button, input, div, MyComponent)
    const tagNameMatch = openingTagText.match(/^<([a-zA-Z0-9_\-:]+)/);
    if (!tagNameMatch)
        return null;
    const tagName = tagNameMatch[1];
    const attrs = parseAttributes(openingTagText);
    const existingGuideId = attrs["data-guide-id"];
    // Check if self-closing
    const isSelfClosing = openingTagText.endsWith("/>") || ["input", "img", "br", "hr", "meta", "link"].includes(tagName.toLowerCase());
    let fullTagText = openingTagText;
    let tagEnd = openingTagEnd;
    let innerText = "";
    if (!isSelfClosing) {
        // Find matching closing tag </tagName>
        const closingTag = `</${tagName}>`;
        const closingIdx = documentText.indexOf(closingTag, openingTagEnd);
        if (closingIdx !== -1) {
            tagEnd = closingIdx + closingTag.length;
            fullTagText = documentText.substring(tagStart, tagEnd);
            innerText = documentText.substring(openingTagEnd, closingIdx).replace(/<[^>]*>/g, " ").trim();
        }
    }
    return {
        tag: tagName,
        openingTagText,
        openingTagStart: tagStart,
        openingTagEnd,
        fullTagText,
        tagStart,
        tagEnd,
        innerText,
        attributes: attrs,
        existingGuideId,
    };
}
/**
 * Injects `data-guide-id="<guideId>"` into the opening tag string if not present.
 */
function injectGuideIdIntoOpeningTag(openingTagText, guideId) {
    if (openingTagText.includes("data-guide-id")) {
        return openingTagText;
    }
    if (openingTagText.endsWith("/>")) {
        return openingTagText.substring(0, openingTagText.length - 2).trimEnd() + ` data-guide-id="${guideId}"/>`;
    }
    if (openingTagText.endsWith(">")) {
        return openingTagText.substring(0, openingTagText.length - 1).trimEnd() + ` data-guide-id="${guideId}">`;
    }
    return openingTagText;
}
/**
 * Builds CSS selector from tag and attributes
 */
function buildSelectorFromAttrs(tag, attrs) {
    if (attrs["data-guide-id"]) {
        return `[data-guide-id="${attrs["data-guide-id"]}"]`;
    }
    if (attrs["id"]) {
        return `#${attrs["id"]}`;
    }
    if (attrs["data-testid"]) {
        return `[data-testid="${attrs["data-testid"]}"]`;
    }
    if (attrs["name"]) {
        return `${tag}[name="${attrs["name"]}"]`;
    }
    if (attrs["class"] || attrs["className"]) {
        const cls = (attrs["class"] || attrs["className"]).split(/\s+/)[0];
        if (cls)
            return `${tag}.${cls}`;
    }
    return tag;
}
/**
 * Builds ExtractedStep object from parsed tag info
 */
function createStepFromTagInfo(tagInfo, filePath, flowSlug, stepOrder, routeOverride) {
    const tagLower = tagInfo.tag.toLowerCase();
    // Action type inference
    let actionType = "click";
    let advanceOn = "click";
    if (tagLower === "input" || tagLower === "textarea") {
        actionType = "input";
        advanceOn = "input_valid";
    }
    else if (tagLower === "select") {
        actionType = "select";
        advanceOn = "input_valid";
    }
    else if (tagLower === "a" || (tagInfo.attributes["href"] && tagLower !== "button")) {
        actionType = "navigate";
        advanceOn = "route_change";
    }
    // Guide ID
    const guideId = tagInfo.existingGuideId || `${flowSlug}-step-${stepOrder}`;
    // Route pattern
    const routeInfo = inferRouteFromFilePath(filePath);
    const routePattern = routeOverride || routeInfo.route;
    // Title and description heuristics
    const rawText = tagInfo.innerText || tagInfo.attributes["placeholder"] || tagInfo.attributes["aria-label"] || tagInfo.attributes["name"] || tagInfo.tag;
    const label = rawText.replace(/\s+/g, " ").trim();
    let title = `Interact with ${label}`;
    let desc = `Click ${label} to continue.`;
    if (actionType === "input") {
        title = `Enter ${label || "value"}`;
        desc = `Type the required details in this field.`;
    }
    else if (actionType === "select") {
        title = `Select ${label || "an option"}`;
        desc = `Choose your preferred option from the list.`;
    }
    else if (actionType === "navigate") {
        title = `Navigate to ${label || "next section"}`;
        desc = `Click to navigate to ${tagInfo.attributes["href"] || "page"}.`;
    }
    // Build target fingerprint
    const attrsWithGuideId = {
        ...tagInfo.attributes,
        "data-guide-id": guideId,
    };
    const css = buildSelectorFromAttrs(tagLower, attrsWithGuideId);
    return {
        step_order: stepOrder,
        guide_id: guideId,
        route_pattern: routePattern,
        action_type: actionType,
        advance_on: advanceOn,
        content: {
            en: {
                title,
                description: desc,
            },
        },
        target_fingerprint: {
            tag: tagLower,
            role: tagLower === "button" ? "button" : tagLower === "a" ? "link" : undefined,
            text: tagInfo.innerText || undefined,
            css,
            guide_id: guideId,
            attrs: attrsWithGuideId,
        },
        is_optional: false,
        wait_timeout_ms: 5000,
        source_file: filePath,
        route_needs_confirmation: routeInfo.isAmbiguous && !routeOverride,
    };
}
/**
 * Interactive helper for VS Code: extracts step from active editor and optionally injects data-guide-id
 */
async function captureStepFromActiveEditor(editor, flowSlug, stepOrder, options = { autoInjectGuideId: true }) {
    const vs = getVsCode();
    const document = editor.document;
    const selection = editor.selection;
    const documentText = document.getText();
    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    let tagInfo = expandTagSelection(documentText, selectionStart, selectionEnd);
    if (!tagInfo) {
        // If not found directly, check if the user selected text or a custom element
        const selectedSnippet = documentText.substring(selectionStart, selectionEnd).trim();
        if (selectedSnippet) {
            const cleaned = selectedSnippet.replace(/["'<>]/g, "").trim();
            tagInfo = {
                tag: "element",
                openingTagText: selectedSnippet,
                openingTagStart: selectionStart,
                openingTagEnd: selectionEnd,
                fullTagText: selectedSnippet,
                tagStart: selectionStart,
                tagEnd: selectionEnd,
                innerText: cleaned || "element",
                attributes: {},
            };
        }
        else {
            vs?.window?.showWarningMessage("GuideKit: Place cursor on or select an interactive element (button, link, input) to capture as a step.");
            return null;
        }
    }
    const filePath = document.uri.fsPath;
    const routeInfo = inferRouteFromFilePath(filePath);
    let routePattern = routeInfo.route;
    if (routeInfo.isAmbiguous && vs?.window?.showInputBox) {
        const userInput = await vs.window.showInputBox({
            title: "GuideKit: Confirm Route Pattern",
            prompt: `Inferred route for ${path.basename(filePath)} seems ambiguous. Enter route pattern (e.g. /dashboard, /book, /):`,
            value: routeInfo.route,
        });
        if (userInput) {
            routePattern = userInput.trim();
        }
    }
    const step = createStepFromTagInfo(tagInfo, filePath, flowSlug, stepOrder, routePattern);
    step.source_line = document.positionAt(tagInfo.openingTagStart).line + 1;
    if (!tagInfo.existingGuideId) {
        const updatedOpeningTag = injectGuideIdIntoOpeningTag(tagInfo.openingTagText, step.guide_id);
        if (updatedOpeningTag !== tagInfo.openingTagText) {
            step.source_edit = {
                file_path: filePath,
                start_offset: tagInfo.openingTagStart,
                end_offset: tagInfo.openingTagEnd,
                before: tagInfo.openingTagText,
                after: updatedOpeningTag,
                document_version: document.version,
            };
        }
    }
    // Auto-inject data-guide-id into source code if not already present
    if (options.autoInjectGuideId && !tagInfo.existingGuideId && vs) {
        const updatedOpeningTag = injectGuideIdIntoOpeningTag(tagInfo.openingTagText, step.guide_id);
        if (updatedOpeningTag !== tagInfo.openingTagText) {
            const startPos = document.positionAt(tagInfo.openingTagStart);
            const endPos = document.positionAt(tagInfo.openingTagEnd);
            const range = new vs.Range(startPos, endPos);
            await editor.edit((editBuilder) => {
                editBuilder.replace(range, updatedOpeningTag);
            });
        }
    }
    return step;
}
//# sourceMappingURL=selectionExtractor.js.map