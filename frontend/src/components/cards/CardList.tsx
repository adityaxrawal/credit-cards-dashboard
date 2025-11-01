"use client";

import { useState, useEffect } from "react";
import { cardApi, type Card } from "@/lib/api/cards";
import Link from "next/link";

export default function CardList() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cardApi.getCards();
      setCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this card?")) return;

    try {
      await cardApi.deleteCard(cardId);
      setCards(cards.filter((c) => c.id !== cardId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete card");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading cards...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadCards}
          className="mt-2 text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No cards yet
        </h3>
        <p className="text-gray-500 mb-6">
          Get started by adding your first credit card
        </p>
        <Link
          href="/cards/new"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Card
        </Link>
      </div>
    );
  }

  const calculateUtilization = (outstanding: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.round((outstanding / limit) * 100);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Your Cards</h2>
        <Link
          href="/cards/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Card
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const utilization = calculateUtilization(
            card.current_outstanding,
            card.credit_limit
          );
          const isHighUtilization = utilization > 70;

          return (
            <div
              key={card.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">
                    {card.card_name}
                  </h3>
                  <p className="text-sm text-gray-500">{card.bank_name}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    card.card_type === "credit"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {card.card_type}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">
                  •••• {card.last_four_digits}
                </p>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Outstanding</span>
                    <span className="font-semibold text-gray-800">
                      ₹{card.current_outstanding.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Credit Limit</span>
                    <span className="text-gray-800">
                      ₹{card.credit_limit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Utilization</span>
                  <span
                    className={`font-semibold ${
                      isHighUtilization ? "text-red-600" : "text-gray-800"
                    }`}
                  >
                    {utilization}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isHighUtilization ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-500 mb-4">
                <span>Bill Date: {card.bill_date}</span>
                <span>Due Date: {card.due_date}</span>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/cards/${card.id}`}
                  className="flex-1 text-center bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 transition-colors text-sm"
                >
                  View Details
                </Link>
                <Link
                  href={`/cards/${card.id}/edit`}
                  className="flex-1 text-center bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 transition-colors text-sm"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="px-3 py-2 rounded hover:bg-red-50 text-red-600 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
