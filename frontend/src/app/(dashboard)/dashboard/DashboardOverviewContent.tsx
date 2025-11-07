"use client";

import { useEffect, useState } from "react";
import {
  useAuthenticatedUser,
  validateArrayOwnership,
} from "@/lib/auth/user-context";
import { api } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/client";
import GmailSyncButton from "./GmailSyncButton";

interface BudgetStatus {
  currentSpend: number;
  budgetLimit: number;
  utilization: number;
  remainingBudget: number;
  period: string;
}

/**
 * Dashboard Overview Content (Client Component)
 * Handles data fetching and sync operations
 */
export default function DashboardOverviewContent() {
  const user = useAuthenticatedUser();
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load all dashboard data
   */
  async function loadDashboardData() {
    try {
      setLoading(true);

      // Fetch data in parallel
      const [budget, transactions] = await Promise.all([
        api.getBudgetStatus().catch(() => null),
        api.getTransactions({ limit: 10 }).catch(() => []),
      ]);

      // Validate transactions belong to current user
      if (transactions.length > 0) {
        validateArrayOwnership(user.id, transactions, "transactions");
      }

      setBudgetStatus(budget);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle Gmail sync
   */
  async function handleSync() {
    try {
      setSyncing(true);

      // Trigger sync
      const syncResult = await api.syncGmail();

      // Trigger service updates in parallel
      await Promise.all([
        api.updateBudget(),
        api.checkAlerts(),
        api.refreshAnalytics(),
      ]);

      // Reload dashboard data
      await loadDashboardData();

      // Show success message
      const message = `Synced ${syncResult.newTransactions} new transactions (${syncResult.duplicatesSkipped} duplicates skipped)`;
      console.log(message);
      // TODO: Show toast notification
    } catch (error) {
      console.error("Sync failed:", error);
      // TODO: Show error toast
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end">
        <GmailSyncButton onSync={handleSync} syncing={syncing} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <OverviewCard
          title="Current Spend"
          value={formatCurrency(budgetStatus?.currentSpend || 0)}
          trend="+12% from last month"
          icon="💰"
        />
        <OverviewCard
          title="Budget Limit"
          value={formatCurrency(budgetStatus?.budgetLimit || 0)}
          icon="🎯"
        />
        <OverviewCard
          title="Utilization"
          value={`${budgetStatus?.utilization || 0}%`}
          trend={
            budgetStatus && budgetStatus.utilization > 80
              ? "High usage"
              : "Normal"
          }
          icon="📊"
          alert={budgetStatus ? budgetStatus.utilization > 80 : false}
        />
        <OverviewCard
          title="Remaining"
          value={formatCurrency(budgetStatus?.remainingBudget || 0)}
          icon="💵"
        />
      </div>

      {/* Budget Progress */}
      {budgetStatus && (
        <div className="bg-card-bg rounded-lg p-6 border border-border">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Budget Progress
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-text">
                {formatCurrency(budgetStatus.currentSpend)} of{" "}
                {formatCurrency(budgetStatus.budgetLimit)}
              </span>
              <span className="text-primary-text font-medium">
                {budgetStatus.utilization.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  budgetStatus.utilization > 90
                    ? "bg-red-500"
                    : budgetStatus.utilization > 75
                      ? "bg-yellow-500"
                      : "bg-primary-green"
                }`}
                style={{ width: `${Math.min(budgetStatus.utilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-card-bg rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-4">
          Recent Transactions
        </h3>
        {recentTransactions.length === 0 ? (
          <p className="text-secondary-text text-center py-8">
            No transactions yet. Sync your Gmail to import transactions.
          </p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-hover transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-primary-text">
                    {transaction.merchant}
                  </p>
                  <p className="text-sm text-secondary-text">
                    {new Date(transaction.transactionDate).toLocaleDateString()}{" "}
                    • {transaction.category || "Uncategorized"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-text">
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Overview Card Component
 */
function OverviewCard({
  title,
  value,
  trend,
  icon,
  alert,
}: {
  title: string;
  value: string;
  trend?: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-card-bg rounded-lg p-6 border ${alert ? "border-red-500/50" : "border-border"}`}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-secondary-text">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-primary-text mb-1">{value}</p>
      {trend && (
        <p
          className={`text-sm ${alert ? "text-red-500" : "text-secondary-text"}`}
        >
          {trend}
        </p>
      )}
    </div>
  );
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
