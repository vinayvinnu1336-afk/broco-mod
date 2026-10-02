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
        navy: {
          950: "#070D18",
          900: "#0B192C",
          800: "#132338",
          700: "#1E293B",
          600: "#334155",
        },
        electric: {
          600: "#1D4ED8",
          500: "#2563EB",
          400: "#3B82F6",
          300: "#60A5FA",
        },
        surface: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
        }
      },
    },
  },
  plugins: [],
};
export default config;
