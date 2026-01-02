"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertCircle, Activity, CreditCard } from "lucide-react";
import { Card } from "@/shared/components/ui";
import { cn, formatCurrency } from "@/shared/utils";

interface MetricData {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number; // Percentage change
  changeLabel?: string;
  trend: "up" | "down" | "neutral";
  status: "success" | "warning" | "error" | "neutral";
  data: { value: number }[]; // For sparkline
  icon?: React.ReactNode;
}

interface TickerWidgetProps {
  metrics: {
    netWorth: MetricData;
    runway: MetricData;
    periodSpend: MetricData;
    creditUtilization: MetricData;
  };
  isLoading?: boolean;
}

const Sparkline = ({ data, color }: { data: { value: number }[]; color: string }) => {
  return (
    <div className="h-[40px] w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fillOpacity={1}
            fill={`url(#gradient-${color})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const MetricCard = ({ metric, loading }: { metric: MetricData; loading?: boolean }) => {
  if (loading) {
    return (
      <Card className="p-5 flex flex-col justify-between h-[120px] animate-pulse">
        <div className="flex justify-between items-start">
           <div className="space-y-2">
             <div className="h-3 w-20 bg-muted-text/10 rounded" />
             <div className="h-6 w-32 bg-muted-text/10 rounded" />
           </div>
           <div className="h-8 w-8 rounded-full bg-muted-text/10" />
        </div>
        <div className="h-2 w-full mt-4 bg-muted-text/10 rounded" />
      </Card>
    );
  }

  const isPositive = metric.change ? metric.change > 0 : false;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  
  // Color mapping based on status
  const colorMap = {
    success: "#6ECB8E", // primary-green
    warning: "#FFB020", // semantic-amber
    error: "#D93025",   // semantic-red
    neutral: "#94A3B8", // slate-400
  };
  
  const color = colorMap[metric.status];

  return (
    <Card className="relative overflow-hidden border-muted-text/10 bg-card-bg/50 backdrop-blur-sm p-0 flex flex-col h-full hover:border-primary-green/20 transition-colors group">
      <div className="p-5 flex flex-col justify-between h-full relative z-10">
          <div className="flex justify-between items-start">
             <div className="flex flex-col gap-1">
                 <span className="text-secondary-text text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    {metric.icon && <span className="opacity-70">{metric.icon}</span>}
                    {metric.label}
                 </span>
                 <div className="flex items-baseline gap-2">
                     <span className="text-2xl font-mono font-bold text-primary-text tracking-tight">
                        {typeof metric.value === 'number' ? formatCurrency(metric.value) : metric.value}
                     </span>
                 </div>
             </div>
             
             {/* Sparkline on the right */}
             <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                <Sparkline data={metric.data} color={color} />
             </div>
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs">
              {metric.change !== undefined && (
                  <div className={cn(
                      "flex items-center px-1.5 py-0.5 rounded",
                      metric.trend === 'up' && metric.status === 'success' ? "bg-primary-green/10 text-primary-green" :
                      metric.trend === 'down' && metric.status === 'error' ? "bg-semantic-red/10 text-semantic-red" :
                      metric.trend === 'up' && metric.status === 'error' ? "bg-semantic-red/10 text-semantic-red" : // Cost going up is bad
                      "bg-secondary-text/10 text-secondary-text"
                  )}>
                      <TrendIcon className="w-3 h-3 mr-1" />
                      <span>{Math.abs(metric.change)}%</span>
                  </div>
              )}
              <span className="text-muted-text">
                  {metric.changeLabel || metric.subValue}
              </span>
          </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
         {metric.icon}
      </div>
    </Card>
  );
};

export default function TickerWidget({ metrics, isLoading = false }: TickerWidgetProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <MetricCard metric={metrics.netWorth} loading={isLoading} />
      <MetricCard metric={metrics.runway} loading={isLoading} />
      <MetricCard metric={metrics.periodSpend} loading={isLoading} />
      <MetricCard metric={metrics.creditUtilization} loading={isLoading} />
    </div>
  );
}
