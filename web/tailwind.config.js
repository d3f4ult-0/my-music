/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0c0d0e',
        surface: {
          DEFAULT: '#141518',
          hover: '#1c1e22',
          active: '#24272c',
          card: '#16171a',
        },
        border: {
          subtle: '#212429',
          muted: '#2e3238',
        },
        primary: {
          DEFAULT: '#22c55e', // Emerald/green
          hover: '#16a34a',
          foreground: '#000000',
        },
      },
    },
  },
  plugins: [],
}
