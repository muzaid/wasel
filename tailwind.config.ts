import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#E3F5EE", 100: "#C9EBDD", 200: "#A4DCC6", 300: "#6FC6A4", 400: "#3FAF85", 500: "#159A6C", 600: "#0B7A57", 700: "#08583F", 900: "#05392A" },
        ink: { 900: "#17262E", 800: "#22343D", 700: "#33464F", 500: "#5A6B73", 300: "#D5DEDA", 100: "#F1F4F3" },
        accent: "#FFC94D",
        sun: { 50: "#FFF4D6", 400: "#FFC94D", 700: "#8A5A00" },
        sky2: { 50: "#DCEEFF", 700: "#1F5A99" },
        peach: { 50: "#FDE7E1", 500: "#F0745A" },
        mint: "#F6FAF8",
        // warm, slightly green greys (the friendly redesign) instead of Tailwind's blue-ish slate
        slate: { 50: "#F6FAF8", 100: "#EEF3F1", 200: "#E1EAE6", 300: "#C9D5D0", 400: "#8A9AA1", 500: "#5A6B73", 600: "#46575F", 700: "#33464F", 800: "#22343D", 900: "#17262E" },
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
