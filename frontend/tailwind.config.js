/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-sea': {
          900: '#0A1628',
          800: '#0D1F3C',
          700: '#132845',
          600: '#1A3350',
        },
        'ocean-accent': '#00D4FF',
        'ocean-glow': '#7B2FFF',
        'ocean-cyan': '#00BCD4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
