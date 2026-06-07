/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        peach: {
          50: '#fff5f2',
          100: '#ffe6de',
          200: '#ffcaba',
          300: '#ffaa91',
          400: '#ff8563',
          500: '#ff6035',
          600: '#ed4618',
          700: '#c6330d',
          800: '#a42a0e',
          900: '#882611',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
