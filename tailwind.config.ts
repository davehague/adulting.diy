import type { Config } from "tailwindcss";

export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Lora", "serif"],
        sans: ["Plus Jakarta Sans", "sans-serif"],
      },
      colors: {
        honey: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
