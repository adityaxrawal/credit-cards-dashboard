"use client";

import React from "react";
import { motion } from "framer-motion";
import { getBankColor, getBankColorScheme } from "@/lib/theme";

export interface CreditCardProps {
  card: {
    id: string;
    bank_name: string;
    card_last_4: string;
    card_holder_name: string;
    card_type: string;
    credit_limit?: number;
    available_credit?: number;
    reward_points?: number;
  };
  currentDue?: number;
  dueDate?: Date;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "compact" | "detailed";
  showRewards?: boolean;
  showCreditLimit?: boolean;
}

const CreditCard: React.FC<CreditCardProps> = ({
  card,
  currentDue,
  dueDate,
  onClick,
  className = "",
  variant = "default",
  showRewards = false,
  showCreditLimit = false,
}) => {
  const gradientClass = getBankColor(card.bank_name);
  const colorScheme = getBankColorScheme(card.bank_name);

  const formatCardNumber = (lastFour: string) => {
    return `•••• •••• •••• ${lastFour}`;
  };

  const formatDueDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getCreditUtilization = () => {
    if (!card.credit_limit || !card.available_credit) return 0;
    return (
      ((card.credit_limit - card.available_credit) / card.credit_limit) * 100
    );
  };

  const getCardTypeIcon = () => {
    switch (card.card_type.toLowerCase()) {
      case "visa":
        return (
          <div className="text-2xl font-bold text-white/90 tracking-wider">
            VISA
          </div>
        );
      case "mastercard":
        return (
          <div className="flex items-center space-x-1">
            <div className="w-7 h-7 bg-red-500 rounded-full opacity-90"></div>
            <div className="w-7 h-7 bg-yellow-400 rounded-full opacity-90 -ml-4"></div>
          </div>
        );
      case "rupay":
        return <div className="text-xl font-bold text-white/90">RuPay</div>;
      case "american express":
        return <div className="text-lg font-bold text-white/90">AMEX</div>;
      default:
        return null;
    }
  };

  const cardVariants = {
    hover: {
      scale: 1.02,
      y: -6,
      rotateX: 5,
      rotateY: 5,
    },
    tap: { scale: 0.98 },
  };

  if (variant === "compact") {
    return (
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`
          relative overflow-hidden rounded-2xl p-6 cursor-pointer
          bg-gradient-to-br ${gradientClass}
          shadow-xl shadow-black/20
          ${className}
        `}
        onClick={onClick}
      >
        {/* Card Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-white"></div>
          <div className="absolute top-8 right-8 w-24 h-24 rounded-full border border-white"></div>
        </div>

        {/* Chip */}
        <div className="absolute top-6 left-6">
          <div className="w-12 h-9 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-lg shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-yellow-200/50 to-transparent rounded-lg">
              <div className="grid grid-cols-4 gap-0.5 p-1.5 h-full">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="bg-yellow-600/30 rounded-sm"></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-16">
          {/* Card Type */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
                {card.card_type} Card
              </p>
              <h4 className="text-lg font-semibold text-white">
                {card.bank_name}
              </h4>
            </div>
            <div className="text-right">
              {getCardTypeIcon()}
            </div>
          </div>

          {/* Card Number */}
          <div className="mb-6">
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
              Card Number
            </p>
            <p className="text-xl font-mono text-white tracking-wider">
              {formatCardNumber(card.card_last_4)}
            </p>
          </div>

          {/* Bottom Row */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
                Cardholder Name
              </p>
              <p className="text-sm font-medium text-white">
                {card.card_holder_name}
              </p>
            </div>
            {currentDue && (
              <div className="text-right">
                <p className="text-xs text-white/60 mb-1">Due Amount</p>
                <p className="text-lg font-bold text-white">
                  ₹{currentDue.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      whileHover="hover"
      whileTap="tap"
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        relative overflow-hidden rounded-2xl p-8 cursor-pointer
        bg-gradient-to-br ${gradientClass}
        shadow-xl shadow-black/20
        ${className}
      `}
      onClick={onClick}
    >
      {/* Card Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-6 right-6 w-40 h-40 rounded-full border-2 border-white"></div>
        <div className="absolute top-12 right-12 w-28 h-28 rounded-full border border-white"></div>
      </div>

      {/* Chip */}
      <div className="absolute top-8 left-8">
        <div className="w-14 h-11 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-lg shadow-lg">
          <div className="w-full h-full bg-gradient-to-br from-yellow-200/50 to-transparent rounded-lg">
            <div className="grid grid-cols-4 gap-0.5 p-2 h-full">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="bg-yellow-600/30 rounded-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pt-20">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
              {card.card_type} Card
            </p>
            <motion.h3
              className="text-xl font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {card.bank_name}
            </motion.h3>
          </motion.div>
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {getCardTypeIcon()}
          </motion.div>
        </div>

        {/* Card Number */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2">
            Card Number
          </p>
          <p className="text-2xl font-mono text-white tracking-wider">
            {formatCardNumber(card.card_last_4)}
          </p>
        </motion.div>

        {/* Credit Limit Progress Bar */}
        {showCreditLimit && card.credit_limit && card.available_credit && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span>Credit Used</span>
              <span>{(getCreditUtilization() || 0).toFixed(1)}%</span>
            </div>
            <div className="bg-white/20 h-2 rounded-full overflow-hidden">
              <motion.div
                className="bg-white/80 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${getCreditUtilization()}%` }}
                transition={{ delay: 0.6, duration: 1 }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/70 mt-1">
              <span>
                ₹{(card.credit_limit - card.available_credit).toLocaleString()}
              </span>
              <span>₹{card.credit_limit.toLocaleString()}</span>
            </div>
          </motion.div>
        )}

        {/* Bottom Section */}
        <div className="flex justify-between items-end">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
              Cardholder Name
            </p>
            <p className="text-base font-medium text-white">
              {card.card_holder_name}
            </p>
            {showRewards && card.reward_points && (
              <p className="text-xs text-white/70 mt-1">
                {card.reward_points.toLocaleString()} points
              </p>
            )}
          </motion.div>

          {currentDue && dueDate && (
            <motion.div
              className="text-right"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <p className="text-xs text-white/60 mb-1">
                Due {formatDueDate(dueDate)}
              </p>
              <p className="text-xl font-bold text-white">
                ₹{currentDue.toLocaleString()}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CreditCard;
