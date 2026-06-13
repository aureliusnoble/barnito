/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Refined dark, faintly green-tinted neutral ramp for surfaces + text.
        pitch: {
          50: "#f2f7f5",
          100: "#e6eeea",
          200: "#cdd9d3",
          300: "#a7b8b0",
          400: "#7c8e86",
          500: "#5a6a63",
          600: "#3f4d47",
          700: "#2a3531",
          800: "#1a2320",
          900: "#111815",
          950: "#0a0f0d",
        },
        // Emerald — the single vivid accent (active states, highlights, CTAs).
        accent: {
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Warm secondary accent ("spicy", airhorn, alerts).
        spice: {
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
        },
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(16,185,129,0.18), 0 8px 30px -12px rgba(16,185,129,0.25)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 30px -18px rgba(0,0,0,0.7)",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-8deg) scale(1)" },
          "50%": { transform: "rotate(8deg) scale(1.12)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        wiggle: "wiggle 0.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-up": "slide-up 0.3s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
        "bar-grow": "bar-grow 0.6s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
