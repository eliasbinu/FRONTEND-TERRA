/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', 'monospace'],
      },
      colors: {
        canvas: '#f8fafc',
        panel: '#ffffff',
        border: {
          DEFAULT: '#e2e8f0',
          dark: '#cbd5e1',
        },
        risk: {
          emerald: '#16a34a',
          amber: '#d97706',
          rose: '#e11d48',
          sky: '#0284c7',
        },
        status: {
          pass: '#16a34a',
          review: '#d97706',
          mismatch: '#e11d48',
          telemetry: '#16a34a',
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
