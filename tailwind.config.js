/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        skylight: {
          bg: '#fafbfa',
          dark: '#1c3a1e',
          card: '#ffffff',
          panel: '#ffffff',
          accent: '#d4af37',
          gold: '#e2b842',
          goldHover: '#b89428',
          green: '#1c3a1e',
          greenLight: '#eaf2eb',
          red: '#ef4444',
          blue: '#2bb3a7',
          purple: '#8b5cf6',
          muted: '#617563',
          border: 'rgba(28, 58, 30, 0.12)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['monospace'],
      },
    },
  },
  plugins: [],
};
