"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import TickerWidget from "@/features/dashboard/components/TickerWidget";
import FinancialHealthChart from "@/features/analytics/components/FinancialHealthChart";
import ForecasterWidget from "@/features/analytics/components/ForecasterWidget";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { analyticsApi } from "@/features/analytics/api";
import { budgetApi } from "@/features/budget/api";
import { cardApi } from "@/features/cards/api";
import { alertsApi } from "@/features/alerts/api";
import { Activity, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/components/ui";

// MetricData type matching TickerWidget
interface MetricData {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  trend: "up" | "down" | "neutral";
  status: "success" | "warning" | "error" | "neutral";
  data: { value: number }[];
  icon?: React.ReactNode;
}

// Month name lookup
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function OverviewPage() {
  const { summary, isLoading: dashboardLoading } = useDashboardData();

  // Fetch spending trends for historical comparison
  const { data: rawSpendingTrends } = useQuery({
    queryKey: ['spending-trends-overview'],
    queryFn: () => analyticsApi.getTrends("6m"),
    enabled: !!summary,
  });
  
  // Normalize spending trends to always be an array
  const spendingTrends = Array.isArray(rawSpendingTrends) ? rawSpendingTrends : [];

  // Fetch current budget for accurate budget values
  const { data: budgetData } = useQuery({
    queryKey: ['budget-current-overview'],
    queryFn: budgetApi.getCurrentBudget,
  });

  // Fetch cards for accurate credit limit calculation
  const { data: cards = [] } = useQuery({
    queryKey: ['cards-overview'],
    queryFn: cardApi.getCards,
  });

  // Fetch recent alerts
  const { data: alertsData } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: () => alertsApi.getAlerts(false, 1, 3),
  });

  // Calculate ticker metrics from real data
  const tickerMetrics = useMemo(() => {
    if (!summary) return null;
    
    // Calculate net worth change from trends if available
    let netWorthChange = 0;
    if (spendingTrends.length >= 2) {
      const currentMonthSpend = spendingTrends[spendingTrends.length - 1]?.totalSpent || 0;
      const previousMonthSpend = spendingTrends[spendingTrends.length - 2]?.totalSpent || 0;
      // Rough estimate: if spending went down, net worth improved
      netWorthChange = previousMonthSpend > 0 
        ? ((previousMonthSpend - currentMonthSpend) / previousMonthSpend) * 100
        : 0;
    }
    
    // Calculate runway from real data
    const cash = (summary.accountTotals?.cash || 0) + (summary.accountTotals?.bankAccounts || 0);
    const monthlyBurn = summary.monthlySnapshot?.expenses || 1; 
    const runwayMonths = monthlyBurn > 0 ? cash / monthlyBurn : 99;
    
    // Use real budget data
    const budget = budgetData?.monthlyBudget || 0;
    const spend = summary.monthlySnapshot?.expenses || 0;
    const spendPct = budget > 0 ? ((spend - budget) / budget) * 100 : 0;
    
    // Calculate real credit utilization from cards
    const creditDebt = summary.accountTotals?.creditCardOutstanding || 0;
    const totalLimit = cards.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
    const utilPct = totalLimit > 0 ? (Math.abs(creditDebt) / totalLimit) * 100 : 0;

    // Create trend data from spending trends
    const trendData = spendingTrends.map(t => ({ value: t.totalSpent }));
    const paddedTrendData = trendData.length >= 6 ? trendData : 
      Array.from({ length: 6 - trendData.length }, () => ({ value: 0 })).concat(trendData);

    const metrics: { netWorth: MetricData; runway: MetricData; periodSpend: MetricData; creditUtilization: MetricData } = {
       netWorth: {
           label: "Net Worth Velocity",
           value: summary.netWorth,
           subValue: "vs Last Month",
           change: Number(netWorthChange.toFixed(1)),
           changeLabel: "vs Last Month",
           trend: netWorthChange >= 0 ? "up" : "down",
           status: netWorthChange >= 0 ? "success" : "warning",
           icon: <TrendingUp className="w-4 h-4" />,
           data: paddedTrendData.map((d, i) => ({ value: summary.netWorth + (i - 5) * 1000 })),
       },
       runway: {
           label: "Runway",
           value: `${runwayMonths.toFixed(1)} Mo`,
           subValue: "Cash / Avg Burn",
           change: 0,
           trend: runwayMonths > 6 ? "up" : "down",
           status: runwayMonths > 6 ? "success" : runwayMonths > 3 ? "warning" : "error",
           icon: <Activity className="w-4 h-4" />,
           data: Array.from({length: 6}, (_, i) => ({ value: runwayMonths - 0.5 * i })).reverse(),
       },
       periodSpend: {
           label: "Monthly Spend",
           value: spend,
           subValue: budget > 0 ? `${(spend/budget*100).toFixed(0)}% of Budget` : "No budget set",
           change: Number(spendPct.toFixed(1)),
           trend: spend > budget ? "up" : "down",
           status: spend > budget ? "error" : budget > 0 && spend/budget > 0.8 ? "warning" : "success",
           icon: <DollarSign className="w-4 h-4" />,
           data: paddedTrendData,
       },
       creditUtilization: {
           label: "Credit Utilization",
           value: `${utilPct.toFixed(1)}%`,
           subValue: totalLimit > 0 ? `${Math.abs(creditDebt).toFixed(0)} / ${totalLimit}` : "No credit cards",
           change: 0,
           trend: utilPct > 30 ? "up" : "down",
           status: utilPct > 30 ? "warning" : "success",
           icon: <CreditCard className="w-4 h-4" />,
           data: Array.from({length: 6}, (_, i) => ({ value: utilPct + (i - 3) * 2 })),
       }
    };
    return metrics;
  }, [summary, spendingTrends, budgetData, cards]);

  // Build financial health chart data from spending trends
  const healthData = useMemo(() => {
    if (!spendingTrends || spendingTrends.length === 0) {
      return [];
    }

    const currentAssets = summary?.netWorth || 0;
    const currentLiabilities = Math.abs(summary?.accountTotals?.creditCardOutstanding || 0);

    return spendingTrends.map((trend, index) => {
      const monthsAgo = spendingTrends.length - 1 - index;
      // Estimate previous values based on spending
      const estimatedAssets = currentAssets * Math.pow(0.98, monthsAgo);
      const estimatedLiabilities = currentLiabilities;

      return {
        month: MONTH_NAMES[trend.month - 1] || `M${trend.month}`,
        assets: Math.round(estimatedAssets),
        liabilities: -Math.round(estimatedLiabilities),
        netWorth: Math.round(estimatedAssets - estimatedLiabilities),
      };
    });
  }, [spendingTrends, summary]);

  // Get recent alerts
  const recentAlerts = alertsData?.data?.slice(0, 3) || [];

  if (dashboardLoading || !tickerMetrics) {
      return (
          <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-32">
                  <div className="bg-muted-text/5 rounded-xl h-full"></div>
                  <div className="bg-muted-text/5 rounded-xl h-full"></div>
                  <div className="bg-muted-text/5 rounded-xl h-full"></div>
                  <div className="bg-muted-text/5 rounded-xl h-full"></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
                   <div className="lg:col-span-2 bg-muted-text/5 rounded-xl h-full"></div>
                   <div className="bg-muted-text/5 rounded-xl h-full"></div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      {/* Ticker Row */}
      <section>
        <TickerWidget metrics={tickerMetrics} />
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <section className="lg:col-span-2 space-y-6">
            {healthData.length > 0 ? (
                <FinancialHealthChart data={healthData} />
            ) : (
                <div className="bg-card-bg border border-border rounded-lg p-12 h-[400px] flex items-center justify-center">
                    <p className="text-secondary-text">No historical data available yet.</p>
                </div>
            )}
            
            {/* Action Items / Recent Alerts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Quick Actions */}
                 <div className="bg-card-bg border border-border rounded-lg p-6">
                     <h3 className="font-semibold text-primary-text mb-4">Quick Actions</h3>
                     <div className="grid grid-cols-2 gap-3">
                         <Link href="/operations/transactions">
                            <Button variant="outline" className="w-full justify-start text-xs h-10">Review Txns</Button>
                         </Link>
                         <Link href="/operations/budget">
                            <Button variant="outline" className="w-full justify-start text-xs h-10">Check Budget</Button>
                         </Link>
                         <Link href="/system/ingestion">
                            <Button variant="outline" className="w-full justify-start text-xs h-10">Sync Banks</Button>
                         </Link>
                         <Link href="/system/rules">
                            <Button variant="outline" className="w-full justify-start text-xs h-10">Manage Rules</Button>
                         </Link>
                     </div>
                 </div>
                 
                 {/* Recent Alerts */}
                 <div className="bg-card-bg border border-border rounded-lg p-6">
                    <h3 className="font-semibold text-primary-text mb-4">Recent Alerts</h3>
                    {recentAlerts.length === 0 ? (
                        <p className="text-sm text-secondary-text">No recent alerts.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentAlerts.map((alert) => (
                                <div key={alert.id} className="flex items-start gap-3 p-2 rounded bg-hover-bg/50">
                                    <div className={`w-2 h-2 mt-1.5 rounded-full ${
                                        alert.priority === 'high' ? 'bg-error' : 
                                        alert.priority === 'medium' ? 'bg-warning' : 'bg-muted-text'
                                    }`}></div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-text">{alert.title}</p>
                                        <p className="text-xs text-secondary-text">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            </div>
        </section>

        {/* Right Panel */}
        <aside className="space-y-6">
            <ForecasterWidget 
                currentNetWorth={summary?.netWorth || 0} 
                avgMonthlySavings={(summary?.monthlySnapshot?.savings || 0)} 
                avgMonthlyReturns={0.06}
            />
        </aside>
      </div>
    </div>
  );
}
