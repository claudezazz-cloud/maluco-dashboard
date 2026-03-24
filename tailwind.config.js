/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#071DE3',
        'brand-dark': '#0516B0',
        'brand-light': '#2E4EF0',
      },
    },
  },
  plugins: [],
}
