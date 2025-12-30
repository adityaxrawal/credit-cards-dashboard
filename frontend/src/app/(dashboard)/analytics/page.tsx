"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Calendar,
  PieChart as PieChartIcon,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { analyticsApi, TopMerchant } from "@/lib/api/analytics";
import { SpendingTrendChart } from "@/components/features/analytics/SpendingTrendChart";
import { CategoryPieChart } from "@/components/features/analytics/CategoryPieChart";
import { CategoryDrillDown } from "@/components/features/analytics/CategoryDrillDown";
import { queryKeys } from "@/lib/react-query/keys";

interface KPI {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  changeType?: "increase" | "decrease" | "stable";
  trend?: "positive" | "negative" | "neutral";
  description: string;
}

export default function AnalyticsPage() {
  const [trendRange, setTrendRange] = useState<"6m" | "12m">("6m");

  // Fetch KPI dashboard (Overview)
  const { data: overviewData, isLoading: kpiLoading } = useQuery({
    queryKey: queryKeys.analytics.overview,
    queryFn: () => analyticsApi.getOverview(),
  });

  // Fetch trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: queryKeys.analytics.trends(trendRange),
    queryFn: () => analyticsApi.getTrends(trendRange),
  });

  // Fetch category analytics (using current month/year from overview or defaults)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: queryKeys.analytics.categories(currentMonth, currentYear),
    queryFn: () => analyticsApi.getCategoryBreakdown(currentMonth, currentYear),
  });

  // Fetch top merchants
  const { data: merchantData, isLoading: merchantLoading } = useQuery({
    queryKey: queryKeys.analytics.merchants(currentMonth, currentYear),
    queryFn: () => analyticsApi.getTopMerchants(currentMonth, currentYear),
  });

  // Process KPI Data
  const kpis: KPI[] = [];
  if (overviewData) {
    const { currentMonth, previousMonth } = overviewData;
    
    // Safely access values with defaults
    const currSpent = currentMonth?.totalSpent ?? 0;
    const prevSpent = previousMonth?.totalSpent ?? 0;
    const currCount = currentMonth?.transactionCount ?? 0;
    const prevCount = previousMonth?.transactionCount ?? 0;

    // Total Spent
    const spentChange = prevSpent > 0 
      ? ((currSpent - prevSpent) / prevSpent) * 100 
      : 0;
    
    kpis.push({
      name: "Total Spent",
      value: currSpent,
      unit: "currency",
      change: Math.abs(spentChange),
      changeType: spentChange > 0 ? "increase" : spentChange < 0 ? "decrease" : "stable",
      trend: spentChange > 0 ? "negative" : "positive", // Spending increase is usually negative
      description: "vs last month"
    });

    // Transaction Count
    const countChange = prevCount > 0
      ? ((currCount - prevCount) / prevCount) * 100
      : 0;

    kpis.push({
      name: "Transactions",
      value: currCount,
      change: Math.abs(countChange),
      changeType: countChange > 0 ? "increase" : countChange < 0 ? "decrease" : "stable",
      trend: "neutral",
      description: "vs last month"
    });

    // Avg Transaction
    const currentAvg = currCount > 0 ? currSpent / currCount : 0;
    const prevAvg = prevCount > 0 ? prevSpent / prevCount : 0;
    const avgChange = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;

    kpis.push({
      name: "Avg Transaction",
      value: currentAvg,
      unit: "currency",
      change: Math.abs(avgChange),
      changeType: avgChange > 0 ? "increase" : avgChange < 0 ? "decrease" : "stable",
      trend: "neutral",
      description: "vs last month"
    });

    // Top Category
    let topCategory = "None";
    let topCategoryAmount = 0;
    if (currentMonth?.byCategory) {
      Object.entries(currentMonth.byCategory).forEach(([cat, amount]) => {
        if (amount > topCategoryAmount) {
          topCategoryAmount = amount;
          topCategory = cat;
        }
      });
    }

    kpis.push({
      name: "Top Category",
      value: topCategoryAmount, // Display amount, but name is the category
      unit: "currency",
      description: topCategory // Hack to show category name
    });
  }

  // Process Chart Data
  const chartData = Array.isArray(trendsData) 
    ? trendsData.map((item) => ({
        label: `${item.month}/${item.year}`,
        value: item.totalSpent
      }))
    : [];

  // Process Category Data for Pie Chart
  const pieData = categoryData?.categories 
    ? Object.entries(categoryData.categories).map(([name, value]) => ({ name, value }))
    : [];

  const renderKPICard = (kpi: KPI, icon: React.ReactNode) => (
    <div key={kpi.name} className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-secondary-text mb-1">{kpi.name}</p>
          <h3 className="text-3xl font-bold text-primary-text">
            {kpi.unit === "currency" 
              ? formatCurrency(kpi.value) 
              : kpi.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h3>
          {kpi.name === "Top Category" ? (
             <p className="text-sm font-medium text-primary-green mt-2">{kpi.description}</p>
          ) : (
            kpi.change !== undefined && (
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
                  {kpi.changeType === "increase" ? "+" : "-"}
                  {kpi.change.toFixed(1)}%
                </span>
                <span className="text-xs text-secondary-text ml-2">
                  {kpi.description}
                </span>
              </div>
            )
          )}
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
             {/* Period selection could be added here if backend supports arbitrary ranges for overview */}
            <Button variant="secondary" onClick={async () => {
              try {
                const blob = await analyticsApi.exportData('monthly_pdf');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spending-report-${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (e) {
                console.error("Export failed", e);
              }
            }}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
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
              {kpis.map((kpi: KPI, index: number) => {
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
                <Select value={trendRange} onValueChange={(v) => setTrendRange(v as "6m" | "12m")}>
                  <SelectTrigger className="w-32 bg-hover-bg border-0 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6m">Last 6 Months</SelectItem>
                    <SelectItem value="12m">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SpendingTrendChart data={chartData} isLoading={trendsLoading} />
          </div>

          {/* Category Breakdown */}
          <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
            <h3 className="text-lg font-semibold text-primary-text mb-4">Spending by Category (Current Month)</h3>
            <CategoryPieChart data={pieData} isLoading={categoryLoading} />
          </div>
        </div>

        {/* Detailed Tables */}
        <div className="bg-card-bg p-6 rounded-xl border border-muted-text/10 shadow-sm">
          <Tabs defaultValue="categories">
            <div className="border-b border-muted-text/10 mb-6">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger value="categories" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-green data-[state=active]:text-primary-green rounded-none px-4 pb-2">Categories</TabsTrigger>
                <TabsTrigger value="merchants" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-green data-[state=active]:text-primary-green rounded-none px-4 pb-2">Top Merchants</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="categories">
              <CategoryDrillDown 
                categories={pieData.map(cat => ({
                    name: cat.name,
                    total: cat.value,
                    count: 0 // Count not available in aggregate data yet
                }))}
                onExport={async () => {
                    try {
                        const blob = await analyticsApi.exportData('category_pdf');
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // Use current month/year for filename if possible, otherwise generic
                        a.download = `category_report.html`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    } catch (e) {
                         console.error("Category export failed", e);
                    }
                }}
              />
            </TabsContent>
            
            <TabsContent value="merchants">
               <div className="space-y-3">
                {merchantData?.merchants?.map((merchant: TopMerchant, index: number) => (
                  <div key={merchant.merchant} className="flex items-center justify-between p-3 bg-hover-bg rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-green/20 text-primary-green font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-primary-text">{merchant.merchant}</p>
                        <p className="text-sm text-secondary-text">{merchant.transactionCount} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary-text">{formatCurrency(merchant.totalSpent)}</p>
                    </div>
                  </div>
                ))}
                 {(!merchantData?.merchants || merchantData.merchants.length === 0) && (
                    <p className="text-center text-secondary-text py-4">No merchant data available</p>
                 )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
