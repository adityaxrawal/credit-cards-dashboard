"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  transactionApi,
  type TransactionFormData,
  type Transaction,
} from "@/lib/api/transactions";
import { cardApi, type Card } from "@/lib/api/cards";

interface TransactionFormProps {
  transaction?: Transaction;
  mode: "create" | "edit";
}

export default function TransactionForm({
  transaction,
  mode,
}: TransactionFormProps) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TransactionFormData>({
    card_id: transaction?.card_id || "",
    transaction_date:
      transaction?.transaction_date.split("T")[0] ||
      new Date().toISOString().split("T")[0],
    merchant_name: transaction?.merchant_name || "",
    merchant_category: transaction?.merchant_category || "",
    amount: transaction?.amount || 0,
    transaction_type: transaction?.transaction_type || "debit",
    description: transaction?.description || "",
  });

  const loadCards = async () => {
    try {
      const data = await cardApi.getCards();
      setCards(data);
      if (data.length > 0 && !formData.card_id) {
        setFormData((prev) => ({ ...prev, card_id: data[0].id }));
      }
    } catch (err) {
      console.error("Failed to load cards:", err);
    }
  };

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!formData.card_id) {
        throw new Error("Please select a card");
      }
      if (formData.amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }
      if (!formData.merchant_name.trim()) {
        throw new Error("Merchant name is required");
      }

      if (mode === "create") {
        await transactionApi.createTransaction(formData);
        router.push("/transactions");
      } else if (transaction) {
        await transactionApi.updateTransaction(transaction.id, formData);
        router.push("/transactions");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save transaction"
      );
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  };

  const commonCategories = [
    "Groceries",
    "Dining",
    "Shopping",
    "Transport",
    "Entertainment",
    "Healthcare",
    "Bills & Utilities",
    "Travel",
    "Education",
    "Other",
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {mode === "create" ? "Add New Transaction" : "Edit Transaction"}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {cards.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-700">
              You need to add a card before creating transactions.{" "}
              <button
                type="button"
                onClick={() => router.push("/cards/new")}
                className="underline hover:no-underline"
              >
                Add a card
              </button>
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="card_id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Card <span className="text-red-500">*</span>
            </label>
            <select
              id="card_id"
              name="card_id"
              value={formData.card_id}
              onChange={handleChange}
              required
              disabled={cards.length === 0}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select a card</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name} (••{card.last_four_digits}) -{" "}
                  {card.bank_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="transaction_date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Transaction Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="transaction_date"
              name="transaction_date"
              value={formData.transaction_date}
              onChange={handleChange}
              required
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="merchant_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Merchant Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="merchant_name"
              name="merchant_name"
              value={formData.merchant_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Amazon, Starbucks"
            />
          </div>

          <div>
            <label
              htmlFor="merchant_category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Category
            </label>
            <select
              id="merchant_category"
              name="merchant_category"
              value={formData.merchant_category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a category</option>
              {commonCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Or type a custom category above
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label
                htmlFor="transaction_type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="transaction_type"
                name="transaction_type"
                value={formData.transaction_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="debit">Debit (Spend)</option>
                <option value="credit">Credit (Payment)</option>
                <option value="refund">Refund</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add any additional notes..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={loading || cards.length === 0}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading
              ? "Saving..."
              : mode === "create"
              ? "Add Transaction"
              : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
