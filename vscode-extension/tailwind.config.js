/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/webview/sidebarHtml.ts", "./src/webview/studioHtml.ts"],
  theme: {
    extend: {
      colors: {
        guidekit: {
          canvas: "#0b0e13",
          surface: "#171c25",
          subtle: "#131820",
          hover: "#1b222d",
          ink: "#f1f4f9",
          muted: "#b8c0ce",
          faint: "#8d97a8",
          action: "#182d50",
          "action-hover": "#203d67",
          focus: "#52a9ff",
          danger: "#f87171",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      keyframes: {
        "auth-enter": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "success-in": {
          "0%": { opacity: "0", transform: "scale(.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "auth-enter": "auth-enter 280ms ease-out both",
        "success-in": "success-in 220ms ease-out both",
      },
    },
  },
  plugins: [],
};
