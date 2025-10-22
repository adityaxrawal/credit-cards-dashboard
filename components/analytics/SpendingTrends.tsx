'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/shared/ui';
import Button from '@/components/ui/Button';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, parseISO } from 'date-fns';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';

interface SpendingTrendsData {
  monthlySpending: Array<{
    month: string;
    amount: number;
    transactionCount: number;
  }>;
  categoryTrends: Array<{
    category: string;
    currentMonth: number;
    previousMonth: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  spendingVelocity: {
    dailyAverage: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
  };
  insights: {
    highestSpendingMonth: string;
    lowestSpendingMonth: string;
    averageMonthlySpending: number;
    totalSpending: number;
  };
}

interface SpendingTrendsProps {
  cardId?: string;
  className?: string;
}

export default function SpendingTrends({ cardId, className }: SpendingTrendsProps) {
  const [data, setData] = useState<SpendingTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('6');
  const [viewType, setViewType] = useState<'amount' | 'count'>('amount');

  const fetchSpendingTrends = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        period: period
      });

      if (cardId) {
        params.append('cardId', cardId);
      }

      const response = await fetch(`/api/analytics/spending-trends?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch spending trends');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpendingTrends();
  }, [period, cardId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    try {
      return format(parseISO(monthStr + '-01'), 'MMM yyyy');
    } catch {
      return monthStr;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs';
      case 'down':
        return 'text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs';
      default:
        return 'text-gray-600 bg-gray-50 px-2 py-1 rounded-full text-xs';
    }
  };

  if (loading) {
    return (
      <Card className={`glass-card ${className}`}>
        <div className="p-6">
          <LoadingSkeleton type="chart" count={1} className="h-64" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`glass-card ${className}`}>
        <div className="flex items-center justify-center h-64 p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Failed to load spending trends</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            <Button onClick={fetchSpendingTrends} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const chartData = data.monthlySpending.map(item => ({
    month: formatMonth(item.month),
    amount: item.amount,
    count: item.transactionCount
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`glass-card ${className}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Spending Trends
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                Analyze your spending patterns and velocity over time
              </p>
            </div>
            <div className="flex gap-2">
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">1 Year</option>
              </select>
              <select 
                value={viewType} 
                onChange={(e) => setViewType(e.target.value as 'amount' | 'count')}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="amount">Amount</option>
                <option value="count">Count</option>
              </select>
            </div>
          </div>

          {/* Main Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#fff' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  stroke="rgba(255,255,255,0.3)"
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#fff' }}
                  tickFormatter={viewType === 'amount' ? formatCurrency : undefined}
                  stroke="rgba(255,255,255,0.3)"
                />
                <Tooltip 
                  formatter={(value: number) => [
                    viewType === 'amount' ? formatCurrency(value) : value,
                    viewType === 'amount' ? 'Amount' : 'Transactions'
                  ]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={viewType}
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Total Spending</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(data.insights.totalSpending)}
              </p>
            </div>
            
            <div className="bg-green-500/20 p-4 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Daily Average</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(data.spendingVelocity.dailyAverage)}
              </p>
            </div>
            
            <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Monthly Growth</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.spendingVelocity.monthlyGrowth > 0 ? '+' : ''}
                {(data.spendingVelocity.monthlyGrowth || 0).toFixed(1)}%
              </p>
            </div>
            
            <div className="bg-orange-500/20 p-4 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">Avg Monthly</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(data.insights.averageMonthlySpending)}
              </p>
            </div>
          </div>

          {/* Category Trends */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Category Trends</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.categoryTrends.slice(0, 6).map((category) => (
                <div key={category.category} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize text-white">{category.category}</span>
                    {getTrendIcon(category.trend)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-300">
                      Current: {formatCurrency(category.currentMonth)}
                    </p>
                    <p className="text-sm text-gray-300">
                      Previous: {formatCurrency(category.previousMonth)}
                    </p>
                    <span className={getTrendColor(category.trend)}>
                      {category.percentageChange > 0 ? '+' : ''}
                      {(category.percentageChange || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Highest spending month:</span>
                <p className="text-gray-300">{formatMonth(data.insights.highestSpendingMonth)}</p>
              </div>
              <div>
                <span className="font-medium text-white">Lowest spending month:</span>
                <p className="text-gray-300">{formatMonth(data.insights.lowestSpendingMonth)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}