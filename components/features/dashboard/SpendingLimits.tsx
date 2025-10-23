'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, CheckCircle, Target, CreditCard } from 'lucide-react';

interface SpendingLimitsProps {
  dailyUsed: number;
  dailyTransactionLimit: number;
}

const SpendingLimits: React.FC<SpendingLimitsProps> = ({
  dailyUsed,
  dailyTransactionLimit
}) => {
  const dailyPercentage = Math.round((dailyUsed / dailyTransactionLimit) * 100);
  
  // Determine status and colors based on percentage
  const getStatusInfo = (percentage: number) => {
    if (percentage >= 90) {
      return {
        status: 'Critical',
        icon: AlertTriangle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        progressColor: 'from-red-500 to-red-600'
      };
    } else if (percentage >= 75) {
      return {
        status: 'Warning',
        icon: TrendingUp,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        progressColor: 'from-yellow-500 to-orange-500'
      };
    } else if (percentage >= 50) {
      return {
        status: 'Moderate',
        icon: Target,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        progressColor: 'from-blue-500 to-purple-500'
      };
    } else {
      return {
        status: 'Good',
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        progressColor: 'from-green-500 to-emerald-500'
      };
    }
  };

  const statusInfo = getStatusInfo(dailyPercentage);
  const StatusIcon = statusInfo.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, delay: 0.1 }} 
      className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 group" 
    > 
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
            <CreditCard className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
              Spending Limits
            </h3>
            <p className="text-gray-400 text-sm">Daily transaction monitoring</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
          <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
          <span className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.status}
          </span>
        </div>
      </div>

      {/* Daily Transaction Limit Section */} 
      <div className="space-y-4"> 
        {/* Header with percentage */}
        <div className="flex justify-between items-center"> 
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
            <p className="text-white/90 text-sm font-medium tracking-wide">
              DAILY TRANSACTION LIMIT
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-white font-bold text-lg">{dailyPercentage}%</span>
            <div className={`w-2 h-2 rounded-full ${dailyPercentage > 75 ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></div>
          </div>
        </div> 
        
        {/* Amount Information */}
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Amount Used</span>
            <span className="text-white font-semibold">₹{dailyUsed.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total Limit</span>
            <span className="text-gray-300 font-medium">₹{dailyTransactionLimit.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Enhanced Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden shadow-inner"> 
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${dailyPercentage}%` }} 
              transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }} 
              className={`bg-gradient-to-r ${statusInfo.progressColor} h-3 rounded-full relative shadow-lg`}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </motion.div> 
          </div>
          
          {/* Progress indicators */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span className="text-yellow-400">75%</span>
            <span className="text-red-400">90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Remaining Amount */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-800/40 to-gray-700/40 rounded-lg border border-gray-600/30"
        >
          <span className="text-gray-300 text-sm">Remaining Today</span>
          <span className="text-green-400 font-semibold">
            ₹{(dailyTransactionLimit - dailyUsed).toLocaleString()}
          </span>
        </motion.div>
      </div> 
    </motion.div>
  );
};

export default SpendingLimits;