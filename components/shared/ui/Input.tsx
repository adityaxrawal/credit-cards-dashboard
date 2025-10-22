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
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-5 py-4 text-lg'
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
    'w-full rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    sizeVariants[size],
    variantClasses[variant],
    {
      'pl-10': leftIcon,
      'pr-10': rightIcon || loading,
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
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
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
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
            'mt-2 text-sm',
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