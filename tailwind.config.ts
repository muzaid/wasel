import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#ecfdf5", 100: "#d1fae5", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 900: "#064e3b" },
        ink: { 900: "#0b1220", 800: "#111a2e", 700: "#1c2740", 500: "#64748b", 300: "#cbd5e1", 100: "#f1f5f9" },
        accent: "#f59e0b",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      keyframes: {
        ping2: { "0%": { transform: "scale(.4)", opacity: ".9" }, "100%": { transform: "scale(2.6)", opacity: "0" } },
        pingc: { "0%": { transform: "translate(-50%,-50%) scale(.4)", opacity: ".9" }, "100%": { transform: "translate(-50%,-50%) scale(2.2)", opacity: "0" } },
        slideup: { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
      },
      animation: { ping2: "ping2 2.4s cubic-bezier(0,0,.2,1) infinite", pingc: "pingc 2.4s cubic-bezier(0,0,.2,1) infinite", slideup: "slideup .35s ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
