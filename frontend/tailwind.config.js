/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        slate: {
          850: "#1e293b",
          950: "#020617",
        },
        accent: {
          cyan: "#06b6d4",
          purple: "#8b5cf6",
          emerald: "#10b981",
          rose: "#f43f5e",
        },
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(6, 182, 212, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(6, 182, 212, 0.8)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        glow: "glow 2s ease-in-out infinite alternate",
        "slide-in": "slideIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
