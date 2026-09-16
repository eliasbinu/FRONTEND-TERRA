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
        canvas: '#090d16',
        panel: '#0f172a',
        border: {
          DEFAULT: '#1e293b',
          dark: '#1e293b',
        },
        risk: {
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          sky: '#38bdf8',
        },
        status: {
          pass: '#10b981',
          review: '#f59e0b',
          mismatch: '#f43f5e',
          telemetry: '#38bdf8',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
