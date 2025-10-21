export interface ThemeColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  accent: {
    purple: string;
    pink: string;
    blue: string;
    green: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  status: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
}

export interface GlassmorphismStyles {
  background: string;
  backdrop: string;
  border: string;
}

export interface Theme {
  colors: ThemeColors;
  glassmorphism: GlassmorphismStyles;
}

export const theme = {
  colors: {
    background: {
      primary: '#000000',
      secondary: '#0f0f0f',
      tertiary: '#1a1a1a',
      card: 'rgba(255, 255, 255, 0.03)',
      cardHover: 'rgba(255, 255, 255, 0.06)',
      gradient: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #0f0f0f 100%)',
    },
    accent: {
      primary: '#6366f1', // Indigo for primary actions
      secondary: '#8b5cf6', // Purple for secondary
      tertiary: '#06b6d4', // Cyan for tertiary
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      cred: '#6366f1', // CRED brand color
    },
    text: {
      primary: '#ffffff',
      secondary: '#d1d5db', // Lighter gray for better readability
      tertiary: '#9ca3af',
      muted: '#6b7280',
      amount: '#ffffff', // White for amounts like CRED
      currency: '#d1d5db',
    },
    status: {
      success: '#22c55e',
      warning: '#eab308',
      error: '#dc2626',
      info: '#3b82f6',
      pending: '#f59e0b',
    },
    card: {
      sbi: {
        from: '#6366f1',
        to: '#8b5cf6',
        accent: '#fbbf24',
      },
      hdfc: {
        from: '#f97316',
        to: '#3b82f6',
        accent: '#ffffff',
      },
      axis: {
        from: '#1f2937',
        to: '#374151',
        accent: '#d1d5db',
      },
      icici: {
        from: '#dc2626',
        to: '#7c2d12',
        accent: '#fbbf24',
      },
      default: {
        from: '#374151',
        to: '#1f2937',
        accent: '#d1d5db',
      },
    },
  },
  glassmorphism: {
    light: 'backdrop-blur-md bg-white/5 border border-white/10',
    medium: 'backdrop-blur-lg bg-white/3 border border-white/5',
    heavy: 'backdrop-blur-xl bg-white/10 border border-white/15',
    card: 'backdrop-blur-sm bg-white/[0.02] border border-white/[0.05]',
  },
  gradients: {
    primary: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    secondary: 'bg-gradient-to-br from-orange-500 to-blue-600',
    dark: 'bg-gradient-to-br from-gray-800 to-gray-900',
    cred: 'bg-gradient-to-br from-black via-gray-900 to-black',
  },
} as const;

export default theme;