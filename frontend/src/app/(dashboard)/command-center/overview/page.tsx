"use client";

import React, { useMemo } from "react";
import TickerWidget from "@/features/dashboard/components/TickerWidget";
import FinancialHealthChart from "@/features/analytics/components/FinancialHealthChart";
import ForecasterWidget from "@/features/analytics/components/ForecasterWidget";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { Activity, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/components/ui";

export default function OverviewPage() {
  const { summary, cashflow, isLoading } = useDashboardData();

  // Mock data transformation for TickerWidget
  // In a real app, this would come from the API or be calculated more robustly
  const tickerMetrics = useMemo(() => {
    if (!summary) return null;
    
    const prevNetWorth = summary.netWorth * 0.98; // Mock 2% growth
    const netWorthChange = ((summary.netWorth - prevNetWorth) / prevNetWorth) * 100;
    
    // Mock runway calc
    const cash = (summary.accountTotals?.cash || 0) + (summary.accountTotals?.bankAccounts || 0);
    const monthlyBurn = summary.monthlySnapshot?.expenses || 1; 
    const runwayMonths = cash / monthlyBurn;
    
    // Mock spend
    const budget = 5000; // Mock budget
    const spend = summary.monthlySnapshot?.expenses || 0;
    const spendPct = ((spend - budget) / budget) * 100;
    
    // Utilization
    const creditDebt = summary.accountTotals?.creditCardOutstanding || 0;
    const totalLimit = 50000; // Mock total limit
    const utilPct = (creditDebt / totalLimit) * 100;

    return {
       netWorth: {
           label: "Net Worth Velocity",
           value: summary.netWorth,
           subValue: "vs Last Month",
           change: Number(netWorthChange.toFixed(1)),
           changeLabel: "vs Last Month",
           trend: "up" as const,
           status: "success" as const,
           icon: <TrendingUp className="w-4 h-4" />,
           data: Array.from({length: 10}, (_, i) => ({ value: summary.netWorth * (0.9 + i * 0.02) })) // increasing trend
       },
       runway: {
           label: "Runway",
           value: `${runwayMonths.toFixed(1)} Mo`,
           subValue: "Cash / Avg Burn",
           change: -2.5, // burned some cash
           trend: "down" as const,
           status: runwayMonths > 6 ? "success" : "warning" as const,
           icon: <Activity className="w-4 h-4" />,
           data: Array.from({length: 10}, (_, i) => ({ value: 10 - i * 0.2 })) // decreasing trend
       },
       periodSpend: {
           label: "Monthly Spend",
           value: spend,
           subValue: `${(spend/budget*100).toFixed(0)}% of Budget`,
           change: Number(spendPct.toFixed(1)),
           trend: spend > budget ? "up" : "down" as const,
           status: spend > budget ? "error" : "success" as const,
           icon: <DollarSign className="w-4 h-4" />,
           data: Array.from({length: 10}, (_, i) => ({ value: 1000 + Math.random() * 500 })) // volatile
       },
       creditUtilization: {
           label: "Credit Utilization",
           value: `${utilPct.toFixed(1)}%`,
           subValue: `${(creditDebt).toFixed(0)} / ${totalLimit}`,
           change: 1.2,
           trend: "up" as const,
           status: utilPct > 30 ? "warning" : "success" as const,
           icon: <CreditCard className="w-4 h-4" />,
           data: Array.from({length: 10}, (_, i) => ({ value: 10 + i })) // slightly increasing
       }
    };
  }, [summary]);

  // Mock Data for Financial Health Chart
  const healthData = useMemo(() => {
     return [
        { month: 'Jan', assets: 45000, liabilities: -5000, netWorth: 40000 },
        { month: 'Feb', assets: 46000, liabilities: -4800, netWorth: 41200 },
        { month: 'Mar', assets: 47500, liabilities: -5200, netWorth: 42300 },
        { month: 'Apr', assets: 48000, liabilities: -4500, netWorth: 43500 },
        { month: 'May', assets: 49500, liabilities: -4200, netWorth: 45300 },
        { month: 'Jun', assets: 51000, liabilities: -4000, netWorth: 47000 },
     ];
  }, []);

  if (isLoading || !tickerMetrics) {
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
            <FinancialHealthChart data={healthData} />
            
            {/* Action Items / Recent Alerts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Placeholder for Quick Actions or Recent Transactions Summary */}
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
                 
                 <div className="bg-card-bg border border-border rounded-lg p-6">
                    <h3 className="font-semibold text-primary-text mb-4">Recent Alerts</h3>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-2 rounded bg-hover-bg/50">
                            <div className="w-2 h-2 mt-1.5 rounded-full bg-warning"></div>
                            <div>
                                <p className="text-sm font-medium text-primary-text">Budget Warning: Dining</p>
                                <p className="text-xs text-secondary-text">You've reached 85% of your Dining budget.</p>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>
        </section>

        {/* Right Panel */}
        <aside className="space-y-6">
            <ForecasterWidget 
                currentNetWorth={summary.netWorth} 
                avgMonthlySavings={(summary.monthlySnapshot?.savings || 0)} 
                avgMonthlyReturns={0.06}
            />
        </aside>
      </div>
    </div>
  );
}
