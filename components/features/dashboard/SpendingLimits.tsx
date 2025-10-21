'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SpendingLimitsProps {
  dailyUsed: number;
  dailyTransactionLimit: number;
}

const SpendingLimits: React.FC<SpendingLimitsProps> = ({
  dailyUsed,
  dailyTransactionLimit
}) => {
  const dailyPercentage = Math.round((dailyUsed / dailyTransactionLimit) * 100);

  return (
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
          <p className="text-white font-medium text-sm lg:text-base">{dailyPercentage}%</p> 
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
  );
};

export default SpendingLimits;