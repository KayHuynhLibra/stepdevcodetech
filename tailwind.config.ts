import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      animation: {
        'shooting-star': 'shooting-star 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'shooting-star': {
          '0%': {
            transform: 'translateX(0) translateY(0)',
            opacity: '1',
          },
          '100%': {
            transform: 'translateX(100vw) translateY(100vh)',
            opacity: '0',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
      },
    },
  },
  plugins: [],
}
export default config

