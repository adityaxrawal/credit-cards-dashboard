"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { getBankColor } from '@/lib/theme';

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
  variant?: 'default' | 'compact' | 'detailed';
  showRewards?: boolean;
  showCreditLimit?: boolean;
}

const CreditCard: React.FC<CreditCardProps> = ({
  card,
  currentDue,
  dueDate,
  onClick,
  className = '',
  variant = 'default',
  showRewards = false,
  showCreditLimit = false,
}) => {
  const gradientClass = getBankColor(card.bank_name);
  
  const formatCardNumber = (lastFour: string) => {
    return `•••• •••• •••• ${lastFour}`;
  };

  const formatDueDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getCreditUtilization = () => {
    if (!card.credit_limit || !card.available_credit) return 0;
    return ((card.credit_limit - card.available_credit) / card.credit_limit) * 100;
  };

  const getCardTypeIcon = () => {
    switch (card.card_type.toLowerCase()) {
      case 'visa':
        return (
          <div className="text-2xl font-bold text-white/90 tracking-wider">
            VISA
          </div>
        );
      case 'mastercard':
        return (
          <div className="flex items-center space-x-1">
            <div className="w-7 h-7 bg-red-500 rounded-full opacity-90"></div>
            <div className="w-7 h-7 bg-yellow-400 rounded-full opacity-90 -ml-4"></div>
          </div>
        );
      case 'rupay':
        return (
          <div className="text-xl font-bold text-white/90">
            RuPay
          </div>
        );
      case 'american express':
        return (
          <div className="text-lg font-bold text-white/90">
            AMEX
          </div>
        );
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
    tap: { scale: 0.98 }
  };

  if (variant === 'compact') {
    return (
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`
          relative overflow-hidden rounded-xl p-4 cursor-pointer
          bg-gradient-to-br ${gradientClass}
          glass-card glass-card-hover
          ${className}
        `}
        onClick={onClick}
      >
        <div className="absolute inset-0 shimmer opacity-20"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-semibold text-white">{card.bank_name}</h4>
              <p className="text-xs text-white/70">{formatCardNumber(card.card_last_4)}</p>
            </div>
            {getCardTypeIcon()}
          </div>
          {currentDue && (
            <div className="mt-2 text-right">
              <p className="text-lg font-bold text-white">₹{currentDue.toLocaleString()}</p>
            </div>
          )}
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
        relative overflow-hidden rounded-2xl p-6 cursor-pointer
        bg-gradient-to-br ${gradientClass}
        glass-card glass-card-hover
        transform-gpu perspective-1000
        ${className}
      `}
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${gradientClass.replace('from-', '').replace('to-', ', ')})`,
      }}
    >
      {/* Enhanced Shimmer Effect */}
      <motion.div 
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Glassmorphism Overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
      
      {/* Decorative Elements */}
      <div className="absolute top-4 right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-4 left-4 w-12 h-12 bg-white/5 rounded-full blur-lg"></div>
      
      {/* Card Content */}
      <div className="relative z-10">
        {/* Bank Name and Card Type */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <motion.h3 
              className="text-lg font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {card.bank_name}
            </motion.h3>
            <motion.p 
              className="text-sm text-white/70 capitalize"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {card.card_type} Card
            </motion.p>
          </div>
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
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xl font-mono text-white tracking-wider">
            {formatCardNumber(card.card_last_4)}
          </p>
        </motion.div>

        {/* Credit Limit Progress Bar */}
        {showCreditLimit && card.credit_limit && card.available_credit && (
          <motion.div 
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>Credit Used</span>
              <span>{getCreditUtilization().toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <motion.div 
                className="bg-white/80 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${getCreditUtilization()}%` }}
                transition={{ delay: 0.6, duration: 1 }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/70 mt-1">
              <span>₹{(card.credit_limit - card.available_credit).toLocaleString()}</span>
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
            <p className="text-sm font-medium text-white">
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
              <p className="text-xs text-white/60 uppercase tracking-wide mb-1">
                Due Amount
              </p>
              <p className="text-lg font-bold text-white">
                ₹{currentDue.toLocaleString()}
              </p>
              <p className="text-xs text-white/70">
                Due {formatDueDate(dueDate)}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CreditCard;