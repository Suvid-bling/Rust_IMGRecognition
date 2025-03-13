// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Custom color palette for image recognition app
          'app-background': '#f4f4f6',
          'app-primary': '#3b82f6',
          'app-secondary': '#6366f1',
          'app-accent': '#10b981'
        },
        fontFamily: {
          // Custom font configurations
          'sans': ['Inter', 'system-ui', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }