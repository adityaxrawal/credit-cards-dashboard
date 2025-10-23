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
      primary: '#2B2D42',
      secondary: '#1E1F2E',
      tertiary: '#232538',
    },
    accent: {
      purple: '#9B59B6',
      pink: '#FD79A8',
      blue: '#3498DB',
      green: '#4ECDC4',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B8BCC8',
      tertiary: '#8B8FA3',
    },
    status: {
      success: '#4ECDC4',
      error: '#FF6B6B',
      warning: '#F39C12',
      info: '#3498DB',
    },
  },
  glassmorphism: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdrop: 'blur(16px)',
    border: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.08)',
  },
};

// 15 Different Color Schemes for Credit Cards
export const cardColorSchemes = {
  // Purple Gradient (SBI Group)
  purple: {
    gradient: 'from-purple-500 to-purple-700',
    background: 'bg-gradient-to-br from-purple-500 to-purple-700',
    text: 'text-white',
    accent: 'text-purple-200'
  },
  
  // Orange Gradient (HDFC Group)
  orange: {
    gradient: 'from-orange-400 to-orange-600',
    background: 'bg-gradient-to-br from-orange-400 to-orange-600',
    text: 'text-white',
    accent: 'text-orange-100'
  },
  
  // Blue Gradient (ICICI Group)
  blue: {
    gradient: 'from-blue-500 to-blue-700',
    background: 'bg-gradient-to-br from-blue-500 to-blue-700',
    text: 'text-white',
    accent: 'text-blue-200'
  },
  
  // Green Gradient (Axis Group)
  green: {
    gradient: 'from-green-500 to-green-700',
    background: 'bg-gradient-to-br from-green-500 to-green-700',
    text: 'text-white',
    accent: 'text-green-200'
  },
  
  // Pink Gradient (Kotak Group)
  pink: {
    gradient: 'from-pink-500 to-pink-700',
    background: 'bg-gradient-to-br from-pink-500 to-pink-700',
    text: 'text-white',
    accent: 'text-pink-200'
  },
  
  // Teal Gradient (IndusInd Group)
  teal: {
    gradient: 'from-teal-500 to-teal-700',
    background: 'bg-gradient-to-br from-teal-500 to-teal-700',
    text: 'text-white',
    accent: 'text-teal-200'
  },
  
  // Indigo Gradient (Yes Bank Group)
  indigo: {
    gradient: 'from-indigo-500 to-indigo-700',
    background: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
    text: 'text-white',
    accent: 'text-indigo-200'
  },
  
  // Red Gradient (Citi Group)
  red: {
    gradient: 'from-red-500 to-red-700',
    background: 'bg-gradient-to-br from-red-500 to-red-700',
    text: 'text-white',
    accent: 'text-red-200'
  },
  
  // Emerald Gradient (American Express Group)
  emerald: {
    gradient: 'from-emerald-500 to-emerald-700',
    background: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    text: 'text-white',
    accent: 'text-emerald-200'
  },
  
  // Cyan Gradient (Standard Chartered Group)
  cyan: {
    gradient: 'from-cyan-500 to-cyan-700',
    background: 'bg-gradient-to-br from-cyan-500 to-cyan-700',
    text: 'text-white',
    accent: 'text-cyan-200'
  },
  
  // Violet Gradient (HSBC Group)
  violet: {
    gradient: 'from-violet-500 to-violet-700',
    background: 'bg-gradient-to-br from-violet-500 to-violet-700',
    text: 'text-white',
    accent: 'text-violet-200'
  },
  
  // Amber Gradient (PNB Group)
  amber: {
    gradient: 'from-amber-500 to-amber-700',
    background: 'bg-gradient-to-br from-amber-500 to-amber-700',
    text: 'text-white',
    accent: 'text-amber-200'
  },
  
  // Rose Gradient (BOB Group)
  rose: {
    gradient: 'from-rose-500 to-rose-700',
    background: 'bg-gradient-to-br from-rose-500 to-rose-700',
    text: 'text-white',
    accent: 'text-rose-200'
  },
  
  // Lime Gradient (Canara Group)
  lime: {
    gradient: 'from-lime-500 to-lime-700',
    background: 'bg-gradient-to-br from-lime-500 to-lime-700',
    text: 'text-white',
    accent: 'text-lime-200'
  },
  
  // Slate Gradient (Union Bank Group)
  slate: {
    gradient: 'from-slate-600 to-slate-800',
    background: 'bg-gradient-to-br from-slate-600 to-slate-800',
    text: 'text-white',
    accent: 'text-slate-300'
  }
};

