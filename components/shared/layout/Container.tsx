"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

const Container = React.memo<ContainerProps>(({
  children,
  size = 'lg',
  padding = 'md',
  animated = false,
  className,
}) => {
  const containerClasses = cn(
    'mx-auto',
    // Size variants
    {
      'max-w-sm': size === 'sm',
      'max-w-2xl': size === 'md',
      'max-w-6xl': size === 'lg',
      'max-w-7xl': size === 'xl',
      'max-w-full': size === 'full',
    },
    // Padding variants
    {
      'px-0': padding === 'none',
      'px-2': padding === 'sm',
      'px-4': padding === 'md',
      'px-6': padding === 'lg',
      'px-8': padding === 'xl',
    },
    className
  );

  if (animated) {
    return (
      <motion.div
        className={containerClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={containerClasses}>{children}</div>;
});

Container.displayName = 'Container';

export default Container;