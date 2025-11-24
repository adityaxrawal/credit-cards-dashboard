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
import { AppLayout } from "@/components/layout";
import { Button, Badge } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Calendar,
  PieChart as PieChartIcon,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

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
      const response = await apiClient.get<any>(
        `/analytics/kpi?period=${selectedPeriod}`
      );
      return response.data;
    },
  });

  // Fetch trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics", "trends", trendMetric, trendPeriod],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/analytics/trends?metric=${trendMetric}&period=${trendPeriod}&limit=12`
      );
      return response.data;
    },
  });

  // Fetch category analytics
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ["analytics", "categories", selectedPeriod],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/analytics/categories?period=${selectedPeriod}`
      );
      return response.data;
    },
  });

  // Fetch top merchants
  const { data: merchantData, isLoading: merchantLoading } = useQuery({
    queryKey: ["analytics", "merchants", selectedPeriod],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/analytics/merchants?period=${selectedPeriod}&limit=10`
      );
      return response.data;
    },
  });

  // Fetch comparative analysis
  const { data: comparativeData } = useQuery({
    queryKey: ["analytics", "comparative", "month_over_month"],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/analytics/comparative?type=month_over_month`
      );
      return response.data;
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
    <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-secondary-text mb-1">{kpi.name}</p>
          <h3 className="text-3xl font-bold text-primary-text">
            {kpi.unit === "$" ? "$" : ""}
            {kpi.value.toLocaleString()}
            {kpi.unit && kpi.unit !== "$" ? kpi.unit : ""}
          </h3>
          {kpi.change !== undefined && (
            <div className="flex items-center mt-2">
              {kpi.changeType === "increase" ? (
                <TrendingUp className="w-4 h-4 text-success mr-1" />
              ) : kpi.changeType === "decrease" ? (
                <TrendingDown className="w-4 h-4 text-error mr-1" />
              ) : null}
              <span
                className={`text-sm ${
                  kpi.trend === "positive"
                    ? "text-success"
                    : kpi.trend === "negative"
                    ? "text-error"
                    : "text-secondary-text"
                }`}
              >
                {kpi.change > 0 ? "+" : ""}
                {kpi.change.toFixed(1)}%
              </span>
              <span className="text-xs text-secondary-text ml-2">
                vs previous period
              </span>
            </div>
          )}
          <p className="text-xs text-secondary-text mt-2">{kpi.description}</p>
        </div>
        <div className="ml-4 p-3 bg-primary-green/10 rounded-lg">{icon}</div>
      </div>
    </div>
  );

  return (
    <AppLayout title="Analytics" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-text">
              Comprehensive insights into your spending patterns
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48 bg-card-bg border-muted-text/20">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary">Export Report</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card-bg p-6 rounded-xl animate-pulse h-40"></div>
              ))}
            </>
          ) : (
            <>
              {kpiData?.kpis?.slice(0, 4).map((kpi: KPI, index: number) => {
                const icons = [
                  <DollarSign key="dollar" className="w-6 h-6 text-primary-green" />,
                  <CreditCard key="credit" className="w-6 h-6 text-primary-green" />,
                  <Calendar key="calendar" className="w-6 h-6 text-primary-green" />,
                  <PieChartIcon key="pie" className="w-6 h-6 text-primary-green" />,
                ];
                return renderKPICard(kpi, icons[index]);
              })}
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Trends */}
          <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary-text">Spending Trends</h3>
              <div className="flex space-x-2">
                <Select value={trendMetric} onValueChange={setTrendMetric}>
                  <SelectTrigger className="w-32 bg-hover-bg border-0 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spending">Spending</SelectItem>
                    <SelectItem value="transactions">Transactions</SelectItem>
                    <SelectItem value="categories">Categories</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                  <SelectTrigger className="w-32 bg-hover-bg border-0 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-secondary-text">Loading trends...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendsData?.trends || []}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#F3F4F6' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
            <h3 className="text-lg font-semibold text-primary-text mb-4">Spending by Category</h3>
            {categoryLoading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-secondary-text">Loading categories...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData?.categories?.slice(0, 8) || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="totalSpent"
                  >
                    {categoryData?.categories
                      ?.slice(0, 8)
                      .map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="rgba(0,0,0,0)"
                        />
                      ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#F3F4F6' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Detailed Tables */}
        <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
          <Tabs defaultValue="categories">
            <div className="border-b border-muted-text/10 mb-6">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger value="categories" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-green data-[state=active]:text-primary-green rounded-none px-4 pb-2">Categories</TabsTrigger>
                <TabsTrigger value="merchants" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-green data-[state=active]:text-primary-green rounded-none px-4 pb-2">Merchants</TabsTrigger>
                <TabsTrigger value="comparative" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-green data-[state=active]:text-primary-green rounded-none px-4 pb-2">Comparative</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="categories">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-muted-text/10">
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">Total Spent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">Transactions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">Avg Transaction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">% of Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted-text/10">
                    {categoryData?.categories?.map((cat: CategoryAnalytics) => (
                      <tr key={cat.category}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-text">{cat.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">{formatCurrency(cat.totalSpent)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">{cat.transactionCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">{formatCurrency(cat.averageTransaction)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">{cat.percentage.toFixed(1)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge
                            variant={cat.monthlyGrowth > 0 ? "destructive" : "default"}
                            className="bg-opacity-10"
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
            </TabsContent>
            
            <TabsContent value="merchants">
               <div className="space-y-3">
                {merchantData?.merchants?.slice(0, 10).map((merchant: MerchantAnalytics, index: number) => (
                  <div key={merchant.merchant} className="flex items-center justify-between p-3 bg-hover-bg rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-green/20 text-primary-green font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-primary-text">{merchant.merchant}</p>
                        <p className="text-sm text-secondary-text">{merchant.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary-text">{formatCurrency(merchant.totalSpent)}</p>
                      <p className="text-sm text-secondary-text">{merchant.transactionCount} transactions</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="comparative">
              {comparativeData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {comparativeData.comparisons?.map((comp: any) => (
                    <div key={comp.metric} className="p-4 bg-hover-bg rounded-lg">
                      <p className="text-sm text-secondary-text mb-1">{comp.metric}</p>
                      <div className="flex items-baseline space-x-2">
                        <p className="text-2xl font-bold text-primary-text">${comp.period2Value.toFixed(2)}</p>
                        <Badge
                          variant={comp.trend === "improving" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {comp.percentageChange > 0 ? "+" : ""}
                          {comp.percentageChange.toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-secondary-text mt-1">Previous: ${comp.period1Value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
