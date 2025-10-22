"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/shared/ui';
import { formatCurrency } from '@/lib/utils';

interface SpendingData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  transactions: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

interface MonthlyData {
  month: string;
  spending: number;
  budget: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

interface SpendingChartProps {
  className?: string;
}

const SpendingChart = React.memo<SpendingChartProps>(({ className = '' }) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');

  // Sample spending data by category - memoized for performance
  const categoryData: SpendingData[] = useMemo(() => [
    { category: 'Food & Dining', amount: 1250, percentage: 35, color: '#4ECDC4', transactions: 24 },
    { category: 'Shopping', amount: 890, percentage: 25, color: '#A855F7', transactions: 18 },
    { category: 'Transportation', amount: 540, percentage: 15, color: '#10B981', transactions: 12 },
    { category: 'Entertainment', amount: 430, percentage: 12, color: '#F97316', transactions: 8 },
    { category: 'Bills & Utilities', amount: 320, percentage: 9, color: '#EF4444', transactions: 6 },
    { category: 'Others', amount: 140, percentage: 4, color: '#6B7280', transactions: 5 }
  ], []);

  // Sample monthly spending data - memoized for performance
  const monthlyData: MonthlyData[] = useMemo(() => [
    { month: 'Jan', spending: 3200, budget: 4000 },
    { month: 'Feb', spending: 2800, budget: 4000 },
    { month: 'Mar', spending: 3600, budget: 4000 },
    { month: 'Apr', spending: 3100, budget: 4000 },
    { month: 'May', spending: 3570, budget: 4000 },
    { month: 'Jun', spending: 3850, budget: 4000 }
  ], []);

  const totalSpending = useMemo(() => 
    categoryData.reduce((sum, item) => sum + item.amount, 0), 
    [categoryData]
  );

  // Memoized event handlers
  const handleChartTypeChange = useCallback((type: 'bar' | 'pie') => {
    setChartType(type);
  }, []);

  const handleTimeRangeChange = useCallback((range: 'month' | 'quarter' | 'year') => {
    setTimeRange(range);
  }, []);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-lg p-3 border border-gray-600/30">
          <p className="text-white font-medium mb-1">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ₹{entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom label for pie chart
  const renderCustomLabel = (props: unknown) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as PieLabelProps;
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="500"
      >
        {`${((percent || 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Spending Analytics</h3>
          <p className="text-gray-400 text-sm">
            Track your spending patterns across categories
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'month' | 'quarter' | 'year')}
            className="bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          {/* Chart Type Toggle */}
          <div className="flex bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-md transition-all duration-200 ${
              chartType === 'bar'
                ? 'bg-accent-mint text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`p-2 rounded-md transition-all duration-200 ${
              chartType === 'pie'
                ? 'bg-accent-mint text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            >
              <PieChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-secondary-bg rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-mint" />
            <span className="text-gray-400 text-sm">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-white">₹{totalSpending.toLocaleString()}</p>
        </div>
        
        <div className="bg-secondary-bg rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-accent-purple" />
            <span className="text-gray-400 text-sm">Transactions</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {categoryData.reduce((sum, item) => sum + item.transactions, 0)}
          </p>
        </div>
        
        <div className="bg-secondary-bg rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Filter className="w-4 h-4 text-accent-orange" />
            <span className="text-gray-400 text-sm">Categories</span>
          </div>
          <p className="text-2xl font-bold text-white">{categoryData.length}</p>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-80 mb-6">
        <AnimatePresence mode="wait">
          {chartType === 'bar' ? (
            <motion.div
              key="bar-chart"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="category" 
                    stroke="#9CA3AF"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          ) : (
            <motion.div
              key="pie-chart"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category Legend */}
      <div className="grid grid-cols-2 gap-3">
        {categoryData.map((item, index) => (
          <motion.div
            key={item.category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white text-sm font-medium">{item.category}</span>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold">₹{item.amount.toLocaleString()}</p>
              <p className="text-gray-400 text-xs">{item.percentage}%</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700/50">
        <div className="text-sm text-gray-400">
          Last updated: {new Date().toLocaleDateString('en-US', { timeZone: 'UTC' })}
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => console.log('Export data')}
          >
            Export Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => console.log('View details')}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
});

SpendingChart.displayName = 'SpendingChart';

export default SpendingChart;