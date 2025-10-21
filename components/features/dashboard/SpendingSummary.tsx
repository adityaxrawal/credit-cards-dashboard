"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  AlertTriangle,
  ShoppingBag,
  Car,
  Utensils,
  Plane,
  Coffee,
  Home,
  MoreHorizontal
} from 'lucide-react';
import { 
  getSampleDashboardSummary, 
  getSampleSpendingLimits,
  getSampleCreditCards,
  type DashboardSummary,
  type SpendingLimit 
} from '@/lib/sampleData';

interface SpendingSummaryProps {
  className?: string;
}

const SpendingSummary: React.FC<SpendingSummaryProps> = ({ className = '' }) => {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    const fetchData = async () => {
      setIsLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const summary = getSampleDashboardSummary();
      const limits = getSampleSpendingLimits();
      const cards = getSampleCreditCards();
      
      setDashboardData(summary);
      setSpendingLimits(limits);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'Shopping': ShoppingBag,
      'Transportation': Car,
      'Food & Dining': Utensils,
      'Travel': Plane,
      'Coffee': Coffee,
      'Bills': Home,
      'Entertainment': MoreHorizontal,
      'Groceries': ShoppingBag,
      'Gas': Car,
      'Other': MoreHorizontal
    };
    
    return icons[category] || MoreHorizontal;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'from-red-500 to-red-600';
    if (percentage >= 75) return 'from-yellow-500 to-orange-500';
    if (percentage >= 50) return 'from-blue-500 to-purple-500';
    return 'from-green-500 to-emerald-500';
  };

  const getAlertLevel = (currentSpent: number, limit: number) => {
    const percentage = (currentSpent / limit) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  if (isLoading) {
    return (
      <div className={`glass-card rounded-2xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Spending Overview</h2>
          <div className="flex items-center space-x-2 text-sm">
            {dashboardData.monthlySpending.change_percentage > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-400" />
            )}
            <span className={`font-medium ${
              dashboardData.monthlySpending.change_percentage > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {Math.abs(dashboardData.monthlySpending.change_percentage)}%
            </span>
          </div>
        </div>

        {/* Monthly Spending Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-accent-mint/20 to-accent-purple/20 border border-accent-mint/30 rounded-xl p-4"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent-mint/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-accent-mint" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">This Month</p>
                <p className="text-white text-lg font-semibold">
                  ₹{dashboardData.monthlySpending.current_month.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-gray-600/20 to-gray-700/20 border border-gray-500/30 rounded-xl p-4"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Last Month</p>
                <p className="text-white text-lg font-semibold">
                  ₹{dashboardData.monthlySpending.previous_month.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-accent-green/20 to-accent-mint/20 border border-accent-green/30 rounded-xl p-4"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-green" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Available Credit</p>
                <p className="text-white text-lg font-semibold">
                  ₹{dashboardData.totalAvailableCredit.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {dashboardData.categoryWiseSpending.slice(0, 5).map((category, index) => {
              const Icon = getCategoryIcon(category.category);
              
              return (
                <motion.div
                  key={category.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-600/30 to-gray-700/30 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-300" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{category.category}</p>
                      <p className="text-gray-400 text-sm">{category.transactions} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">₹{category.amount.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">{category.percentage}%</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Spending Limits */}
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Spending Limits</h3>
          <div className="space-y-4">
            {spendingLimits.filter(limit => limit.is_active).slice(0, 4).map((limit, index) => {
              const percentage = (limit.current_spent / limit.monthly_limit) * 100;
              const alertLevel = getAlertLevel(limit.current_spent, limit.monthly_limit);
              const Icon = getCategoryIcon(limit.category);
              
              return (
                <motion.div
                  key={limit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className={`p-4 rounded-xl border ${
                    alertLevel === 'critical' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : alertLevel === 'warning'
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-gray-800/30 border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-600/30 to-gray-700/30 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-gray-300" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{limit.category}</p>
                        <p className="text-gray-400 text-sm">
                          ₹{limit.current_spent.toLocaleString()} of ₹{limit.monthly_limit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {alertLevel === 'critical' && (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(percentage, 100)}%` }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 0.8 }}
                        className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor(percentage)}`}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-gray-400">0%</span>
                      <span className={`font-medium ${
                        alertLevel === 'critical' ? 'text-red-400' : 
                        alertLevel === 'warning' ? 'text-yellow-400' : 'text-gray-300'
                      }`}>
                        {percentage.toFixed(1)}%
                      </span>
                      <span className="text-gray-400">100%</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SpendingSummary;