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
        canvas: '#000000',
        panel: '#0a0f0d',
        border: {
          DEFAULT: '#19261c',
          dark: '#19261c',
        },
        risk: {
          emerald: '#22c55e',
          amber: '#f59e0b',
          rose: '#f43f5e',
          sky: '#22c55e',
        },
        status: {
          pass: '#22c55e',
          review: '#f59e0b',
          mismatch: '#f43f5e',
          telemetry: '#22c55e',
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
