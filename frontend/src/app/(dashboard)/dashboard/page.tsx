"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  analyticsApi,
  type DashboardOverview,
  type UpcomingBill,
  type SpendingTrendItem,
} from "@/lib/api/analytics";
import { transactionApi, type Transaction } from "@/lib/api/transactions";
import { GmailSyncButton } from "@/components/gmail/GmailSyncButton";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { AppLayout } from "@/components/layout";
import { RefreshCw, CreditCard, TrendingUp, Calendar, Award } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui";

/**
 * Dashboard Page
 * Main dashboard view showing overview of cards, transactions, and analytics
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);
  const [spendingTrend, setSpendingTrend] = useState<SpendingTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncChecked, setAutoSyncChecked] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    checkAndAutoSync();

    const handleTransactionsUpdated = () => {
      loadDashboardData();
    };

    window.addEventListener("transactions-updated", handleTransactionsUpdated);
    window.addEventListener("refresh-dashboard", handleTransactionsUpdated);

    return () => {
      window.removeEventListener("transactions-updated", handleTransactionsUpdated);
      window.removeEventListener("refresh-dashboard", handleTransactionsUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewData, transactionsData, billsData, trendData] = await Promise.all([
        analyticsApi.getDashboardOverview(),
        transactionApi.getRecentTransactions(5),
        analyticsApi.getUpcomingBills(30),
        analyticsApi.getSpendingTrend("month", 6),
      ]);
      setOverview(overviewData);
      setRecentTransactions(transactionsData);
      setUpcomingBills(billsData);
      setSpendingTrend(trendData);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndAutoSync = async () => {
    if (autoSyncChecked || !user) return;

    try {
      setAutoSyncChecked(true);
      const response = await apiClient.get<{
        connected: boolean;
        historyId: string | null;
        lastSync: string | null;
      }>(`/api/gmail/status`);

      if (!response.data?.connected) return;

      const lastSync = response.data.lastSync ? new Date(response.data.lastSync) : null;
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      if (!lastSync || lastSync < thirtyMinutesAgo) {
        setIsAutoSyncing(true);
        apiClient.post("/api/gmail/sync", {})
          .then((result: any) => {
            setIsAutoSyncing(false);
            if (result.data?.summary?.newTransactions > 0) {
              window.dispatchEvent(new CustomEvent("transactions-updated"));
            }
          })
          .catch(() => setIsAutoSyncing(false));
      }
    } catch (error) {
      console.error("Auto-sync check failed:", error);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard" showRightSidebar={false}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Gmail Sync Status */}
        <div className="flex justify-end">
          <div className="flex items-center gap-4">
            {isAutoSyncing && (
              <div className="flex items-center gap-2 text-sm text-secondary-text">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
            <GmailSyncButton onSyncComplete={loadDashboardData} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-secondary-text font-medium">Total Balance</p>
                <h3 className="text-2xl font-bold text-primary-text mt-2">
                  {formatCurrency(overview?.total_outstanding || 0)}
                </h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-secondary-text mt-4">Across {overview?.total_cards} cards</p>
          </div>

          <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-secondary-text font-medium">Monthly Spending</p>
                <h3 className="text-2xl font-bold text-primary-text mt-2">
                  {formatCurrency(overview?.monthly_spending || 0)}
                </h3>
              </div>
              <div className="p-2 bg-warning/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
            </div>
            {overview?.monthly_budget && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary-text">Budget</span>
                  <span className={cn(
                    (overview.budget_utilization || 0) > 90 ? "text-error" : "text-success"
                  )}>
                    {overview.budget_utilization?.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-hover-bg rounded-full h-1.5">
                  <div 
                    className={cn("h-1.5 rounded-full", (overview.budget_utilization || 0) > 90 ? "bg-error" : "bg-success")}
                    style={{ width: `${Math.min(overview.budget_utilization || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-secondary-text font-medium">Upcoming Bills</p>
                <h3 className="text-2xl font-bold text-primary-text mt-2">
                  {upcomingBills.length}
                </h3>
              </div>
              <div className="p-2 bg-error/10 rounded-lg">
                <Calendar className="w-5 h-5 text-error" />
              </div>
            </div>
            <p className="text-xs text-secondary-text mt-4">
              {upcomingBills.length > 0 
                ? `Next due in ${Math.min(...upcomingBills.map(b => b.days_until_due))} days`
                : "No bills due soon"}
            </p>
          </div>

          <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-secondary-text font-medium">Total Rewards</p>
                <h3 className="text-2xl font-bold text-primary-text mt-2">
                  {/* Placeholder for rewards points, assuming it comes from overview or separate API */}
                  24,500
                </h3>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Award className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-xs text-secondary-text mt-4">~ ₹6,125 value</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spending Trend */}
          <div className="lg:col-span-2 bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <SpendingTrendChart data={spendingTrend} />
          </div>

          {/* Reminders / Recent Activity */}
          <div className="space-y-6">
            <RemindersWidget />
            
            <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-primary-text">Recent Transactions</h3>
                <Link href="/transactions" className="text-xs text-primary-green hover:underline">View All</Link>
              </div>
              <div className="space-y-4">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-secondary-text text-center py-4">No recent transactions</p>
                ) : (
                  recentTransactions.map((t) => (
                    <div key={t.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-hover-bg flex items-center justify-center text-xs font-medium text-secondary-text">
                          {t.merchant_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary-text truncate max-w-[120px]">{t.merchant_name}</p>
                          <p className="text-xs text-secondary-text">{new Date(t.transaction_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        t.transaction_type === "debit" ? "text-primary-text" : "text-success"
                      )}>
                        {t.transaction_type === "debit" ? "-" : "+"}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Bills List */}
        {upcomingBills.length > 0 && (
          <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-primary-text">Upcoming Bills</h3>
              <Link href="/bills" className="text-xs text-primary-green hover:underline">View All</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingBills.map((bill) => (
                <div key={bill.card_id} className="p-4 rounded-lg bg-hover-bg border border-muted-text/5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-primary-text">{bill.card_name}</p>
                      <p className="text-xs text-secondary-text">{bill.bank_name}</p>
                    </div>
                    <Badge variant="warning" className="bg-warning/10 text-warning border-0">
                      Due in {bill.days_until_due}d
                    </Badge>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    <div>
                      <p className="text-xs text-secondary-text">Amount Due</p>
                      <p className="text-lg font-bold text-primary-text">{formatCurrency(bill.outstanding)}</p>
                    </div>
                    <Button size="sm" variant="secondary">Pay Now</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Badge({ className, variant, children }: { className?: string, variant?: string, children: React.ReactNode }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", className)}>
      {children}
    </span>
  );
}
