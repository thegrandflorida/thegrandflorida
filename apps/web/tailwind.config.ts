import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        score: {
          exceptional: "#15803d", // green-700
          strong: "#22c55e",      // green-500
          solid: "#eab308",       // yellow-500
          marginal: "#f97316",    // orange-500
          weak: "#ef4444",        // red-500
        },
      },
    },
  },
  plugins: [],
};

export default config;
