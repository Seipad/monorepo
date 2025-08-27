/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#9D1F19',
        secondary: '#ff6347',
        charcoal: '#2e1a1a',
        light: '#ffffff',
        card: '#392424',
        'accent-dark': '#1e0f0f',
        // Adding red color variants to replace green
        'red-50': '#fef2f2',
        'red-100': '#fee2e2',
        'red-200': '#fecaca',
        'red-400': '#f87171',
        'red-500': '#ef4444',
        'red-600': '#dc2626',
        'red-700': '#b91c1c',
        'red-800': '#991b1b',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #9D1F19 0%, #ff6347 100%)',
        'gradient-charcoal': 'linear-gradient(135deg, #2e1a1a 0%, #1e0f0f 100%)',
        'gradient-card': 'linear-gradient(135deg, #392424 0%, #2e1a1a 100%)',
      },
    },
  },
  plugins: [],
};
