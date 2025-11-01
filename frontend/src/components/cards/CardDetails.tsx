"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cardApi, type Card, type CardStatistics } from "@/lib/api/cards";
import Link from "next/link";

interface CardDetailsProps {
  cardId: string;
}

export default function CardDetails({ cardId }: CardDetailsProps) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [statistics, setStatistics] = useState<CardStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cardData, statsData] = await Promise.all([
        cardApi.getCard(cardId),
        cardApi.getCardStatistics(cardId),
      ]);
      setCard(cardData);
      setStatistics(statsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load card details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this card? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await cardApi.deleteCard(cardId);
      router.push("/cards");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete card");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading card details...</div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error || "Card not found"}</p>
        <button
          onClick={loadCardData}
          className="mt-2 text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const utilization =
    card.credit_limit > 0
      ? Math.round((card.current_outstanding / card.credit_limit) * 100)
      : 0;
  const isHighUtilization = utilization > 70;
  const available = card.credit_limit - card.current_outstanding;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{card.card_name}</h1>
          <p className="text-gray-600 mt-1">{card.bank_name}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/cards/${card.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Card Information
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Card Type</p>
            <span
              className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                card.card_type === "credit"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {card.card_type}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Card Number</p>
            <p className="font-semibold text-gray-800">
              •••• {card.last_four_digits}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Bill Date</p>
            <p className="font-semibold text-gray-800">
              {card.bill_date} of each month
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Due Date</p>
            <p className="font-semibold text-gray-800">
              {card.due_date} of each month
            </p>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Credit Limit</p>
          <p className="text-2xl font-bold text-gray-800">
            ₹{card.credit_limit.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Current Outstanding</p>
          <p className="text-2xl font-bold text-gray-800">
            ₹{card.current_outstanding.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Available Credit</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{available.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Utilization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-gray-800">
            Credit Utilization
          </h2>
          <span
            className={`text-2xl font-bold ${
              isHighUtilization ? "text-red-600" : "text-gray-800"
            }`}
          >
            {utilization}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              isHighUtilization ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
        {isHighUtilization && (
          <p className="text-sm text-red-600 mt-2">
            ⚠️ High utilization detected. Consider paying down your balance.
          </p>
        )}
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Spending Statistics
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
              <p className="text-xl font-bold text-gray-800">
                {statistics.total_transactions}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Total Spent</p>
              <p className="text-xl font-bold text-gray-800">
                ₹{statistics.total_spent.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">This Month</p>
              <p className="text-xl font-bold text-blue-600">
                ₹{statistics.current_month_spent.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Transaction</p>
              <p className="text-xl font-bold text-gray-800">
                ₹{Math.round(statistics.average_transaction).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Category Breakdown */}
          {statistics.category_breakdown &&
            statistics.category_breakdown.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Top Categories
                </h3>
                <div className="space-y-2">
                  {statistics.category_breakdown
                    .slice(0, 5)
                    .map((category, index) => {
                      const percentage =
                        statistics.total_spent > 0
                          ? (category.total / statistics.total_spent) * 100
                          : 0;

                      return (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">
                              {category.category || "Uncategorized"}
                            </span>
                            <span className="font-semibold text-gray-800">
                              ₹{category.total.toLocaleString()} (
                              {percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/cards"
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Back to Cards
        </Link>
        <Link
          href={`/transactions?cardId=${card.id}`}
          className="flex-1 text-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          View Transactions
        </Link>
      </div>
    </div>
  );
}
