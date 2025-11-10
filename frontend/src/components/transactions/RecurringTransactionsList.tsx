"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Calendar,
  Pause,
  Play,
  X,
  Clock,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";

interface RecurringTransaction {
  id: string;
  merchant_name: string;
  amount: number;
  frequency:
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "annually";
  category?: string;
  next_execution: string;
  last_execution?: string;
  status: "active" | "paused" | "completed" | "cancelled";
  execution_count: number;
  auto_execute: boolean;
  notification_enabled: boolean;
  cards?: {
    card_name: string;
    bank_name: string;
  };
}

export default function RecurringTransactionsList() {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "paused" | "all">("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchRecurringTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchRecurringTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = filter !== "all" ? `?status=${filter}` : "";

      const data = await apiClient.get<RecurringTransaction[]>(
        `/api/recurring-transactions${statusParam}`
      );
      setTransactions(data.data || []);
    } catch (error) {
      console.error("Error fetching recurring transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePause = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/api/recurring-transactions/${id}/pause`, {});
      showNotification("success", "Transaction paused successfully");
      fetchRecurringTransactions();
    } catch (error) {
      console.error("Error pausing transaction:", error);
      showNotification("error", "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/api/recurring-transactions/${id}/resume`, {});
      showNotification("success", "Transaction resumed successfully");
      fetchRecurringTransactions();
    } catch (error) {
      console.error("Error resuming transaction:", error);
      showNotification("error", "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string, merchantName: string) => {
    if (
      !confirm(
        `Are you sure you want to cancel recurring payment for ${merchantName}?`
      )
    ) {
      return;
    }

    try {
      await apiClient.post(`/api/recurring-transactions/${id}/cancel`, {});
      fetchRecurringTransactions();
    } catch (error) {
      console.error("Error cancelling transaction:", error);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: "Daily",
      weekly: "Weekly",
      biweekly: "Bi-weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      annually: "Annually",
    };
    return labels[frequency] || frequency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateMonthlyAmount = (amount: number, frequency: string) => {
    const multipliers: Record<string, number> = {
      daily: 30,
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
    };
    return amount * (multipliers[frequency] || 1);
  };

  // Memoize expensive calculations
  const totalMonthlySpend = useMemo(() => {
    return transactions
      .filter((t) => t.status === "active")
      .reduce(
        (sum, t) => sum + calculateMonthlyAmount(t.amount, t.frequency),
        0
      );
  }, [transactions]);

  const activeCount = useMemo(() => {
    return transactions.filter((t) => t.status === "active").length;
  }, [transactions]);

  const totalExecutions = useMemo(() => {
    return transactions.reduce((sum, t) => sum + t.execution_count, 0);
  }, [transactions]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-live="polite"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <span className="sr-only">Loading recurring transactions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 transform ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
          role="alert"
          aria-live="polite"
        >
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2
            id="recurring-heading"
            className="text-2xl font-bold text-gray-900"
          >
            Recurring Transactions
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your automated recurring payments and subscriptions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Add new recurring transaction"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          Add Recurring
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Recurring</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {activeCount}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Spend</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ₹{totalMonthlySpend.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Executions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totalExecutions}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div
        role="group"
        aria-label="Filter recurring transactions"
        className="flex gap-2"
      >
        {(["all", "active", "paused"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as "active" | "paused" | "all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
            aria-pressed={filter === f}
            aria-label={`Show ${f} recurring transactions`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No recurring transactions found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first recurring transaction
            </button>
          </div>
        ) : (
          <div
            role="list"
            aria-label="Recurring transactions"
            className="divide-y divide-gray-200"
          >
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                role="listitem"
                className="p-6 hover:bg-gray-50 transition-colors"
                aria-labelledby={`transaction-name-${transaction.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3
                        id={`transaction-name-${transaction.id}`}
                        className="text-lg font-semibold text-gray-900"
                      >
                        {transaction.merchant_name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          transaction.status
                        )}`}
                        role="status"
                        aria-label={`Status: ${transaction.status}`}
                      >
                        {transaction.status}
                      </span>
                      {transaction.auto_execute && (
                        <span
                          className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          aria-label="Automatically executes"
                        >
                          Auto
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="font-medium text-gray-900">Amount</p>
                        <p>₹{transaction.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Frequency</p>
                        <p>{getFrequencyLabel(transaction.frequency)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Next Payment
                        </p>
                        <p>
                          {format(
                            new Date(transaction.next_execution),
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Executions</p>
                        <p>{transaction.execution_count}</p>
                      </div>
                    </div>

                    {transaction.cards && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Card:</span>{" "}
                        {transaction.cards.card_name} (
                        {transaction.cards.bank_name})
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    {transaction.status === "active" && (
                      <button
                        onClick={() => handlePause(transaction.id)}
                        disabled={actionLoading === transaction.id}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Pause"
                        aria-label={`Pause recurring payment for ${transaction.merchant_name}`}
                      >
                        {actionLoading === transaction.id ? (
                          <div
                            className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Pause className="w-5 h-5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                    {transaction.status === "paused" && (
                      <button
                        onClick={() => handleResume(transaction.id)}
                        disabled={actionLoading === transaction.id}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Resume"
                        aria-label={`Resume recurring payment for ${transaction.merchant_name}`}
                      >
                        {actionLoading === transaction.id ? (
                          <div
                            className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Play className="w-5 h-5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleCancel(transaction.id, transaction.merchant_name)
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel"
                      aria-label={`Cancel recurring payment for ${transaction.merchant_name}`}
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal - Placeholder */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-title" className="text-xl font-bold mb-4">
              Add Recurring Transaction
            </h3>
            <p className="text-gray-600 mb-4">Create modal component here</p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              aria-label="Close modal"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
