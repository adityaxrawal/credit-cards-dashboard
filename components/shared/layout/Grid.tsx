"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  responsive?: {
    sm?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    md?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    lg?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
    xl?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  };
  animated?: boolean;
  className?: string;
}

const Grid = React.memo<GridProps>(({
  children,
  cols = 1,
  gap = 'md',
  responsive,
  animated = false,
  className,
}) => {
  const gridClasses = cn(
    'grid',
    // Base columns
    {
      'grid-cols-1': cols === 1,
      'grid-cols-2': cols === 2,
      'grid-cols-3': cols === 3,
      'grid-cols-4': cols === 4,
      'grid-cols-5': cols === 5,
      'grid-cols-6': cols === 6,
      'grid-cols-12': cols === 12,
    },
    // Responsive columns
    responsive && {
      [`sm:grid-cols-${responsive.sm}`]: responsive.sm,
      [`md:grid-cols-${responsive.md}`]: responsive.md,
      [`lg:grid-cols-${responsive.lg}`]: responsive.lg,
      [`xl:grid-cols-${responsive.xl}`]: responsive.xl,
    },
    // Gap sizes
    {
      'gap-1': gap === 'xs',
      'gap-2': gap === 'sm',
      'gap-4': gap === 'md',
      'gap-6': gap === 'lg',
      'gap-8': gap === 'xl',
    },
    className
  );

  if (animated) {
    return (
      <motion.div
        className={gridClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return <div className={gridClasses}>{children}</div>;
});

Grid.displayName = 'Grid';

export default Grid;