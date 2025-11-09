/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark background colors
        dark: {
          50: '#1e293b',
          100: '#0f172a',
          200: '#020617',
        },
        // Cyberpunk accent colors
        cyber: {
          blue: '#3b82f6',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#10b981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
