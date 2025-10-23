'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/shared/ui';
import Button from '@/components/ui/Button';
import { Target, AlertTriangle, CheckCircle, TrendingUp, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';

interface BudgetItem {
  category: string;
  budgetAmount: number;
  actualAmount: number;
  percentage: number;
  status: 'under' | 'near' | 'over';
  remainingAmount: number;
  daysRemaining: number;
  projectedAmount: number;
  trend: 'improving' | 'worsening' | 'stable';
}

interface BudgetComparisonData {
  budgets: BudgetItem[];
  totalBudget: number;
  totalSpent: number;
  overallPercentage: number;
  overallStatus: 'under' | 'near' | 'over';
  insights: {
    categoriesOverBudget: number;
    categoriesNearLimit: number;
    projectedOverspend: number;
    bestPerformingCategory: string;
    worstPerformingCategory: string;
  };
}

interface BudgetComparisonProps {
  cardId?: string;
  period?: string;
  className?: string;
}

export default function BudgetComparison({ cardId, period = 'current', className }: BudgetComparisonProps) {
  const [data, setData] = useState<BudgetComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'chart' | 'list'>('chart');
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const fetchBudgetComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        period: selectedPeriod
      });

      if (cardId) {
        params.append('cardId', cardId);
      }

      const response = await fetch(`/api/analytics/budget-comparison?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch budget comparison');
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
    fetchBudgetComparison();
  }, [selectedPeriod, cardId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: 'under' | 'near' | 'over') => {
    switch (status) {
      case 'under':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'near':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'over':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
    }
  };

  const getStatusIcon = (status: 'under' | 'near' | 'over') => {
    switch (status) {
      case 'under':
        return <CheckCircle className="h-4 w-4" />;
      case 'near':
        return <AlertTriangle className="h-4 w-4" />;
      case 'over':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage <= 75) return 'bg-green-500';
    if (percentage <= 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: 'improving' | 'worsening' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-400 rotate-180" />;
      case 'worsening':
        return <TrendingUp className="h-4 w-4 text-red-400" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
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
            <p className="text-red-600 font-medium">Failed to load budget comparison</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            <Button onClick={fetchBudgetComparison} className="mt-4">
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

  const chartData = data.budgets.map(budget => ({
    category: budget.category,
    budget: budget.budgetAmount,
    actual: budget.actualAmount,
    projected: budget.projectedAmount
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
                <Target className="h-5 w-5" />
                Budget vs Actual
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                Track your spending against budget targets
              </p>
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="current">Current Month</option>
                <option value="last">Last Month</option>
                <option value="quarter">This Quarter</option>
              </select>
              <select 
                value={viewType} 
                onChange={(e) => setViewType(e.target.value as 'chart' | 'list')}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="chart">Chart View</option>
                <option value="list">List View</option>
              </select>
            </div>
          </div>

          {/* Overall Status */}
          <div className={`p-4 rounded-lg border mb-6 ${getStatusColor(data.overallStatus)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(data.overallStatus)}
                <div>
                  <h3 className="font-semibold">Overall Budget Status</h3>
                  <p className="text-sm opacity-80">
                    {formatCurrency(data.totalSpent)} of {formatCurrency(data.totalBudget)} spent
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{(data.overallPercentage || 0).toFixed(1)}%</p>
                <p className="text-sm opacity-80">
                  {formatCurrency(data.totalBudget - data.totalSpent)} remaining
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(data.overallPercentage)}`}
                  style={{ width: `${Math.min(data.overallPercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Chart or List View */}
          {viewType === 'chart' ? (
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
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
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="budget" fill="#6b7280" name="Budget" />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
                  <Line dataKey="projected" stroke="#f59e0b" strokeWidth={2} name="Projected" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {data.budgets.map((budget) => (
                <div key={budget.category} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium capitalize text-white">{budget.category}</span>
                      {getTrendIcon(budget.trend)}
                      <div className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getStatusColor(budget.status)}`}>
                        {getStatusIcon(budget.status)}
                        {budget.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">{(budget.percentage || 0).toFixed(1)}%</p>
                      <p className="text-gray-300 text-sm">
                        {budget.daysRemaining} days left
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-300">Budget:</span>
                      <p className="text-white font-medium">{formatCurrency(budget.budgetAmount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Spent:</span>
                      <p className="text-white font-medium">{formatCurrency(budget.actualAmount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Remaining:</span>
                      <p className="text-white font-medium">{formatCurrency(budget.remainingAmount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-300">Projected:</span>
                      <p className="text-white font-medium">{formatCurrency(budget.projectedAmount)}</p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(budget.percentage)}`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-500/20 p-4 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-300">Over Budget</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.insights.categoriesOverBudget}
              </p>
            </div>
            
            <div className="bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-300">Near Limit</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.insights.categoriesNearLimit}
              </p>
            </div>
            
            <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Projected Overspend</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(data.insights.projectedOverspend)}
              </p>
            </div>
            
            <div className="bg-green-500/20 p-4 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">On Track</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {data.budgets.length - data.insights.categoriesOverBudget - data.insights.categoriesNearLimit}
              </p>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Budget Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Best performing category:</span>
                <p className="text-gray-300 capitalize">{data.insights.bestPerformingCategory}</p>
              </div>
              <div>
                <span className="font-medium text-white">Needs attention:</span>
                <p className="text-gray-300 capitalize">{data.insights.worstPerformingCategory}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}