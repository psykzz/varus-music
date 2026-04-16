/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Epilogue", "Segoe UI", "sans-serif"],
        body: ["Manrope", "Segoe UI", "sans-serif"],
      },
      screens: {
        // orientation-based variants:  landscape:flex-row, landscape:hidden, etc.
        landscape: { raw: "(orientation: landscape)" },
      },
      colors: {
        spotify: {
          green: "#a1faff",
          black: "#0e0e13",
          darkgray: "#19191f",
          gray: "#25252c",
          lightgray: "#acaab1",
        },
        sonic: {
          obsidian: "#0e0e13",
          surface: "#19191f",
          raised: "#1f1f26",
          panel: "#25252c",
          cyan: "#a1faff",
          cyanStrong: "#00f4fe",
          text: "#f8f5fd",
          muted: "#acaab1",
          outline: "#48474d",
        },
      },
      borderRadius: {
        sonic: "0.75rem",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
