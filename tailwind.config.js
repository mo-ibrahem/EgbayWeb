/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
        accent: {
          500: '#7C3AED',
          600: '#6D28D9',
        },
        navy: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-cairo)', 'Cairo', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease forwards',
        'fade-in': 'fade-in 0.3s ease forwards',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
};
