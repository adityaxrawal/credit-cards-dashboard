"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  analyticsApi,
  type DashboardOverview,
  type UpcomingBill,
} from "@/lib/api/analytics";
import { transactionApi, type Transaction } from "@/lib/api/transactions";
import { GmailSyncButton } from "@/components/gmail/GmailSyncButton";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

/**
 * Dashboard Page
 * Main dashboard view showing overview of cards, transactions, and analytics
 */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncChecked, setAutoSyncChecked] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    checkAndAutoSync();

    // Listen for sync completion events
    const handleTransactionsUpdated = () => {
      loadDashboardData();
    };

    window.addEventListener("transactions-updated", handleTransactionsUpdated);
    window.addEventListener("refresh-dashboard", handleTransactionsUpdated);

    // Auto-refresh dashboard data every 5 minutes
    // Pause when tab is inactive to save bandwidth
    let refreshInterval: NodeJS.Timeout | null = null;

    const startAutoRefresh = () => {
      if (refreshInterval) return; // Already running
      console.log("Starting auto-refresh (5-minute interval)");
      refreshInterval = setInterval(() => {
        console.log("Auto-refreshing dashboard data");
        loadDashboardData();
      }, 5 * 60 * 1000); // 5 minutes
    };

    const stopAutoRefresh = () => {
      if (refreshInterval) {
        console.log("Pausing auto-refresh (tab inactive)");
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        console.log("Tab became active, resuming auto-refresh");
        loadDashboardData(); // Refresh immediately on tab activation
        startAutoRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start auto-refresh if tab is visible
    if (!document.hidden) {
      startAutoRefresh();
    }

    return () => {
      window.removeEventListener(
        "transactions-updated",
        handleTransactionsUpdated
      );
      window.removeEventListener(
        "refresh-dashboard",
        handleTransactionsUpdated
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopAutoRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewData, transactionsData, billsData] = await Promise.all([
        analyticsApi.getDashboardOverview(),
        transactionApi.getRecentTransactions(10),
        analyticsApi.getUpcomingBills(30),
      ]);
      setOverview(overviewData);
      setRecentTransactions(transactionsData);
      setUpcomingBills(billsData);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if auto-sync is needed (>30 minutes since last sync)
   * Triggers silent background sync if needed
   */
  const checkAndAutoSync = async () => {
    if (autoSyncChecked || !user) return;

    try {
      setAutoSyncChecked(true);

      // Fetch last sync time
      const data = await apiClient.get(`/api/gmail/last-sync/${user.id}`);

      if (!data.success || !data.gmailConnected) {
        return;
      }

      const lastSync = data.lastSync ? new Date(data.lastSync) : null;
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      // Trigger auto-sync if more than 30 minutes or first sync
      if (!lastSync || lastSync < thirtyMinutesAgo) {
        console.log(
          "Auto-syncing Gmail (>30 min since last sync or first sync)"
        );
        setIsAutoSyncing(true);

        // Silent background sync
        apiClient
          .post("/api/gmail/sync", {})
          .then(async (result: any) => {
            setIsAutoSyncing(false);
            if (result.summary?.newTransactions > 0) {
              console.log(
                `Auto-sync completed: ${result.summary.newTransactions} new transactions`
              );
              // Refresh dashboard data
              window.dispatchEvent(new CustomEvent("transactions-updated"));
            }
          })
          .catch((err) => {
            setIsAutoSyncing(false);
            console.error("Auto-sync failed:", err);
          });
      }
    } catch (error) {
      console.error("Auto-sync check failed:", error);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Welcome back, {user?.name}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/cards"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cards
                </Link>
                <Link
                  href="/transactions"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Transactions
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Gmail Sync Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <GmailSyncButton onSyncComplete={loadDashboardData} />
                {isAutoSyncing && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Auto-syncing Gmail...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Cards</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {overview?.total_cards || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Monthly Spending
              </h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                ₹{overview?.monthly_spending?.toLocaleString() || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Transactions
              </h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {overview?.total_transactions || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Outstanding</h3>
              <p className="mt-2 text-3xl font-semibold text-red-600">
                ₹{overview?.total_outstanding?.toLocaleString() || 0}
              </p>
            </div>
          </div>

          {/* Credit Utilization */}
          {overview && overview.total_cards > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Credit Utilization
                </h2>
                <span
                  className={`text-2xl font-bold ${
                    overview.credit_utilization > 70
                      ? "text-red-600"
                      : "text-gray-800"
                  }`}
                >
                  {overview.credit_utilization.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    overview.credit_utilization > 70
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min(overview.credit_utilization, 100)}%`,
                  }}
                />
              </div>
              {overview.monthly_budget && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Budget Progress</span>
                    <span className="font-semibold">
                      ₹{overview.monthly_spending?.toLocaleString()} / ₹
                      {overview.monthly_budget?.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        (overview.budget_utilization || 0) > 90
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          overview.budget_utilization || 0,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reminders Widget */}
          <div className="mb-8">
            <RemindersWidget />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Recent Transactions
                  </h2>
                  <Link
                    href="/transactions"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View All
                  </Link>
                </div>
              </div>
              <div className="p-6">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No transactions yet</p>
                    <Link
                      href="/transactions/new"
                      className="mt-4 inline-block text-blue-600 hover:text-blue-700"
                    >
                      Add your first transaction
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex justify-between items-start"
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {transaction.merchant_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(
                              transaction.transaction_date
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <p
                          className={`font-semibold ${
                            transaction.transaction_type === "debit"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {transaction.transaction_type === "credit" ||
                          transaction.transaction_type === "refund"
                            ? "+"
                            : "-"}
                          ₹{transaction.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Bills */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Upcoming Bills
                  </h2>
                  <Link
                    href="/cards"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View Cards
                  </Link>
                </div>
              </div>
              <div className="p-6">
                {upcomingBills.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No upcoming bills</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingBills.map((bill) => (
                      <div
                        key={bill.card_id}
                        className="flex justify-between items-start"
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {bill.card_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {bill.bank_name}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              bill.days_until_due <= 7
                                ? "text-red-600 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            {bill.days_until_due === 0
                              ? "Due today"
                              : bill.days_until_due === 1
                              ? "Due tomorrow"
                              : `Due in ${bill.days_until_due} days`}
                          </p>
                        </div>
                        <p className="font-semibold text-red-600">
                          ₹{bill.outstanding.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Empty State for No Cards */}
          {overview && overview.total_cards === 0 && (
            <div className="mt-8 bg-white rounded-lg shadow p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No credit cards added yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding your first credit card
              </p>
              <div className="mt-6">
                <Link
                  href="/cards/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Card
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
