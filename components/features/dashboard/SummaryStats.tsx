"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CreditCard, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from '@/components/shared/ui';
import { formatCurrency } from '@/lib/utils';

interface SummaryStatsProps {
  totalEarnings: number;
  totalSpendings: number;
  spendingGoal: number;
}

interface StatCardProps {
  title: string;
  amount: number;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard = React.memo<StatCardProps>(({ title, amount, color, bgColor, icon: Icon, trend }) => {
  return (
    <Card
      variant="glass"
      size="lg"
      padding="lg"
      hover
      className={`${bgColor} relative overflow-hidden backdrop-blur-sm border border-white/10`}
    >
      {/* Shimmer Effect */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shimmer" />
      </div>

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />

      {/* Background Icon */}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4 opacity-10">
        <Icon size={48} className="lg:w-16 lg:h-16" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
            <Icon size={20} className="lg:w-6 lg:h-6 text-white" />
          </div>
          
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend.isPositive 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {trend.isPositive ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-white/70 text-xs lg:text-sm font-medium tracking-wide uppercase">
            {title}
          </p>
          <p className="text-xl lg:text-3xl font-bold text-white tracking-tight">
            {formatCurrency(amount)}
          </p>
        </div>
      </div>

      {/* Bottom Accent Line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${color.replace('/20', '')} opacity-60`} />
    </Card>
  );
});

StatCard.displayName = 'StatCard';

const SummaryStats = React.memo<SummaryStatsProps>(({
  totalEarnings,
  totalSpendings,
  spendingGoal,
}) => {
  const stats = useMemo(() => [
    {
      title: "Total earnings",
      amount: totalEarnings,
      color: "bg-accent-mint/20",
      bgColor: "bg-accent-mint/10 border border-accent-mint/20",
      icon: TrendingUp,
      trend: { value: 12.5, isPositive: true },
    },
    {
      title: "Total spendings",
      amount: totalSpendings,
      color: "bg-accent-purple/20",
      bgColor: "bg-accent-purple/10 border border-accent-purple/20",
      icon: CreditCard,
      trend: { value: 8.2, isPositive: false },
    },
    {
      title: "Spending Goal",
      amount: spendingGoal,
      color: "bg-accent-orange/20",
      bgColor: "bg-accent-orange/10 border border-accent-orange/20",
      icon: Target,
      trend: { value: 5.7, isPositive: true },
    },
  ], [totalEarnings, totalSpendings, spendingGoal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4"
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <StatCard {...stat} />
        </motion.div>
      ))}
    </motion.div>
  );
});

SummaryStats.displayName = 'SummaryStats';

export default SummaryStats;