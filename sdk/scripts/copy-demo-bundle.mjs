import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(sdkRoot, "dist/guidekit-sdk.iife.js");
const destination = resolve(sdkRoot, "../frontend/public/sdk/guidekit-sdk.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Copied SDK demo bundle to ${destination}`);
