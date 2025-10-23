'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/shared/ui';
import Button from '@/components/ui/Button';
import { Calendar, TrendingUp, Clock, MapPin, AlertCircle } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';

interface HeatmapData {
  date: string;
  amount: number;
  transactionCount: number;
  intensity: number; // 0-1 scale for color intensity
}

interface TimePattern {
  hour: number;
  amount: number;
  transactionCount: number;
  averageAmount: number;
}

interface LocationPattern {
  location: string;
  amount: number;
  transactionCount: number;
  percentage: number;
}

interface SpendingHeatmapData {
  dailyData: HeatmapData[];
  timePatterns: TimePattern[];
  locationPatterns: LocationPattern[];
  insights: {
    peakSpendingDay: string;
    peakSpendingHour: number;
    mostActiveLocation: string;
    spendingConsistency: number;
    weekdayVsWeekend: {
      weekday: { amount: number; average: number };
      weekend: { amount: number; average: number };
    };
  };
}

interface SpendingHeatmapProps {
  cardId?: string;
  period?: string;
  className?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SpendingHeatmap({ cardId, period = '3', className }: SpendingHeatmapProps) {
  const [data, setData] = useState<SpendingHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'daily' | 'hourly' | 'location'>('daily');
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const fetchSpendingHeatmap = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        period: selectedPeriod
      });

      if (cardId) {
        params.append('cardId', cardId);
      }

      const response = await fetch(`/api/analytics/spending-heatmap?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch spending heatmap');
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
    fetchSpendingHeatmap();
  }, [selectedPeriod, cardId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getIntensityColor = (intensity: number) => {
    const opacity = Math.max(0.1, intensity);
    return `rgba(59, 130, 246, ${opacity})`;
  };

  const getHourlyIntensityColor = (amount: number, maxAmount: number) => {
    const intensity = maxAmount > 0 ? amount / maxAmount : 0;
    const opacity = Math.max(0.1, intensity);
    return `rgba(16, 185, 129, ${opacity})`;
  };

  const renderDailyHeatmap = () => {
    if (!data) return null;

    // Create a grid for the last 12 weeks
    const weeks = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = endOfWeek(weekStart);
      const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      weeks.push(daysInWeek);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Daily Spending Pattern</h3>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>Less</span>
            <div className="flex gap-1">
              {[0.1, 0.3, 0.5, 0.7, 1.0].map((intensity) => (
                <div
                  key={intensity}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getIntensityColor(intensity) }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center">{day}</div>
            ))}
          </div>
          
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const dayData = data.dailyData?.find(d => {
                  try {
                    return isSameDay(parseISO(d.date), day);
                  } catch (error) {
                    console.warn('Invalid date format:', d.date);
                    return false;
                  }
                });
                
                return (
                  <div
                    key={day.toISOString()}
                    className="w-4 h-4 rounded-sm border border-white/10 cursor-pointer hover:border-white/30 transition-colors"
                    style={{ 
                      backgroundColor: dayData ? getIntensityColor(dayData.intensity) : 'rgba(255,255,255,0.05)' 
                    }}
                    title={`${format(day, 'MMM d, yyyy')}: ${dayData ? formatCurrency(dayData.amount) : '$0'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHourlyHeatmap = () => {
    if (!data) return null;

    const maxAmount = Math.max(...(data.timePatterns?.map(t => t.amount) || [0]));

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Hourly Spending Pattern</h3>
        
        <div className="grid grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, hour) => {
            const hourData = data.timePatterns?.find(t => t.hour === hour);
            const amount = hourData?.amount || 0;
            
            return (
              <div key={hour} className="text-center">
                <div
                  className="w-8 h-16 rounded border border-white/10 cursor-pointer hover:border-white/30 transition-colors mb-1"
                  style={{ 
                    backgroundColor: getHourlyIntensityColor(amount, maxAmount)
                  }}
                  title={`${hour}:00 - ${formatCurrency(amount)} (${hourData?.transactionCount || 0} transactions)`}
                />
                <div className="text-xs text-gray-400">
                  {hour === 0 ? '12a' : hour <= 12 ? `${hour}${hour === 12 ? 'p' : 'a'}` : `${hour - 12}p`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLocationHeatmap = () => {
    if (!data) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Location Spending Pattern</h3>
        
        <div className="space-y-3">
          {data.locationPatterns.slice(0, 10).map((location, index) => (
            <div key={location.location} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-white">{location.location}</span>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{formatCurrency(location.amount)}</p>
                  <p className="text-gray-300 text-sm">{(location.percentage || 0).toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>{location.transactionCount} transactions</span>
                <span>Avg: {formatCurrency(location.amount / location.transactionCount)}</span>
              </div>
              
              <div className="mt-2 w-full bg-white/20 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${location.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
            <p className="text-red-600 font-medium">Failed to load spending heatmap</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            <Button onClick={fetchSpendingHeatmap} className="mt-4">
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
                <Calendar className="h-5 w-5" />
                Spending Heatmap
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                Visualize spending patterns across time and location
              </p>
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">1 Year</option>
              </select>
              <select 
                value={viewType} 
                onChange={(e) => setViewType(e.target.value as 'daily' | 'hourly' | 'location')}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
                <option value="location">Location</option>
              </select>
            </div>
          </div>

          {/* Heatmap Content */}
          <div className="mb-6">
            {viewType === 'daily' && renderDailyHeatmap()}
            {viewType === 'hourly' && renderHourlyHeatmap()}
            {viewType === 'location' && renderLocationHeatmap()}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Peak Day</span>
              </div>
              <p className="text-lg font-bold text-white">
                {(() => {
                  try {
                    return format(parseISO(data.insights.peakSpendingDay), 'MMM d');
                  } catch (error) {
                    console.warn('Invalid date format for peakSpendingDay:', data.insights.peakSpendingDay);
                    return 'N/A';
                  }
                })()}
              </p>
            </div>
            
            <div className="bg-green-500/20 p-4 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Peak Hour</span>
              </div>
              <p className="text-lg font-bold text-white">
                {data.insights.peakSpendingHour}:00
              </p>
            </div>
            
            <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Top Location</span>
              </div>
              <p className="text-lg font-bold text-white truncate">
                {data.insights.mostActiveLocation}
              </p>
            </div>
            
            <div className="bg-orange-500/20 p-4 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">Consistency</span>
              </div>
              <p className="text-lg font-bold text-white">
                {(data.insights.spendingConsistency || 0).toFixed(1)}/10
              </p>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Pattern Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Weekday spending:</span>
                <p className="text-gray-300">
                  {formatCurrency(data.insights.weekdayVsWeekend?.weekday?.amount || 0)} avg
                </p>
              </div>
              <div>
                <span className="font-medium text-white">Weekend spending:</span>
                <p className="text-gray-300">
                  {formatCurrency(data.insights.weekdayVsWeekend?.weekend?.amount || 0)} avg
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}