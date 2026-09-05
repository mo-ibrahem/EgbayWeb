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
        // Maps to the CSS custom properties in app/globals.css so every
        // component reads from one token source: bg-brand, text-brand,
        // border-brand, bg-brand-soft, etc.
        brand: {
          DEFAULT: 'var(--brand)',
          dark: 'var(--brand-dark)',
          soft: 'var(--brand-soft)',
        },
        ink:     { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)' },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)' },
        info:    { DEFAULT: 'var(--info)',    soft: 'var(--info-soft)' },
      },
      // Neutrals (backgrounds, borders, body/muted text) intentionally use
      // Tailwind's built-in `slate` scale directly everywhere in this app
      // rather than a second aliased gray system -- one neutral palette,
      // not two names for the same grays.
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-sm)',
        'card-md': 'var(--shadow-md)',
        'card-lg': 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-cairo)', 'Cairo', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
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
        'fade-in-up': 'fade-in-up 0.35s ease forwards',
        'fade-in': 'fade-in 0.2s ease forwards',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
};
