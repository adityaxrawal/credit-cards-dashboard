"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { theme } from '@/lib/theme';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  className = '',
  fullWidth = false,
  icon,
  iconPosition = 'left',
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent backdrop-filter backdrop-blur-sm';
  
  const variantClasses = {
    primary: `bg-gradient-to-r from-cred-purple to-cred-pink text-white hover:from-cred-purple/90 hover:to-cred-pink/90 focus:ring-cred-purple/50 shadow-lg hover:shadow-xl`,
    secondary: `bg-gradient-to-r from-cred-secondary to-cred-tertiary text-white hover:from-cred-secondary/90 hover:to-cred-tertiary/90 focus:ring-cred-secondary/50 shadow-lg hover:shadow-xl`,
    outline: `border border-white/20 text-white hover:bg-white/10 hover:border-white/30 focus:ring-white/20 backdrop-filter backdrop-blur-sm`,
    ghost: `text-white hover:bg-white/10 focus:ring-white/20`,
    success: `bg-gradient-to-r from-cred-success to-emerald-500 text-white hover:from-cred-success/90 hover:to-emerald-500/90 focus:ring-cred-success/50 shadow-lg hover:shadow-xl`,
    error: `bg-gradient-to-r from-cred-error to-red-500 text-white hover:from-cred-error/90 hover:to-red-500/90 focus:ring-cred-error/50 shadow-lg hover:shadow-xl`,
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5',
    xl: 'px-8 py-4 text-xl gap-3',
  };

  const isDisabled = disabled || loading;

  const LoadingSpinner = () => (
    <motion.svg
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`${size === 'xs' ? 'h-3 w-3' : size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-6 w-6'} text-current`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </motion.svg>
  );

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={!isDisabled ? onClick : undefined}
      disabled={isDisabled}
    >
      {loading && <LoadingSpinner />}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </motion.button>
  );
};

export default Button;