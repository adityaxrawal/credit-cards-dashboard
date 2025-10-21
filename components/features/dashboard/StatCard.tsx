'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend: 'up' | 'down' | 'neutral';
  index: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  trend,
  index,
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-error';
      default:
        return 'text-text-muted';
    }
  };

  return (
    <motion.div
      className="bg-card-bg rounded-xl p-6 shadow-lg border border-gray-700/30 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -2, scale: 1.02 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            {title}
          </p>
          <p className="text-2xl font-bold text-text-primary mt-2">
            {value}
          </p>
        </div>
        <div className="h-12 w-12 bg-accent-mint/20 rounded-lg flex items-center justify-center">
          <Icon className="h-6 w-6 text-accent-mint" />
        </div>
      </div>
      <div className="mt-4">
        <span className={`text-sm font-medium ${getTrendColor()}`}>
          {change}
        </span>
        <span className="text-sm text-text-muted ml-2">
          vs last month
        </span>
      </div>
    </motion.div>
  );
};

export default StatCard;