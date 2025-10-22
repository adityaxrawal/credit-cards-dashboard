"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
  headerClassName?: string;
}

const Section = React.memo<SectionProps>(({
  children,
  title,
  subtitle,
  spacing = 'md',
  animated = false,
  className,
  headerClassName,
}) => {
  const sectionClasses = cn(
    // Spacing variants
    {
      'py-0': spacing === 'none',
      'py-4': spacing === 'sm',
      'py-8': spacing === 'md',
      'py-12': spacing === 'lg',
      'py-16': spacing === 'xl',
    },
    className
  );

  const headerClasses = cn(
    'mb-6',
    headerClassName
  );

  const content = (
    <>
      {(title || subtitle) && (
        <div className={headerClasses}>
          {title && (
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </>
  );

  if (animated) {
    return (
      <motion.section
        className={sectionClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {content}
      </motion.section>
    );
  }

  return <section className={sectionClasses}>{content}</section>;
});

Section.displayName = 'Section';

export default Section;