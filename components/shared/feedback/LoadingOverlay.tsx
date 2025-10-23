"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useLoading } from "@/contexts/LoadingContext";

interface LoadingOverlayProps {
  isVisible?: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message,
}) => {
  const { isLoading, loadingMessage } = useLoading();

  // Use props if provided, otherwise use context
  const shouldShow = isVisible !== undefined ? isVisible : isLoading;
  const displayMessage = message || loadingMessage || "Loading...";
  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="glass-card rounded-2xl p-8 flex flex-col items-center space-y-4 max-w-sm mx-4"
          >
            {/* Animated Loader */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
              className="relative"
            >
              <Loader2 size={40} className="text-cred-purple" />

              {/* Outer ring animation */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-cred-pink"
                animate={{ rotate: -360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{
                  width: "48px",
                  height: "48px",
                  top: "-4px",
                  left: "-4px",
                }}
              />
            </motion.div>

            {/* Loading Message */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h3 className="text-white font-medium text-lg mb-1">
                {displayMessage}
              </h3>
              <p className="text-white/60 text-sm">Please wait a moment...</p>
            </motion.div>

            {/* Animated dots */}
            <motion.div
              className="flex space-x-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="w-2 h-2 bg-cred-purple rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: index * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;
