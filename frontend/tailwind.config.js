/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          900: '#040d1c',
          800: '#071529',
          700: '#0a1f3d',
          600: '#0d2952',
        },
        cyan: {
          glow: '#00e5ff',
          soft: '#00b4d8',
        },
        amber: {
          glow: '#ff6d00',
          soft: '#ffa040',
        },
        severity: {
          low: '#00e676',
          moderate: '#ffea00',
          high: '#ff9100',
          critical: '#ff1744',
        }
      },
      backgroundImage: {
        'mesh-gradient': 'radial-gradient(at 20% 30%, rgba(0,229,255,0.08) 0px, transparent 50%), radial-gradient(at 80% 70%, rgba(255,109,0,0.06) 0px, transparent 50%)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'cyan-glow': '0 0 20px rgba(0, 229, 255, 0.3)',
        'amber-glow': '0 0 20px rgba(255, 109, 0, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
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
