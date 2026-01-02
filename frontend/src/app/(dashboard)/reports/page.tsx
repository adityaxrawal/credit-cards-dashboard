"use client";

import React, { useState, useEffect } from "react";
import { Download, FileText, Calendar, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { AppLayout } from "@/components/layout";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

interface ReportData {
  summary: {
    totalSpent: number;
    totalEarned: number;
    netCashflow: number;
    transactionCount: number;
  };
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }[];
  monthlyTrends: {
    month: string;
    spent: number;
    earned: number;
  }[];
  topMerchants: {
    merchant: string;
    amount: number;
    count: number;
  }[];
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 3), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch spending summary
      const data = await apiClient.get<ReportData>(
        `/api/analytics/spending-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );

      setReportData(data.data ?? null);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await apiClient.post<{ id: string }>(
        "/api/reports/generate",
        {
          type: "spending_summary",
          format: exportFormat,
          dateRange,
          options: {
            includeTrends: true,
            includeComparisons: true,
            includeCharts: true,
          },
        }
      );

      // Trigger download
      const reportId = data.data?.id;
      if (reportId) {
        window.open(
          `${process.env.NEXT_PUBLIC_API_URL}/api/reports/${reportId}/download`,
          "_blank"
        );
      }
    } catch (error) {
      console.error("Error exporting report:", error);
      alert("Failed to export report");
    }
  };

  const handleQuickRange = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setDateRange({
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    });
  };



  if (loading) {
    return (
      <AppLayout title="Financial Reports">
        <div
          className="flex items-center justify-center min-h-[50vh]"
          role="status"
          aria-live="polite"
        >
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green"
            aria-hidden="true"
          ></div>
          <span className="sr-only">Loading reports...</span>
        </div>
      </AppLayout>
    );
  }

  if (!reportData) {
    return (
      <AppLayout title="Financial Reports">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-text mx-auto mb-4" />
          <p className="text-muted-text">
            No data available for the selected period
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Financial Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 id="reports-heading" className="text-2xl font-bold text-primary-text">
              Financial Reports
            </h2>
            <p className="text-muted-text mt-1">
              Comprehensive analysis of your spending patterns
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "csv" | "excel")}
              className="px-4 py-2 border border-muted-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue bg-card-bg text-primary-text"
              aria-label="Select export format"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-accent-blue text-white px-4 py-2 rounded-lg hover:bg-accent-blue/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2"
              aria-label="Export report"
            >
              <Download className="w-5 h-5" aria-hidden="true" />
              Export Report
            </button>
          </div>
        </div>

      {/* Date Range Filter */}
      <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-text" />
            <span className="font-medium text-primary-text">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) =>
              setDateRange({ ...dateRange, startDate: e.target.value })
            }
            className="px-3 py-2 border border-muted-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue bg-background text-primary-text"
          />
          <span className="text-muted-text">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) =>
              setDateRange({ ...dateRange, endDate: e.target.value })
            }
            className="px-3 py-2 border border-muted-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue bg-background text-primary-text"
          />
          <div className="flex gap-2 ml-auto">
            {[1, 3, 6, 12].map((months) => (
              <button
                key={months}
                onClick={() => handleQuickRange(months)}
                className="px-3 py-2 text-sm border border-muted-text/20 rounded-lg hover:bg-hover-bg text-primary-text transition-colors"
              >
                {months >= 12 ? `${months / 12}Y` : `${months}M`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-text">Total Spent</p>
              <p className="text-2xl font-bold text-error mt-1">
                ₹{reportData.summary.totalSpent.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-error" />
          </div>
        </div>

        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-text">Total Earned</p>
              <p className="text-2xl font-bold text-primary-green mt-1">
                ₹{reportData.summary.totalEarned.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary-green" />
          </div>
        </div>

        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-text">Net Cashflow</p>
              <p className="text-2xl font-bold text-accent-blue mt-1">
                ₹{reportData.summary.netCashflow.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-accent-blue" />
          </div>
        </div>

        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-text">Transactions</p>
              <p className="text-2xl font-bold text-primary-text mt-1">
                {reportData.summary.transactionCount}
              </p>
            </div>
            <FileText className="w-8 h-8 text-muted-text" />
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
        <h3 className="text-lg font-semibold text-primary-text mb-4">
          Monthly Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={reportData.monthlyTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              formatter={(value: number) => `₹${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="spent"
              stroke="#ef4444"
              name="Spent"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="earned"
              stroke="#10b981"
              name="Earned"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie Chart */}
        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Category Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reportData.categoryBreakdown}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) =>
                  `${entry.category}: ${entry.percentage.toFixed(1)}%`
                }
                fill="#8884d8"
              >
                {reportData.categoryBreakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `₹${value.toFixed(2)}`}
                contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Merchants Bar Chart */}
        <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Top Merchants
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData.topMerchants.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="merchant"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke="#888"
              />
              <YAxis stroke="#888" />
              <Tooltip
                formatter={(value: number) => `₹${value.toFixed(2)}`}
                contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Details Table */}
      <div className="bg-card-bg rounded-lg shadow-sm border border-muted-text/10 overflow-hidden">
        <div className="p-6 border-b border-muted-text/10">
          <h3 className="text-lg font-semibold text-primary-text">
            Category Details
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-text/10">
            <thead className="bg-hover-bg">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-text uppercase tracking-wider">
                  Transactions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card-bg divide-y divide-muted-text/10">
              {reportData.categoryBreakdown.map((category, index) => (
                <tr key={index} className="hover:bg-hover-bg transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-text">
                    {category.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-text">
                    ₹{category.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-text">
                    <div className="flex items-center">
                      <div className="w-full bg-hover-bg rounded-full h-2 mr-2">
                        <div
                          className="bg-accent-blue h-2 rounded-full"
                          style={{ width: `${category.percentage}%` }}
                        ></div>
                      </div>
                      <span>{category.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-text">
                    {category.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
