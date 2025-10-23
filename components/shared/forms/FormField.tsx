"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  animated?: boolean;
}

const FormField = React.memo<FormFieldProps>(({
  children,
  label,
  error,
  success,
  hint,
  required = false,
  className,
  labelClassName,
  animated = false,
}) => {
  const fieldClasses = cn(
    // Mobile-first responsive spacing
    'space-y-2 sm:space-y-3',
    className
  );

  const labelClasses = cn(
    // Mobile-friendly label styling
    'block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300',
    // Better touch target spacing
    'mb-2',
    labelClassName
  );

  const messageClasses = cn(
    // Mobile-friendly message styling
    'flex items-start gap-2 text-sm sm:text-base leading-relaxed',
    // Better spacing on mobile
    'mt-2 px-1',
    {
      'text-red-600 dark:text-red-400': error,
      'text-green-600 dark:text-green-400': success,
      'text-gray-500 dark:text-gray-400': hint && !error && !success,
    }
  );

  const content = (
    <div className={fieldClasses}>
      {label && (
        <label className={labelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="w-full">
        {children}
      </div>
      
      {(error || success || hint) && (
        <div className={messageClasses}>
          {error && (
            <>
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </>
          )}
          {success && !error && (
            <>
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{success}</span>
            </>
          )}
          {hint && !error && !success && (
            <span className="flex-1 pl-6 sm:pl-7">{hint}</span>
          )}
        </div>
      )}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        {content}
      </motion.div>
    );
  }

  return content;
});

FormField.displayName = 'FormField';

export default FormField;