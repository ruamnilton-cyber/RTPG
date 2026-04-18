/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f9f7ef",
          100: "#f0e7c8",
          200: "#e4cf95",
          300: "#d4b365",
          400: "#c59843",
          500: "#af7b28",
          600: "#8f611d",
          700: "#704916",
          800: "#4f3312",
          900: "#321f0a"
        }
      },
      boxShadow: {
        card: "0 12px 30px rgba(49, 35, 11, 0.12)"
      }
    }
  },
  plugins: []
};
