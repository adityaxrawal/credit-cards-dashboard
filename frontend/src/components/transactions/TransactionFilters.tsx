"use client";

import { useState, useEffect } from "react";
import { type TransactionFilters as TxFilters } from "@/lib/api/transactions";
import { type Card } from "@/lib/api/cards";

interface TransactionFiltersProps {
  filters: TxFilters;
  onFilterChange: (filters: TxFilters) => void;
  cards: Card[];
}

export default function TransactionFilters({
  filters,
  onFilterChange,
  cards,
}: TransactionFiltersProps) {
  const [localFilters, setLocalFilters] = useState<TxFilters>(filters);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (name: string, value: string | number | undefined) => {
    const newFilters = { ...localFilters };
    if (value === "" || value === undefined) {
      delete newFilters[name as keyof TxFilters];
    } else {
      newFilters[name as keyof TxFilters] = value as never;
    }
    setLocalFilters(newFilters);
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleClear = () => {
    setLocalFilters({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">
          Filters{" "}
          {hasActiveFilters && `(${Object.keys(filters).length} active)`}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          {isExpanded ? "Hide" : "Show"} Filters
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card Filter */}
            <div>
              <label
                htmlFor="cardId"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Card
              </label>
              <select
                id="cardId"
                value={localFilters.cardId || ""}
                onChange={(e) => handleChange("cardId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Cards</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_name} (••{card.last_four_digits})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={localFilters.startDate || ""}
                onChange={(e) => handleChange("startDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* End Date */}
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={localFilters.endDate || ""}
                onChange={(e) => handleChange("endDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Transaction Type */}
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Type
              </label>
              <select
                id="type"
                value={localFilters.type || ""}
                onChange={(e) => handleChange("type", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Types</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="refund">Refund</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Category
              </label>
              <input
                type="text"
                id="category"
                value={localFilters.category || ""}
                onChange={(e) => handleChange("category", e.target.value)}
                placeholder="e.g., Groceries"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Search */}
            <div>
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Search Merchant
              </label>
              <input
                type="text"
                id="search"
                value={localFilters.search || ""}
                onChange={(e) => handleChange("search", e.target.value)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Min Amount */}
            <div>
              <label
                htmlFor="minAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Min Amount
              </label>
              <input
                type="number"
                id="minAmount"
                value={localFilters.minAmount || ""}
                onChange={(e) =>
                  handleChange(
                    "minAmount",
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="0"
                min="0"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label
                htmlFor="maxAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Max Amount
              </label>
              <input
                type="number"
                id="maxAmount"
                value={localFilters.maxAmount || ""}
                onChange={(e) =>
                  handleChange(
                    "maxAmount",
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="No limit"
                min="0"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApply}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClear}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
