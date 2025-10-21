"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Plus } from 'lucide-react';

interface CardDetails {
  id: string;
  bank_name: string;
  card_number: string;
  card_holder_name: string;
  expiry_date: string;
  cvv: string;
  level: string;
}

interface DetailsCardProps {
  card?: CardDetails;
  currentSpending?: number;
  spendingLimit?: number;
}

const DetailsCard: React.FC<DetailsCardProps> = ({
  card,
  currentSpending = 400,
  spendingLimit = 2000,
}) => {
  const spendingPercentage = (currentSpending / spendingLimit) * 100;
  const dailyTransactionLimit = 1000;
  const dailyUsed = 400;
  const dailyPercentage = (dailyUsed / dailyTransactionLimit) * 100;

  if (!card) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <div className="glass-card rounded-2xl p-4 lg:p-6 text-center">
          <p className="text-white/60 text-sm lg:text-base">Select a card to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Details Card Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-4 lg:p-6"
      >
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-semibold text-white">Details card</h2>
          <div className="flex items-center space-x-1 lg:space-x-2">
            <button className="text-white/60 hover:text-white transition-colors">
              <Plus size={18} className="lg:w-5 lg:h-5" />
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <MoreHorizontal size={18} className="lg:w-5 lg:h-5" />
            </button>
          </div>
        </div>

        {/* Credit Card Display */}
        <div className="relative">
          <div className="bg-gradient-to-br from-cred-green to-emerald-400 rounded-2xl p-4 lg:p-6 text-white relative overflow-hidden">
            {/* Card Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-3 right-3 lg:top-4 lg:right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-full border-2 border-white"></div>
              <div className="absolute top-6 right-6 lg:top-8 lg:right-8 w-16 h-16 lg:w-24 lg:h-24 rounded-full border border-white"></div>
            </div>

            {/* Card Content */}
            <div className="relative z-10">
              {/* Bank Name */}
              <div className="flex justify-between items-start mb-6 lg:mb-8">
                <div>
                  <p className="text-xs lg:text-sm opacity-80 mb-1">CARD NUMBER</p>
                  <p className="text-base lg:text-lg font-mono tracking-wider">
                    {card.card_number}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl lg:text-2xl font-bold">VISA</div>
                </div>
              </div>

              {/* Card Details */}
              <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-3 lg:mb-4">
                <div>
                  <p className="text-xs opacity-60 uppercase tracking-wide mb-1">Expire Date</p>
                  <p className="font-medium text-sm lg:text-base">{card.expiry_date}</p>
                </div>
                <div>
                  <p className="text-xs opacity-60 uppercase tracking-wide mb-1">CVV</p>
                  <p className="font-medium text-sm lg:text-base">{card.cvv}</p>
                </div>
                <div>
                  <p className="text-xs opacity-60 uppercase tracking-wide mb-1">Level</p>
                  <p className="font-medium text-sm lg:text-base">{card.level}</p>
                </div>
              </div>

              {/* Cardholder Name */}
              <div>
                <p className="text-xs opacity-60 uppercase tracking-wide mb-1">Cardholder Name</p>
                <p className="font-medium text-sm lg:text-base">{card.card_holder_name}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Spending Limits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-card rounded-2xl p-4 lg:p-6"
      >
        <h3 className="text-base lg:text-lg font-semibold text-white mb-4 lg:mb-6">Spending limits</h3>

        {/* Daily Transaction Limit */}
        <div className="mb-4 lg:mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-white/80 text-xs lg:text-sm">DAILY TRANSACTION LIMIT</p>
            <p className="text-white font-medium text-sm lg:text-base">20%</p>
          </div>
          <p className="text-white/60 text-xs lg:text-sm mb-3">
            ₹{dailyUsed.toLocaleString()} used of ₹{dailyTransactionLimit.toLocaleString()}
          </p>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyPercentage}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="bg-gradient-to-r from-cred-purple to-cred-pink h-2 rounded-full"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DetailsCard;