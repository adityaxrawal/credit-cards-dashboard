"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FormProps {
  children: React.ReactNode;
  onSubmit?: (data: FormData) => void | Promise<void>;
  className?: string;
  animated?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

interface FormContextType {
  isSubmitting: boolean;
  errors: Record<string, string>;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
}

export const FormContext = React.createContext<FormContextType | null>(null);

export const useFormContext = () => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
};

const Form = React.memo<FormProps>(({
  children,
  onSubmit,
  className,
  animated = false,
  loading = false,
  disabled = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (disabled || loading || isSubmitting || !onSubmit) return;

    setIsSubmitting(true);
    clearAllErrors();

    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      // Handle form-level errors here if needed
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, loading, isSubmitting, onSubmit, clearAllErrors]);

  const formClasses = cn(
    // Mobile-first responsive spacing
    'space-y-4 sm:space-y-5 md:space-y-6',
    // Mobile padding and width
    'w-full px-4 sm:px-0',
    {
      'opacity-50 pointer-events-none': disabled || loading,
    },
    className
  );

  const contextValue: FormContextType = {
    isSubmitting,
    errors,
    setError,
    clearError,
    clearAllErrors,
  };

  const content = (
    <FormContext.Provider value={contextValue}>
      <form onSubmit={handleSubmit} className={formClasses} noValidate>
        {children}
      </form>
    </FormContext.Provider>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        {content}
      </motion.div>
    );
  }

  return content;
});

Form.displayName = 'Form';

export default Form;