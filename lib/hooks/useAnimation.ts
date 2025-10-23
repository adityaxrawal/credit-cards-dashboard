'use client';

import { useCallback, useState } from 'react';
import { Variants, useAnimation as useFramerAnimation } from 'framer-motion';

interface UseAnimationOptions {
  duration?: number;
  delay?: number;
  staggerChildren?: number;
}

interface UseAnimationReturn {
  controls: ReturnType<typeof useFramerAnimation>;
  variants: {
    container: Variants;
    item: Variants;
    fadeIn: Variants;
    slideUp: Variants;
    slideDown: Variants;
    slideLeft: Variants;
    slideRight: Variants;
    scale: Variants;
    rotate: Variants;
  };
  isAnimating: boolean;
  startAnimation: (animationName: string) => Promise<void>;
  stopAnimation: () => void;
}

function useAnimation(options: UseAnimationOptions = {}): UseAnimationReturn {
  const {
    duration = 0.3,
    delay = 0,
    staggerChildren = 0.1,
  } = options;

  const controls = useFramerAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  const variants = {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          duration,
          delay,
          staggerChildren,
          when: 'beforeChildren',
        },
      },
    },
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration },
      },
    },
    fadeIn: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration, delay },
      },
    },
    slideUp: {
      hidden: { opacity: 0, y: 50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration, delay },
      },
    },
    slideDown: {
      hidden: { opacity: 0, y: -50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration, delay },
      },
    },
    slideLeft: {
      hidden: { opacity: 0, x: 50 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { duration, delay },
      },
    },
    slideRight: {
      hidden: { opacity: 0, x: -50 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { duration, delay },
      },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { duration, delay },
      },
    },
    rotate: {
      hidden: { opacity: 0, rotate: -180 },
      visible: {
        opacity: 1,
        rotate: 0,
        transition: { duration, delay },
      },
    },
  };

  const startAnimation = useCallback(
    async (animationName: string) => {
      setIsAnimating(true);
      try {
        await controls.start(animationName);
      } finally {
        setIsAnimating(false);
      }
    },
    [controls]
  );

  const stopAnimation = useCallback(() => {
    controls.stop();
    setIsAnimating(false);
  }, [controls]);

  return {
    controls,
    variants,
    isAnimating,
    startAnimation,
    stopAnimation,
  };
}

// Predefined animation presets
export const animationPresets = {
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3 },
  },
  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3 },
  },
  fadeInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2 },
  },
  slideInUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { type: 'spring', damping: 25, stiffness: 500 },
  },
  slideInDown: {
    initial: { y: '-100%' },
    animate: { y: 0 },
    exit: { y: '-100%' },
    transition: { type: 'spring', damping: 25, stiffness: 500 },
  },
};

export { useAnimation };
export type { UseAnimationOptions, UseAnimationReturn };