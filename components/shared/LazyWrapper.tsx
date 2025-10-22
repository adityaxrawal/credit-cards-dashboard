"use client";

import React, { Suspense, ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center space-x-2 text-gray-400"
    >
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Loading...</span>
    </motion.div>
  </div>
);

const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback = <DefaultFallback />,
  className,
}) => {
  return (
    <div className={className}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </div>
  );
};

// Higher-order component for lazy loading
export const withLazyLoading = <P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = React.lazy(() => Promise.resolve({ default: Component }));
  
  return React.forwardRef<HTMLElement, P>((props, ref) => (
    <LazyWrapper fallback={fallback}>
      <LazyComponent {...props} ref={ref} />
    </LazyWrapper>
  ));
};

// Utility for creating lazy-loaded components
export const createLazyComponent = <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = React.lazy(importFn);
  
  return React.forwardRef<HTMLElement, P>((props, ref) => (
    <LazyWrapper fallback={fallback}>
      <LazyComponent {...props} ref={ref} />
    </LazyWrapper>
  ));
};

export default LazyWrapper;