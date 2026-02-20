/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // ✅ הוספנו את ההגדרה הקריטית למצב לילה!
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e5007e',
          light: '#ff4da6',
          dark: '#b30062',
        }
      },
      fontFamily: {
        sans: ['Heebo', 'Rubik', 'sans-serif'],
      }
    },
  },
  plugins: [],
}