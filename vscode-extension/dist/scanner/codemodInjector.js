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
exports.previewGuideIdEdits = previewGuideIdEdits;
exports.injectGuideIds = injectGuideIds;
exports.injectGuideIdsAcrossWorkspace = injectGuideIdsAcrossWorkspace;
const fs = __importStar(require("fs"));
/**
 * Build deterministic, non-mutating guide-id insertions for an agent proposal.
 * The extension applies these only after the user approves the proposal.
 */
function previewGuideIdEdits(routes, steps) {
    const previews = [];
    for (const step of steps) {
        if (!step.guide_id)
            continue;
        const route = routes.find((item) => item.routePattern === step.route_pattern);
        if (!route || !fs.existsSync(route.filePath))
            continue;
        const code = fs.readFileSync(route.filePath, 'utf-8');
        if (code.includes(`data-guide-id="${step.guide_id}"`))
            continue;
        const attrs = step.target_fingerprint?.attrs || {};
        const candidates = [];
        if (attrs.id) {
            candidates.push(new RegExp(`<(?:button|input|select|textarea|a|form)\\b[^>]*?\\bid=["']${escapeRegex(attrs.id)}["'][^>]*?>`, 'i'));
        }
        if (attrs['data-testid']) {
            candidates.push(new RegExp(`<(?:button|input|select|textarea|a|form)\\b[^>]*?\\bdata-testid=["']${escapeRegex(attrs['data-testid'])}["'][^>]*?>`, 'i'));
        }
        const match = candidates.map((pattern) => pattern.exec(code)).find(Boolean);
        if (!match || match.index === undefined)
            continue;
        const before = match[0];
        const after = before.endsWith('/>')
            ? `${before.slice(0, -2).trimEnd()} data-guide-id="${step.guide_id}"/>`
            : `${before.slice(0, -1).trimEnd()} data-guide-id="${step.guide_id}">`;
        previews.push({
            file_path: route.filePath,
            start_offset: match.index,
            end_offset: match.index + before.length,
            before,
            after,
        });
    }
    return previews;
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Injects `data-guide-id="<guide_id>"` attributes into matching interactive tags in the source file.
 * Idempotent: skips tags that already contain `data-guide-id`.
 */
function injectGuideIds(filePath, stepsForRoute) {
    if (!fs.existsSync(filePath)) {
        return { filePath, injectedCount: 0, modified: false };
    }
    let code = fs.readFileSync(filePath, 'utf-8');
    let injectedCount = 0;
    for (const step of stepsForRoute) {
        const guideId = step.guide_id;
        if (!guideId)
            continue;
        // Check if guide_id is already injected in this file
        if (code.includes(`data-guide-id="${guideId}"`)) {
            continue;
        }
        const fp = step.target_fingerprint;
        const targetId = fp.attrs?.['id'];
        const targetTestId = fp.attrs?.['data-testid'];
        let replaced = false;
        // 1. Try matching by id attribute
        if (targetId) {
            const idPattern = new RegExp(`(<(?:button|input|select|textarea|a|form)\\b[^>]*?\\bid=["']${targetId}["'][^>]*?)(\\/?>)`, 'i');
            if (idPattern.test(code)) {
                code = code.replace(idPattern, (match, prefix, suffix) => {
                    if (prefix.includes('data-guide-id='))
                        return match;
                    injectedCount++;
                    replaced = true;
                    return `${prefix} data-guide-id="${guideId}"${suffix}`;
                });
            }
        }
        // 2. Try matching by data-testid attribute if not yet replaced
        if (!replaced && targetTestId) {
            const testIdPattern = new RegExp(`(<(?:button|input|select|textarea|a|form)\\b[^>]*?\\bdata-testid=["']${targetTestId}["'][^>]*?)(\\/?>)`, 'i');
            if (testIdPattern.test(code)) {
                code = code.replace(testIdPattern, (match, prefix, suffix) => {
                    if (prefix.includes('data-guide-id='))
                        return match;
                    injectedCount++;
                    replaced = true;
                    return `${prefix} data-guide-id="${guideId}"${suffix}`;
                });
            }
        }
    }
    if (injectedCount > 0) {
        fs.writeFileSync(filePath, code, 'utf-8');
        return { filePath, injectedCount, modified: true };
    }
    return { filePath, injectedCount: 0, modified: false };
}
/**
 * Runs codemod across all scanned routes that have matching workflow steps.
 */
function injectGuideIdsAcrossWorkspace(routes, steps) {
    const results = [];
    for (const r of routes) {
        const matchingSteps = steps.filter((s) => s.route_pattern === r.routePattern);
        if (matchingSteps.length > 0) {
            results.push(injectGuideIds(r.filePath, matchingSteps));
        }
    }
    return results;
}
//# sourceMappingURL=codemodInjector.js.map