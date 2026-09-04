/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        csc: {
          purple: '#21203a',
          lilac: '#56548c',
          pink: '#895294',
          indigo: '#382b5c',
          lavender: '#bdaccf',
          cyan: '#6fb7e6',
          grey: '#f4f4f7',
          surface: {
            dark: '#2a2948',
            darker: '#1a192e',
            light: '#ffffff',
            card: '#f4f4f7',
          },
          border: {
            dark: '#3e3c66',
            light: '#e2e2ea',
          }
        }
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        heading: ['Roboto Condensed', 'Roboto', 'sans-serif'],
        dyslexic: ['OpenDyslexic', 'Atkinson Hyperlegible', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
