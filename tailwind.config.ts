import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f7f4',
          100: '#d9ede4',
          200: '#b5dccb',
          300: '#84c3ab',
          400: '#52a386',
          500: '#2d6a4f',
          600: '#23533d',
          700: '#1b4332',
          800: '#153427',
          900: '#0f261c',
          950: '#081c15',
        },
        sand: {
          50: '#faf9f6',
          100: '#f4f3ee',
          200: '#e8e6df',
          300: '#d5d2c8',
          400: '#b8b3a6',
          500: '#9c9687',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
