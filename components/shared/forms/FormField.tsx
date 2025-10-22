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
    'space-y-2',
    className
  );

  const labelClasses = cn(
    'block text-sm font-medium text-gray-700 dark:text-gray-300',
    labelClassName
  );

  const messageClasses = cn(
    'flex items-center gap-2 text-sm',
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
      
      {children}
      
      {(error || success || hint) && (
        <div className={messageClasses}>
          {error && (
            <>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </>
          )}
          {success && !error && (
            <>
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </>
          )}
          {hint && !error && !success && (
            <span>{hint}</span>
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
      >
        {content}
      </motion.div>
    );
  }

  return content;
});

FormField.displayName = 'FormField';

export default FormField;