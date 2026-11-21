import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const publicApiUrl =
  process.env.GUIDEKIT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:8000/api/v1";

export default defineConfig({
  plugins: [tailwindcss()],
  define: {
    __GUIDEKIT_DEFAULT_API_URL__: JSON.stringify(publicApiUrl.replace(/\/+$/, "")),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "GuideKit",
      formats: ["iife", "es"],
      fileName: (format) => (format === "iife" ? "guidekit-sdk.iife.js" : "guidekit-sdk.es.js"),
    },
    rollupOptions: {
      output: {
        extend: true,
        exports: "named",
        globals: {},
      },
    },
    minify: true,
    sourcemap: false,
  },
});

