/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#1a1a2e',
        primary: '#6366f1',
        accent: '#00D994',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
}
