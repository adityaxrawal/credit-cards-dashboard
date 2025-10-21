"use client";

import React from "react";
import { motion } from "framer-motion";

export interface LoadingSkeletonProps {
  type?:
    | "card"
    | "list"
    | "text"
    | "credit-card"
    | "chart"
    | "table"
    | "avatar";
  count?: number;
  className?: string;
  width?: string;
  height?: string;
  animated?: boolean;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = "text",
  count = 1,
  className = "",
  width,
  height,
  animated = true,
}) => {
  const shimmerVariants = {
    initial: { x: "-100%" },
    animate: { x: "100%" },
  };

  const pulseVariants = {
    initial: { opacity: 0.4 },
    animate: { opacity: 1 },
  };

  const SkeletonBase: React.FC<{
    children: React.ReactNode;
    className?: string;
  }> = ({ children, className: baseClassName }) => (
    <div className={`relative overflow-hidden ${baseClassName}`}>
      {children}
      {animated && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          variants={shimmerVariants}
          initial="initial"
          animate="animate"
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );

  const renderSkeleton = () => {
    const baseClasses = animated ? "animate-pulse" : "";

    switch (type) {
      case "credit-card":
        return (
          <SkeletonBase
            className={`glass-card rounded-2xl p-6 space-y-4 ${className}`}
          >
            <motion.div
              className={baseClasses}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="h-8 bg-gradient-to-r from-white/20 to-white/10 rounded w-24"></div>
                <div className="h-6 bg-gradient-to-r from-white/20 to-white/10 rounded w-16"></div>
              </div>
              <div className="space-y-4">
                <div className="h-6 bg-gradient-to-r from-white/20 to-white/10 rounded w-48"></div>
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-white/15 to-white/5 rounded w-20"></div>
                    <div className="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded w-32"></div>
                  </div>
                  <div className="h-8 bg-gradient-to-r from-white/20 to-white/10 rounded w-12"></div>
                </div>
              </div>
            </motion.div>
          </SkeletonBase>
        );

      case "card":
        return (
          <SkeletonBase
            className={`glass-card rounded-xl p-6 space-y-4 ${className}`}
          >
            <motion.div
              className={baseClasses}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div className="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded w-3/4 mb-3"></div>
              <div className="h-8 bg-gradient-to-r from-white/25 to-white/15 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gradient-to-r from-white/15 to-white/5 rounded w-full"></div>
                <div className="h-3 bg-gradient-to-r from-white/15 to-white/5 rounded w-5/6"></div>
              </div>
            </motion.div>
          </SkeletonBase>
        );

      case "list":
        return (
          <SkeletonBase className={`glass-card rounded-lg p-4 ${className}`}>
            <motion.div
              className={`${baseClasses} flex items-center space-x-4`}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div className="rounded-full bg-gradient-to-r from-white/20 to-white/10 h-10 w-10"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded w-3/4"></div>
                <div className="h-3 bg-gradient-to-r from-white/15 to-white/5 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-gradient-to-r from-white/20 to-white/10 rounded w-16"></div>
            </motion.div>
          </SkeletonBase>
        );

      case "chart":
        return (
          <SkeletonBase className={`glass-card rounded-xl p-6 ${className}`}>
            <motion.div
              className={baseClasses}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div className="h-6 bg-gradient-to-r from-white/20 to-white/10 rounded w-1/3 mb-6"></div>
              <div className="flex items-end space-x-2 h-32">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-t from-white/20 to-white/10 rounded-t flex-1"
                    style={{ height: `${Math.random() * 80 + 20}%` }}
                  ></div>
                ))}
              </div>
            </motion.div>
          </SkeletonBase>
        );

      case "table":
        return (
          <SkeletonBase
            className={`glass-card rounded-xl overflow-hidden ${className}`}
          >
            <motion.div
              className={baseClasses}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div className="bg-gradient-to-r from-white/10 to-white/5 p-4">
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded"
                    ></div>
                  ))}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div
                        key={j}
                        className="h-3 bg-gradient-to-r from-white/15 to-white/5 rounded"
                      ></div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </SkeletonBase>
        );

      case "avatar":
        return (
          <SkeletonBase className={className}>
            <motion.div
              className={`${baseClasses} rounded-full bg-gradient-to-r from-white/20 to-white/10`}
              style={{
                width: width || "40px",
                height: height || "40px",
              }}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          </SkeletonBase>
        );

      case "text":
      default:
        return (
          <SkeletonBase className={className}>
            <motion.div
              className={`${baseClasses} space-y-2`}
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <div
                className="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded"
                style={{ width: width || "100%" }}
              ></div>
              <div className="h-4 bg-gradient-to-r from-white/15 to-white/5 rounded w-5/6"></div>
              <div className="h-4 bg-gradient-to-r from-white/15 to-white/5 rounded w-4/6"></div>
            </motion.div>
          </SkeletonBase>
        );
    }
  };

  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          {renderSkeleton()}
        </motion.div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
