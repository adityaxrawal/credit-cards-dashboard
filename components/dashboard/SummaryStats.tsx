"use client";

import React from 'react';
import { motion } from 'framer-motion';

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
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, amount, color, bgColor, icon }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={`${bgColor} rounded-2xl p-4 lg:p-6 relative overflow-hidden`}
    >
      {/* Background Icon */}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4 text-4xl lg:text-6xl opacity-10">
        {icon}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full ${color} flex items-center justify-center mb-3 lg:mb-4`}>
          <span className="text-lg lg:text-2xl">{icon}</span>
        </div>
        
        <p className="text-white/80 text-xs lg:text-sm mb-2">{title}</p>
        <p className="text-xl lg:text-2xl font-bold text-white">
          ${amount.toLocaleString()}
        </p>
      </div>
    </motion.div>
  );
};

const SummaryStats: React.FC<SummaryStatsProps> = ({
  totalEarnings,
  totalSpendings,
  spendingGoal,
}) => {
  const stats = [
    {
      title: "Total earnings",
      amount: totalEarnings,
      color: "bg-cred-blue/20",
      bgColor: "bg-cred-blue/10 border border-cred-blue/20",
      icon: "📈",
    },
    {
      title: "Total spendings",
      amount: totalSpendings,
      color: "bg-cred-purple/20",
      bgColor: "bg-cred-purple/10 border border-cred-purple/20",
      icon: "💳",
    },
    {
      title: "Spending Goal",
      amount: spendingGoal,
      color: "bg-cred-pink/20",
      bgColor: "bg-cred-pink/10 border border-cred-pink/20",
      icon: "🎯",
    },
  ];

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
};

export default SummaryStats;