"use client";

import { useState, useEffect } from "react";
import {
  transactionApi,
  type Transaction,
  type TransactionFilters as TxFilters,
  type PaginationOptions,
} from "@/lib/api/transactions";
import { cardApi, type Card } from "@/lib/api/cards";
import TransactionFilters from "./TransactionFilters";
import Link from "next/link";

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TxFilters>({});
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 20,
    sortBy: "transaction_date",
    sortOrder: "desc",
  });
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination]);

  const loadCards = async () => {
    try {
      const data = await cardApi.getCards();
      setCards(data);
    } catch (err) {
      console.error("Failed to load cards:", err);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await transactionApi.getTransactions(
        filters,
        pagination
      );
      setTransactions(response.transactions);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transactions"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      await transactionApi.deleteTransaction(transactionId);
      loadTransactions();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete transaction"
      );
    }
  };

  const handleFilterChange = (newFilters: TxFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "debit":
        return "text-red-600";
      case "credit":
        return "text-green-600";
      case "refund":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const getTransactionTypeSign = (type: string) => {
    return type === "credit" || type === "refund" ? "+" : "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Transactions</h2>
        <Link
          href="/transactions/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Transaction
        </Link>
      </div>

      <TransactionFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        cards={cards}
      />

      {loading && transactions.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-600">Loading transactions...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadTransactions}
            className="mt-2 text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No transactions found
          </h3>
          <p className="text-gray-500 mb-6">
            {Object.keys(filters).length > 0
              ? "Try adjusting your filters"
              : "Get started by adding your first transaction"}
          </p>
          <Link
            href="/transactions/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Transaction
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Merchant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Card
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(
                          transaction.transaction_date
                        ).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-800">
                          {transaction.merchant_name}
                        </div>
                        {transaction.description && (
                          <div className="text-xs text-gray-500">
                            {transaction.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.merchant_category || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.card ? (
                          <div>
                            <div className="font-medium">
                              {transaction.card.card_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              •••• {transaction.card.last_four_digits}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold text-right ${getTransactionTypeColor(
                          transaction.transaction_type
                        )}`}
                      >
                        {getTransactionTypeSign(transaction.transaction_type)}₹
                        {transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            transaction.transaction_type === "debit"
                              ? "bg-red-100 text-red-700"
                              : transaction.transaction_type === "credit"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {transaction.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/transactions/${transaction.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page! - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page! + 1)}
                disabled={pagination.page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
