"use client";

import { useEffect, useState } from "react";
import { dashboardApi, CashflowData } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CashflowChartProps {
  data?: CashflowData[];
  months?: number;
  loading?: boolean;
}

export function CashflowChart({ data: propsData, months = 6, loading: propsLoading }: CashflowChartProps) {
  const [data, setData] = useState<CashflowData[]>(propsData || []);
  const [loading, setLoading] = useState(propsLoading ?? !propsData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propsData) {
      setData(propsData);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const cashflowData = await dashboardApi.getCashflow(months);
        setData(cashflowData);
      } catch (err) {
        console.error("Failed to fetch cashflow data:", err);
        setError("Failed to load cashflow data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [propsData, months]);

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-text">
        {error || "No cashflow data available"}
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card-bg border border-muted-text/20 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-primary-text mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-medium" style={{ color: entry.color }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate totals
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);
  const totalNet = totalIncome - totalExpenses;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-text">Cashflow</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary-green"></span>
            <span className="text-muted-text">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-error"></span>
            <span className="text-muted-text">Expenses</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-hover-bg rounded-lg p-3 text-center">
          <p className="text-xs text-muted-text mb-1">{months}M Income</p>
          <p className="text-lg font-semibold text-primary-green">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-hover-bg rounded-lg p-3 text-center">
          <p className="text-xs text-muted-text mb-1">{months}M Expenses</p>
          <p className="text-lg font-semibold text-error">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-hover-bg rounded-lg p-3 text-center">
          <p className="text-xs text-muted-text mb-1">{months}M Net</p>
          <p className={`text-lg font-semibold ${totalNet >= 0 ? 'text-primary-green' : 'text-error'}`}>
            {formatCurrency(totalNet)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6ECB8E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6ECB8E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E74C3C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2F3339" />
            <XAxis 
              dataKey="month" 
              stroke="#6B7280" 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
            />
            <YAxis 
              stroke="#6B7280" 
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#6ECB8E"
              fill="url(#incomeGradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#E74C3C"
              fill="url(#expenseGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CashflowChart;
