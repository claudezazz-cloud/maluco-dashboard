/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#008000',
        'brand-dark': '#006600',
        'brand-light': '#00A000',
      },
    },
  },
  plugins: [],
}
