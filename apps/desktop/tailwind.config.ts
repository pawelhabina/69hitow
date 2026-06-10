import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./electron/**/*.ts"],
  theme: {
    extend: {
      colors: {
        ink: "#040817",
        cyan: "#22d3ee",
        violet: "#8b5cf6"
      },
      boxShadow: {
        glow: "0 0 44px rgba(34, 211, 238, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
