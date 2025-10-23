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
        // Primary Background Colors (matching the image)
        'primary-bg': '#1a1d24',
        'secondary-bg': '#2a2d34',
        'card-bg': '#2a2d34',
        'sidebar-bg': '#2a2d34',
        
        // Text Colors
        'text-primary': '#FFFFFF',
        'text-secondary': '#B8BCC8',
        'text-muted': '#8B8FA3',
        
        // Accent Colors (matching the image)
        'accent-green': '#4ade80',
        'accent-purple': '#8b5cf6',
        'accent-orange': '#f97316',
        'accent-blue': '#3b82f6',
        'accent-pink': '#ec4899',
        
        // Card Gradient Colors (matching the image)
        'card-purple': '#8b5cf6',
        'card-orange': '#f97316',
        'card-blue': '#3b82f6',
        'card-green': '#4ade80',
        'card-pink': '#ec4899',
        
        // Status Colors
        'success': '#4ade80',
        'warning': '#f97316',
        'error': '#ef4444',
        'info': '#3b82f6',
        
        // Legacy colors (updated to match new scheme)
        'cred-dark': '#1a1d24',
        'cred-secondary': '#2a2d34',
        'cred-tertiary': '#2a2d34',
        'cred-purple': '#8b5cf6',
        'cred-pink': '#ec4899',
        'cred-blue': '#3b82f6',
        'cred-green': '#4ade80',
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