// tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}', // <-- Añade TODO el src general
    './src/wallet-adapter/**/*.{ts,tsx}' // <-- Y tu SDK embebido
  ],
  theme: {
    extend: {
      animation: {
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-out': 'slideOut 0.2s ease-in',
      },
      keyframes: {
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideOut: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
