"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cardApi, type CardFormData, type Card } from "@/lib/api/cards";

interface CardFormProps {
  card?: Card;
  mode: "create" | "edit";
}

export default function CardForm({ card, mode }: CardFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CardFormData>({
    card_name: card?.card_name || "",
    bank_name: card?.bank_name || "",
    card_type: card?.card_type || "credit",
    last_four_digits: card?.last_four_digits || "",
    credit_limit: card?.credit_limit || 0,
    bill_date: card?.bill_date || 1,
    due_date: card?.due_date || 10,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (formData.last_four_digits.length !== 4) {
        throw new Error("Last four digits must be exactly 4 characters");
      }
      if (formData.credit_limit <= 0) {
        throw new Error("Credit limit must be greater than 0");
      }
      if (formData.bill_date < 1 || formData.bill_date > 31) {
        throw new Error("Bill date must be between 1 and 31");
      }
      if (formData.due_date < 1 || formData.due_date > 31) {
        throw new Error("Due date must be between 1 and 31");
      }

      if (mode === "create") {
        await cardApi.createCard(formData);
        router.push("/cards");
      } else if (card) {
        await cardApi.updateCard(card.id, formData);
        router.push(`/cards/${card.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card");
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "credit_limit" || name === "bill_date" || name === "due_date"
          ? Number(value)
          : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {mode === "create" ? "Add New Card" : "Edit Card"}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="card_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Card Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="card_name"
              name="card_name"
              value={formData.card_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., HDFC Regalia"
            />
          </div>

          <div>
            <label
              htmlFor="bank_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Bank Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="bank_name"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., HDFC Bank"
            />
          </div>

          <div>
            <label
              htmlFor="card_type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Card Type <span className="text-red-500">*</span>
            </label>
            <select
              id="card_type"
              name="card_type"
              value={formData.card_type}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="last_four_digits"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last Four Digits <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="last_four_digits"
              name="last_four_digits"
              value={formData.last_four_digits}
              onChange={handleChange}
              required
              maxLength={4}
              pattern="[0-9]{4}"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1234"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the last 4 digits of your card
            </p>
          </div>

          <div>
            <label
              htmlFor="credit_limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Credit Limit <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="credit_limit"
              name="credit_limit"
              value={formData.credit_limit}
              onChange={handleChange}
              required
              min="0"
              step="1000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="50000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bill_date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="bill_date"
                name="bill_date"
                value={formData.bill_date}
                onChange={handleChange}
                required
                min="1"
                max="31"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Day of month (1-31)</p>
            </div>

            <div>
              <label
                htmlFor="due_date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                min="1"
                max="31"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Day of month (1-31)</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading
              ? "Saving..."
              : mode === "create"
              ? "Add Card"
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
