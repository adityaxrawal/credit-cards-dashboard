"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Calendar,
  PieChart as PieChartIcon,
} from "lucide-react";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF6B9D",
];

interface KPI {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  changeType?: "increase" | "decrease" | "stable";
  trend?: "positive" | "negative" | "neutral";
  description: string;
}

interface TrendPoint {
  period: string;
  value: number;
  label: string;
}

interface CategoryAnalytics {
  category: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  percentage: number;
  monthlyGrowth: number;
}

interface MerchantAnalytics {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  category: string;
}

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");
  const [trendMetric, setTrendMetric] = useState<string>("spending");
  const [trendPeriod, setTrendPeriod] = useState<string>("monthly");

  // Fetch KPI dashboard
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["analytics", "kpi", selectedPeriod],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/kpi?period=${selectedPeriod}`
      );
      return response.data.data;
    },
  });

  // Fetch trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics", "trends", trendMetric, trendPeriod],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/trends?metric=${trendMetric}&period=${trendPeriod}&limit=12`
      );
      return response.data.data;
    },
  });

  // Fetch category analytics
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ["analytics", "categories", selectedPeriod],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/categories?period=${selectedPeriod}`
      );
      return response.data.data;
    },
  });

  // Fetch top merchants
  const { data: merchantData, isLoading: merchantLoading } = useQuery({
    queryKey: ["analytics", "merchants", selectedPeriod],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/merchants?period=${selectedPeriod}&limit=10`
      );
      return response.data.data;
    },
  });

  // Fetch comparative analysis
  const { data: comparativeData } = useQuery({
    queryKey: ["analytics", "comparative", "month_over_month"],
    queryFn: async () => {
      const response = await apiClient.get(
        `/analytics/comparative?type=month_over_month`
      );
      return response.data.data;
    },
  });

  const periodOptions = [
    { value: "current_month", label: "Current Month" },
    { value: "last_month", label: "Last Month" },
    { value: "last_3_months", label: "Last 3 Months" },
    { value: "last_6_months", label: "Last 6 Months" },
    { value: "last_year", label: "Last Year" },
  ];

  const renderKPICard = (kpi: KPI, icon: React.ReactNode) => (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{kpi.name}</p>
          <h3 className="text-3xl font-bold">
            {kpi.unit === "$" ? "$" : ""}
            {kpi.value.toLocaleString()}
            {kpi.unit && kpi.unit !== "$" ? kpi.unit : ""}
          </h3>
          {kpi.change !== undefined && (
            <div className="flex items-center mt-2">
              {kpi.changeType === "increase" ? (
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              ) : kpi.changeType === "decrease" ? (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
              ) : null}
              <span
                className={`text-sm ${
                  kpi.trend === "positive"
                    ? "text-green-600"
                    : kpi.trend === "negative"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {kpi.change > 0 ? "+" : ""}
                {kpi.change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 ml-2">
                vs previous period
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">{kpi.description}</p>
        </div>
        <div className="ml-4 p-3 bg-blue-50 rounded-lg">{icon}</div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Comprehensive insights into your spending patterns
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-48"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button variant="outline">Export Report</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {kpiLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </Card>
              ))}
            </>
          ) : (
            <>
              {kpiData?.kpis?.slice(0, 4).map((kpi: KPI, index: number) => {
                const icons = [
                  <DollarSign className="w-6 h-6 text-blue-600" />,
                  <CreditCard className="w-6 h-6 text-blue-600" />,
                  <Calendar className="w-6 h-6 text-blue-600" />,
                  <PieChartIcon className="w-6 h-6 text-blue-600" />,
                ];
                return renderKPICard(kpi, icons[index]);
              })}
            </>
          )}
        </div>

        {/* Financial Health Score */}
        {kpiData?.healthScore && (
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              Financial Health Score
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                        Health Score
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-blue-600">
                        {kpiData.healthScore.overall}/100
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-blue-200">
                    <div
                      style={{ width: `${kpiData.healthScore.overall}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  {Object.entries(kpiData.healthScore.components).map(
                    ([key, value]: [string, any]) => (
                      <div key={key} className="text-center">
                        <p className="text-xs text-gray-500 capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </p>
                        <p className="text-lg font-semibold">{value}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Spending Trends */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Spending Trends</h3>
              <div className="flex space-x-2">
                <Select
                  value={trendMetric}
                  onChange={(e) => setTrendMetric(e.target.value)}
                  className="w-32"
                >
                  <option value="spending">Spending</option>
                  <option value="transactions">Transactions</option>
                  <option value="categories">Categories</option>
                </Select>
                <Select
                  value={trendPeriod}
                  onChange={(e) => setTrendPeriod(e.target.value)}
                  className="w-32"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
            </div>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">Loading trends...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendsData?.trends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0088FE"
                    fill="#0088FE"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {trendsData?.forecast && (
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Forecast:</strong> $
                  {trendsData.forecast.predictedValue.toFixed(2)} (
                  {trendsData.forecast.confidence}% confidence)
                </p>
              </div>
            )}
          </Card>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
            {categoryLoading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">Loading categories...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData?.categories?.slice(0, 8) || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      `${entry.category}: ${entry.percentage.toFixed(1)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="totalSpent"
                  >
                    {categoryData?.categories
                      ?.slice(0, 8)
                      .map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Detailed Tables */}
        <Tabs defaultValue="categories" className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                Categories
              </button>
              <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                Merchants
              </button>
              <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                Comparative
              </button>
            </nav>
          </div>

          {/* Categories Table */}
          <div className="mt-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Category Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Transaction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % of Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Growth
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryData?.categories?.map((cat: CategoryAnalytics) => (
                      <tr key={cat.category}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {cat.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${cat.totalSpent.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cat.transactionCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${cat.averageTransaction.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cat.percentage.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge
                            variant={
                              cat.monthlyGrowth > 0 ? "destructive" : "default"
                            }
                            className="text-xs"
                          >
                            {cat.monthlyGrowth > 0 ? "+" : ""}
                            {cat.monthlyGrowth.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </Tabs>

        {/* Top Merchants */}
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Top Merchants</h3>
          <div className="space-y-3">
            {merchantData?.merchants
              ?.slice(0, 10)
              .map((merchant: MerchantAnalytics, index: number) => (
                <div
                  key={merchant.merchant}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{merchant.merchant}</p>
                      <p className="text-sm text-gray-500">
                        {merchant.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${merchant.totalSpent.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {merchant.transactionCount} transactions
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Comparative Analysis */}
        {comparativeData && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              Month-over-Month Comparison
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparativeData.comparisons?.map((comp: any) => (
                <div key={comp.metric} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{comp.metric}</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-2xl font-bold">
                      ${comp.period2Value.toFixed(2)}
                    </p>
                    <Badge
                      variant={
                        comp.trend === "improving" ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      {comp.percentageChange > 0 ? "+" : ""}
                      {comp.percentageChange.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Previous: ${comp.period1Value.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
