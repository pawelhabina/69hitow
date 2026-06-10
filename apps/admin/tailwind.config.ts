import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050914",
        panel: "rgba(12, 21, 38, 0.74)",
        cyan: "#22d3ee",
        violet: "#8b5cf6"
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;
