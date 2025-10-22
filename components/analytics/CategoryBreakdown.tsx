'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/shared/ui';
import Button from '@/components/ui/Button';
import { PieChart, BarChart3, TrendingUp, TrendingDown, Filter, AlertCircle } from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';

interface CategoryData {
  category: string;
  amount: number;
  transactionCount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  averageTransaction: number;
  color: string;
}

interface CategoryBreakdownData {
  categories: CategoryData[];
  totalSpending: number;
  topCategory: string;
  mostTransactions: string;
  insights: {
    diversityScore: number;
    concentrationRisk: number;
    emergingCategories: string[];
    decliningCategories: string[];
  };
}

interface CategoryBreakdownProps {
  cardId?: string;
  period?: string;
  className?: string;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
];

export default function CategoryBreakdown({ cardId, period = '3', className }: CategoryBreakdownProps) {
  const [data, setData] = useState<CategoryBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');
  const [sortBy, setSortBy] = useState<'amount' | 'count' | 'trend'>('amount');

  const fetchCategoryBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        period: period
      });

      if (cardId) {
        params.append('cardId', cardId);
      }

      const response = await fetch(`/api/analytics/category-breakdown?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch category breakdown');
      }

      const result = await response.json();
      
      // Add colors to categories - check if categories exists and is an array
      const categoriesWithColors = (result.categories && Array.isArray(result.categories)) 
        ? result.categories.map((cat: CategoryData, index: number) => ({
            ...cat,
            color: COLORS[index % COLORS.length]
          }))
        : [];

      setData({
        ...result,
        categories: categoriesWithColors
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryBreakdown();
  }, [period, cardId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getSortedCategories = () => {
    if (!data) return [];
    
    const sorted = [...data.categories];
    switch (sortBy) {
      case 'amount':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'count':
        return sorted.sort((a, b) => b.transactionCount - a.transactionCount);
      case 'trend':
        return sorted.sort((a, b) => b.percentageChange - a.percentageChange);
      default:
        return sorted;
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
            <p className="text-red-600 font-medium">Failed to load category breakdown</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            <Button onClick={fetchCategoryBreakdown} className="mt-4">
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

  const sortedCategories = getSortedCategories();
  const chartData = sortedCategories.slice(0, 8); // Show top 8 categories

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
                <PieChart className="h-5 w-5" />
                Category Breakdown
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                Analyze spending distribution across categories
              </p>
            </div>
            <div className="flex gap-2">
              <select 
                value={viewType} 
                onChange={(e) => setViewType(e.target.value as 'pie' | 'bar')}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="pie">Pie Chart</option>
                <option value="bar">Bar Chart</option>
              </select>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'amount' | 'count' | 'trend')}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="amount">By Amount</option>
                <option value="count">By Count</option>
                <option value="trend">By Trend</option>
              </select>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'pie' ? (
                <RechartsPieChart>
                  <RechartsPieChart data={chartData} cx="50%" cy="50%" outerRadius={80} dataKey="amount">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </RechartsPieChart>
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 12, fill: '#fff' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    stroke="rgba(255,255,255,0.3)"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#fff' }}
                    tickFormatter={formatCurrency}
                    stroke="rgba(255,255,255,0.3)"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Category List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Category Details</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {sortedCategories.map((category) => (
                <div key={category.category} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium capitalize text-white">{category.category}</span>
                      {getTrendIcon(category.trend)}
                    </div>
                    <span className={getTrendColor(category.trend)}>
                      {category.percentageChange > 0 ? '+' : ''}
                      {(category.percentageChange || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-300">Amount:</span>
                      <p className="text-white font-medium">{formatCurrency(category.amount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Percentage:</span>
                      <p className="text-white font-medium">{(category.percentage || 0).toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Transactions:</span>
                      <p className="text-white font-medium">{category.transactionCount}</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Avg/Transaction:</span>
                      <p className="text-white font-medium">{formatCurrency(category.averageTransaction)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Top Category</span>
              </div>
              <p className="text-lg font-bold text-white capitalize">
                {data.topCategory}
              </p>
            </div>
            
            <div className="bg-green-500/20 p-4 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Most Active</span>
              </div>
              <p className="text-lg font-bold text-white capitalize">
                {data.mostTransactions}
              </p>
            </div>
            
            <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Diversity Score</span>
              </div>
              <p className="text-lg font-bold text-white">
                {(data.insights.diversityScore || 0).toFixed(1)}/10
              </p>
            </div>
            
            <div className="bg-orange-500/20 p-4 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">Risk Score</span>
              </div>
              <p className="text-lg font-bold text-white">
                {(data.insights.concentrationRisk || 0).toFixed(1)}/10
              </p>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Category Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Emerging Categories:</span>
                <p className="text-gray-300">
                  {data.insights.emergingCategories.length > 0 
                    ? data.insights.emergingCategories.join(', ')
                    : 'None detected'
                  }
                </p>
              </div>
              <div>
                <span className="font-medium text-white">Declining Categories:</span>
                <p className="text-gray-300">
                  {data.insights.decliningCategories.length > 0 
                    ? data.insights.decliningCategories.join(', ')
                    : 'None detected'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}