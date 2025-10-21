import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cred-dark': '#0F0F0F',
        'cred-secondary': '#1A1A1A',
        'cred-tertiary': '#2A2A2A',
        'cred-purple': '#9B6BFF',
        'cred-pink': '#FF6B9D',
        'cred-blue': '#4D9BFF',
        'cred-green': '#00D9A3',
      },
      screens: {
        'mobile': '320px',
        'tablet': '768px',
        'laptop': '1024px',
        'macbook-14': '1512px',
        'desktop': '1920px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config