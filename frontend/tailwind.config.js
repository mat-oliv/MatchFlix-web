/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b1523',
        panel: '#201c2e',
        accent: '#ff5470',
        accent2: '#2dd4bf',
        cream: '#f5f0ff',
      },
    },
  },
  plugins: [],
};
