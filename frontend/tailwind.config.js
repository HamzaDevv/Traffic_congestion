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
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        bg: {
          page:   'rgb(var(--color-bg-page) / <alpha-value>)',
          canvas: 'rgb(var(--color-bg-canvas) / <alpha-value>)',
          card:   'rgb(var(--color-bg-card) / <alpha-value>)',
          hover:  'rgb(var(--color-bg-hover) / <alpha-value>)',
          border: 'rgb(var(--color-bg-border) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-text-muted) / <alpha-value>)',
        },
        accent: {
          yellow: 'rgb(var(--color-accent-yellow) / <alpha-value>)',
          blue:   'rgb(var(--color-accent-blue) / <alpha-value>)',
          orange: 'rgb(var(--color-accent-orange) / <alpha-value>)',
        },
        risk: {
          low:      'rgb(var(--color-risk-low) / <alpha-value>)',
          moderate: 'rgb(var(--color-risk-moderate) / <alpha-value>)',
          high:     'rgb(var(--color-risk-high) / <alpha-value>)',
          critical: 'rgb(var(--color-risk-critical) / <alpha-value>)',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
