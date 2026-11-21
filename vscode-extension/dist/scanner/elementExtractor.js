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
exports.computeCssSelector = computeCssSelector;
exports.inferRole = inferRole;
exports.extractElements = extractElements;
const fs = __importStar(require("fs"));
/**
 * Extracts attribute value from an HTML/JSX/Svelte opening tag.
 */
function extractAttr(tag, attrName) {
    // Support attr="value", attr='value', attr={value}
    const regex = new RegExp(`${attrName}=(?:["']([^"']*)["']|{([^}]*)})`, 'i');
    const match = tag.match(regex);
    if (match) {
        return (match[1] || match[2] || '').trim();
    }
    return undefined;
}
/**
 * Computes a resilient, standard CSS selector for an element.
 */
function computeCssSelector(el) {
    if (el.dataGuideId) {
        return `[data-guide-id="${el.dataGuideId}"]`;
    }
    if (el.dataTestId) {
        return `[data-testid="${el.dataTestId}"]`;
    }
    if (el.id) {
        return `#${el.id}`;
    }
    if (el.name) {
        return `${el.tag}[name="${el.name}"]`;
    }
    if (el.classes && el.classes.length > 0) {
        return `${el.tag}.${el.classes.slice(0, 2).join('.')}`;
    }
    return el.tag || 'button';
}
/**
 * Determines role for target_fingerprint based on tag and type.
 */
function inferRole(tag, type) {
    if (tag === 'button' || (tag === 'input' && (type === 'submit' || type === 'button')))
        return 'button';
    if (tag === 'a')
        return 'link';
    if (tag === 'input' || tag === 'textarea')
        return 'textbox';
    if (tag === 'select')
        return 'combobox';
    if (tag === 'form')
        return 'form';
    return 'button';
}
/**
 * Parses a file's content and extracts interactive elements.
 */
function extractElements(filePath, content) {
    const code = content !== undefined ? content : fs.readFileSync(filePath, 'utf-8');
    const elements = [];
    // Regex matching opening tags for interactive elements: button, input, select, a, form
    // e.g. <button ...> or <input .../>
    const tagRegex = /<(button|input|select|textarea|a|form)\b([^>]*?)(\/?>)/gi;
    const lines = code.split('\n');
    let match;
    while ((match = tagRegex.exec(code)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const attrString = match[2];
        // Calculate line number
        const offset = match.index;
        const line = code.slice(0, offset).split('\n').length;
        const id = extractAttr(attrString, 'id');
        const classAttr = extractAttr(attrString, 'class') || extractAttr(attrString, 'className');
        const classes = classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
        const type = extractAttr(attrString, 'type');
        const name = extractAttr(attrString, 'name');
        const placeholder = extractAttr(attrString, 'placeholder');
        const ariaLabel = extractAttr(attrString, 'aria-label');
        const dataTestId = extractAttr(attrString, 'data-testid');
        const dataGuideId = extractAttr(attrString, 'data-guide-id');
        // Find inner text if not self-closing and has closing tag nearby
        let innerText;
        if (tagName === 'button' || tagName === 'a' || tagName === 'label') {
            const closeTagIndex = code.indexOf(`</${tagName}>`, match.index);
            if (closeTagIndex !== -1 && closeTagIndex - match.index < 400) {
                const between = code.slice(match.index + fullTag.length, closeTagIndex);
                // Strip nested HTML tags
                const stripped = between.replace(/<[^>]+>/g, '').trim();
                if (stripped) {
                    innerText = stripped.replace(/\s+/g, ' ');
                }
            }
        }
        const cssSelector = computeCssSelector({
            tag: tagName,
            id,
            classes,
            name,
            dataTestId,
            dataGuideId,
        });
        const role = inferRole(tagName, type);
        elements.push({
            tag: tagName,
            id,
            classes,
            type,
            name,
            placeholder,
            ariaLabel,
            dataTestId,
            dataGuideId,
            innerText,
            cssSelector,
            role,
            line,
            rawOpeningTag: fullTag,
        });
    }
    return elements;
}
//# sourceMappingURL=elementExtractor.js.map