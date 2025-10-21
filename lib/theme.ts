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
  hover: string;
}

export interface Theme {
  colors: ThemeColors;
  glassmorphism: GlassmorphismStyles;
}

export const theme: Theme = {
  colors: {
    background: {
      primary: '#0F0F0F',
      secondary: '#1A1A1A',
      tertiary: '#2A2A2A',
    },
    accent: {
      purple: '#9B6BFF',
      pink: '#FF6B9D',
      blue: '#4D9BFF',
      green: '#00D9A3',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      tertiary: '#808080',
    },
    status: {
      success: '#00D9A3',
      error: '#FF6B6B',
      warning: '#FFB800',
      info: '#4D9BFF',
    },
  },
  glassmorphism: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdrop: 'blur(16px)',
    border: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.08)',
  },
};

// Bank color mapping for credit cards
export const getBankColor = (bankName: string): string => {
  const bankColors: Record<string, string> = {
    'SBI': 'from-blue-600 to-blue-800',
    'HDFC': 'from-red-600 to-red-800',
    'ICICI': 'from-orange-600 to-orange-800',
    'Axis': 'from-purple-600 to-purple-800',
    'Kotak': 'from-red-500 to-pink-600',
    'IndusInd': 'from-green-600 to-green-800',
    'Yes Bank': 'from-blue-500 to-indigo-600',
    'Citi': 'from-blue-700 to-blue-900',
    'American Express': 'from-gray-600 to-gray-800',
    'Standard Chartered': 'from-teal-600 to-teal-800',
  };

  return bankColors[bankName] || 'from-gray-600 to-gray-800';
};

// Category color mapping for transactions
export const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    'Food & Dining': theme.colors.accent.pink,
    'Travel': theme.colors.accent.blue,
    'Shopping': theme.colors.accent.purple,
    'Bills & Utilities': theme.colors.accent.green,
    'Entertainment': theme.colors.status.warning,
    'Fuel': theme.colors.status.error,
    'Healthcare': theme.colors.status.info,
    'Groceries': theme.colors.accent.green,
    'Education': theme.colors.accent.blue,
    'Miscellaneous': theme.colors.text.secondary,
  };

  return categoryColors[category] || theme.colors.text.secondary;
};

export default theme;