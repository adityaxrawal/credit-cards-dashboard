"use client";

import { useState, useEffect } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { GmailSyncButton } from "@/components/features/gmail/GmailSyncButton";
import { RemindersWidget } from "@/components/features/dashboard/RemindersWidget";
import { SpendingTrendChart } from "@/components/features/dashboard/SpendingTrendChart";
import { AppLayout } from "@/components/layout";
import { RefreshCw, CreditCard, TrendingUp, Calendar, Award } from "lucide-react";
import { DashboardStatsGrid } from "./DashboardStatsGrid";
import { DashboardRecentTransactions } from "./DashboardRecentTransactions";
import { DashboardUpcomingBills } from "./DashboardUpcomingBills";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { DashboardSubscriptionCard } from "./DashboardSubscriptionCard";
import { AccountHealthSummary } from "./AccountHealthSummary";
import { CashflowChart } from "./CashflowChart";
import { GoalProgressBars } from "./GoalProgressBars";
import { AlertsPanel } from "./AlertsPanel";

/**
 * Dashboard Page
 * Main dashboard view showing overview of cards, transactions, and analytics
 */
export default function DashboardPage() {
  const {
    overview,
    budgetStatus,
    recentTransactions,
    upcomingBills,
    totalUpcomingBillAmount,
    spendingTrend,
    totalBalance,
    totalCards,
    totalRewards,
    loading,
    loadDashboardData,
    user,
    recurringStats
  } = useDashboardData();

  const [autoSyncChecked, setAutoSyncChecked] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  useEffect(() => {
    console.log("[DashboardClient] Component Mounted");
    loadDashboardData();
    checkAndAutoSync();

    const handleTransactionsUpdated = () => {
      console.log("[DashboardClient] Transactions updated event received");
      loadDashboardData();
    };

    window.addEventListener("transactions-updated", handleTransactionsUpdated);
    window.addEventListener("refresh-dashboard", handleTransactionsUpdated);

    return () => {
      window.removeEventListener("transactions-updated", handleTransactionsUpdated);
      window.removeEventListener("refresh-dashboard", handleTransactionsUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboardData]);

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

      // In the new backend, sync is handled via Pub/Sub or manual trigger
      // We can check if we need to trigger a historical scan or just let it be
      // For now, we'll just check status
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
            <GmailSyncButton onSyncComplete={() => loadDashboardData(true)} />
          </div>
        </div>

        {/* Account Health Summary - New Component */}
        <AccountHealthSummary />

        {/* KPI Cards */}
        <DashboardStatsGrid
          totalBalance={totalBalance}
          totalCards={totalCards}
          currentMonthSpent={overview?.currentMonth?.totalSpent || 0}
          budgetStatus={budgetStatus}
          upcomingBillsCount={upcomingBills.length}
          totalUpcomingBillAmount={totalUpcomingBillAmount}
          upcomingBills={upcomingBills}
          totalRewards={totalRewards}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cashflow Chart - New Component */}
            <CashflowChart />

            {/* Spending Trend */}
            <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
              <SpendingTrendChart data={spendingTrend} />
            </div>
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            {/* Alerts Panel - New Component */}
            <AlertsPanel />

            {/* Goal Progress - New Component */}
            <GoalProgressBars />

            <DashboardSubscriptionCard stats={recurringStats || { totalMonthly: 0, activeCount: 0 }} />
            <RemindersWidget />
            
            <DashboardRecentTransactions transactions={recentTransactions} />
          </div>
        </div>

        {/* Upcoming Bills List */}
        <DashboardUpcomingBills bills={upcomingBills || []} />
      </div>
    </AppLayout>
  );
}
