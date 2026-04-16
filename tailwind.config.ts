import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0F14",
        shell: "#F5F1EA",
        bronze: "#A98455",
        sand: "#D8C4AA",
        fog: "#EAE4DB"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      boxShadow: {
        panel: "0 24px 80px rgba(10, 15, 20, 0.12)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(169, 132, 85, 0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(26, 45, 66, 0.18), transparent 38%)"
      }
    }
  },
  plugins: []
};

export default config;
