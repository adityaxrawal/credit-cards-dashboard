'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<HTMLMotionProps<'input'>, 'size'> {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  required?: boolean;
}

const sizeVariants = {
  // Mobile-first responsive sizing with better touch targets
  sm: 'px-3 py-3 sm:py-2 text-sm sm:text-sm',
  md: 'px-4 py-4 sm:py-3 text-base sm:text-base',
  lg: 'px-5 py-5 sm:py-4 text-lg sm:text-lg'
};

const variantClasses = {
  default: 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
  filled: 'bg-gray-100 dark:bg-gray-700 border-0',
  outlined: 'border-2 border-gray-300 dark:border-gray-600 bg-transparent'
};

const Input = React.memo(React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  placeholder,
  error,
  helperText,
  size = 'md',
  variant = 'default',
  leftIcon,
  rightIcon,
  loading = false,
  required = false,
  className,
  disabled,
  ...props
}, ref) => {
  const inputId = React.useId();
  const isDisabled = disabled || loading;

  const inputClasses = cn(
    // Base styles with mobile-first approach
    'w-full rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    // Mobile touch target improvements
    'min-h-[44px] sm:min-h-[40px]',
    sizeVariants[size],
    variantClasses[variant],
    {
      // Mobile-friendly icon spacing
      'pl-12 sm:pl-10': leftIcon,
      'pr-12 sm:pr-10': rightIcon || loading,
      'border-red-500 focus:ring-red-500': error,
      'opacity-50 cursor-not-allowed': isDisabled,
    },
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        
        <motion.input
          ref={ref}
          id={inputId}
          className={inputClasses}
          placeholder={placeholder}
          disabled={isDisabled}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          {...props}
        />
        
        {(rightIcon || loading) && (
          <div className="absolute right-4 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center">
            {loading ? (
              <div className="w-5 h-5 sm:w-4 sm:h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              rightIcon
            )}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={cn(
            'mt-2 text-sm sm:text-base leading-relaxed px-1',
            error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          {error || helperText}
        </motion.p>
      )}
    </div>
  );
}));

Input.displayName = 'Input';

export { Input };
export type { InputProps };