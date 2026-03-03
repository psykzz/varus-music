/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // orientation-based variants:  landscape:flex-row, landscape:hidden, etc.
        landscape: { raw: '(orientation: landscape)' },
      },
      colors: {
        spotify: {
          green: '#1DB954',
          black: '#191414',
          darkgray: '#121212',
          gray: '#282828',
          lightgray: '#B3B3B3',
        },
      },
    },
  },
  plugins: [],
}
