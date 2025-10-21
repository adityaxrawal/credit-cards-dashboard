"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import Button from "./Button";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    sm: {
      container: "p-6",
      iconSize: "w-12 h-12",
      iconContainer: "w-20 h-20",
      title: "text-lg",
      description: "text-sm",
    },
    md: {
      container: "p-8",
      iconSize: "w-16 h-16",
      iconContainer: "w-24 h-24",
      title: "text-xl",
      description: "text-base",
    },
    lg: {
      container: "p-12",
      iconSize: "w-20 h-20",
      iconContainer: "w-28 h-28",
      title: "text-2xl",
      description: "text-lg",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`glass-card rounded-2xl ${currentSize.container} text-center max-w-md mx-auto ${className}`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="mb-6"
      >
        <div
          className={`${currentSize.iconContainer} mx-auto bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-full flex items-center justify-center backdrop-blur-sm border border-gray-600/20`}
        >
          <Icon className={`${currentSize.iconSize} text-gray-400`} />
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`${currentSize.title} font-semibold text-white mb-3`}
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`${currentSize.description} text-gray-300 leading-relaxed mb-6`}
      >
        {description}
      </motion.p>

      {actionLabel && onAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={onAction}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {actionLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EmptyState;
