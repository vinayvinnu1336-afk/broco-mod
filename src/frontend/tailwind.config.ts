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
          950: "#050D1A",
          900: "#0A192F", // Primary Deep Navy
          800: "#112240",
          700: "#1E293B",
          600: "#334155",
          500: "#475569",
          400: "#64748B",
        },
        electric: {
          700: "#1D4ED8",
          600: "#2563EB", // Primary Electric Blue
          500: "#3B82F6",
          400: "#60A5FA",
          300: "#93C5FD",
          100: "#DBEAFE",
          50: "#EFF6FF",
        },
        surface: {
          0: "#FFFFFF",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          softBlue: "#EFF6FF",
          softBlueBorder: "#BFDBFE",
        },
        semantic: {
          success: "#16A34A",
          successBg: "#F0FDF4",
          successBorder: "#BBF7D0",
          warning: "#D97706",
          warningBg: "#FFFBEB",
          warningBorder: "#FDE68A",
          error: "#DC2626",
          errorBg: "#FEF2F2",
          errorBorder: "#FECACA",
          info: "#2563EB",
          infoBg: "#EFF6FF",
          infoBorder: "#BFDBFE",
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(10, 25, 47, 0.05)',
        'card': '0 1px 3px 0 rgba(10, 25, 47, 0.07), 0 1px 2px -1px rgba(10, 25, 47, 0.07)',
        'elevated': '0 4px 6px -1px rgba(10, 25, 47, 0.08), 0 2px 4px -2px rgba(10, 25, 47, 0.06)',
        'dropdown': '0 10px 15px -3px rgba(10, 25, 47, 0.1), 0 4px 6px -4px rgba(10, 25, 47, 0.08)',
        'modal': '0 20px 25px -5px rgba(10, 25, 47, 0.15), 0 8px 10px -6px rgba(10, 25, 47, 0.1)',
      }
    },
  },
  plugins: [],
};
export default config;
