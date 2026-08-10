/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: '#FDFCFA',
          100: '#F8F5F0',
          200: '#F0EBE3',
          300: '#E5DDD2'
        },
        charcoal: {
          700: '#3D3A36',
          800: '#2C2926',
          900: '#1C1A18'
        },
        forest: {
          500: '#5C6B4A',
          600: '#4A5740',
          700: '#3A4533',
          800: '#2C3427',
          900: '#1F261C'
        },
        brass: {
          400: '#C4A574',
          500: '#B08D5B'
        },
        warm: {
          100: '#F5F2ED',
          200: '#E8E2D9',
          300: '#D4CCC0',
          400: '#A89F91',
          500: '#7A7268'
        }
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28, 26, 24, 0.04), 0 4px 16px rgba(28, 26, 24, 0.06)'
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'drift': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out both',
        'fade-up-delay': 'fade-up 0.8s ease-out 0.15s both',
        'fade-up-delay-2': 'fade-up 0.8s ease-out 0.3s both',
        'fade-in': 'fade-in 1.1s ease-out both',
        drift: 'drift 8s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
