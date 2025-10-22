'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'elevated' | 'outlined' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  clickable?: boolean;
  loading?: boolean;
}

const cardVariants = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  glass: 'bg-white/10 dark:bg-gray-800/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20',
  elevated: 'bg-white dark:bg-gray-800 shadow-lg border-0',
  outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-600',
  gradient: 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 border-0'
};

const sizeVariants = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl'
};

const paddingVariants = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  children,
  className,
  variant = 'default',
  size = 'md',
  padding = 'md',
  hover = false,
  clickable = false,
  loading = false,
  ...props
}, ref) => {
  const cardClasses = cn(
    'relative transition-all duration-200',
    cardVariants[variant],
    sizeVariants[size],
    paddingVariants[padding],
    {
      'hover:shadow-lg hover:scale-[1.02] cursor-pointer': hover || clickable,
      'opacity-60 pointer-events-none': loading,
    },
    className
  );

  const motionProps = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
    whileHover: hover || clickable ? { y: -2 } : undefined,
    whileTap: clickable ? { scale: 0.98 } : undefined,
    ...props
  };

  return (
    <motion.div
      ref={ref}
      className={cardClasses}
      {...motionProps}
    >
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-inherit flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {children}
    </motion.div>
  );
});

Card.displayName = 'Card';

export { Card };
export type { CardProps };