// Bank to color scheme mapping
export const getBankColor = (bankName: string): string => {
  const bankColorMapping: Record<string, keyof typeof cardColorSchemes> = {
    // SBI Group - Purple
    'SBI': 'purple',
    'State Bank of India': 'purple',
    
    // HDFC Group - Orange
    'HDFC': 'orange',
    'HDFC Bank': 'orange',
    
    // ICICI Group - Blue
    'ICICI': 'blue',
    'ICICI Bank': 'blue',
    
    // Axis Group - Green
    'Axis': 'green',
    'Axis Bank': 'green',
    
    // Kotak Group - Pink
    'Kotak': 'pink',
    'Kotak Mahindra': 'pink',
    
    // IndusInd Group - Teal
    'IndusInd': 'teal',
    'IndusInd Bank': 'teal',
    
    // Yes Bank Group - Indigo
    'Yes Bank': 'indigo',
    'YES BANK': 'indigo',
    
    // Citi Group - Red
    'Citi': 'red',
    'Citibank': 'red',
    
    // American Express Group - Emerald
    'American Express': 'emerald',
    'AMEX': 'emerald',
    
    // Standard Chartered Group - Cyan
    'Standard Chartered': 'cyan',
    'StanChart': 'cyan',
    
    // HSBC Group - Violet
    'HSBC': 'violet',
    
    // PNB Group - Amber
    'PNB': 'amber',
    'Punjab National Bank': 'amber',
    
    // BOB Group - Rose
    'BOB': 'rose',
    'Bank of Baroda': 'rose',
    
    // Canara Group - Lime
    'Canara Bank': 'lime',
    'Canara': 'lime',
    
    // Union Bank Group - Slate
    'Union Bank': 'slate',
    'Union Bank of India': 'slate',
  };

  const colorScheme = bankColorMapping[bankName] || 'slate';
  return cardColorSchemes[colorScheme].gradient;
};

// Get complete color scheme for a bank
export const getBankColorScheme = (bankName: string) => {
  const bankColorMapping: Record<string, keyof typeof cardColorSchemes> = {
    'SBI': 'purple', 'State Bank of India': 'purple',
    'HDFC': 'orange', 'HDFC Bank': 'orange',
    'ICICI': 'blue', 'ICICI Bank': 'blue',
    'Axis': 'green', 'Axis Bank': 'green',
    'Kotak': 'pink', 'Kotak Mahindra': 'pink',
    'IndusInd': 'teal', 'IndusInd Bank': 'teal',
    'Yes Bank': 'indigo', 'YES BANK': 'indigo',
    'Citi': 'red', 'Citibank': 'red',
    'American Express': 'emerald', 'AMEX': 'emerald',
    'Standard Chartered': 'cyan', 'StanChart': 'cyan',
    'HSBC': 'violet',
    'PNB': 'amber', 'Punjab National Bank': 'amber',
    'BOB': 'rose', 'Bank of Baroda': 'rose',
    'Canara Bank': 'lime', 'Canara': 'lime',
    'Union Bank': 'slate', 'Union Bank of India': 'slate',
  };

  const colorScheme = bankColorMapping[bankName] || 'slate';
  return cardColorSchemes[colorScheme];
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