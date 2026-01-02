"use client";

import React from "react";
import { Search, Filter, X } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";
import { Card } from "@/features/cards/api";
import { TransactionFilters as FilterType } from "@/features/transactions/api";

interface TransactionFiltersProps {
  filters: FilterType;
  onFilterChange: (filters: FilterType) => void;
  cards: Card[];
}

export function TransactionFilters({
  filters,
  onFilterChange,
  cards,
}: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleChange = (key: keyof FilterType, value: unknown) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const activeFiltersCount = Object.keys(filters).filter(
    (key) => filters[key as keyof FilterType] !== undefined && filters[key as keyof FilterType] !== ""
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-text" />
          <Input
            placeholder="Search by merchant..."
            value={filters.merchant || ""}
            onChange={(e) => handleChange("merchant", e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={isOpen ? "primary" : "secondary"}
            onClick={() => setIsOpen(!isOpen)}
            className="whitespace-nowrap"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 bg-primary-bg text-primary-text text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="bg-card-bg p-4 rounded-lg border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-secondary-text mb-1 block">
              Card
            </label>
            <select
              className="w-full p-2 rounded-lg border border-border bg-input-bg text-primary-text focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
              value={filters.cardId || ""}
              onChange={(e) => handleChange("cardId", e.target.value)}
            >
              <option value="">All Cards</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name} (••{card.card_number_last4})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary-text mb-1 block">
              Type
            </label>
            <select
              className="w-full p-2 rounded-lg border border-border bg-input-bg text-primary-text focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
              value={filters.transactionType || ""}
              onChange={(e) => handleChange("transactionType", e.target.value)}
            >
              <option value="">All Types</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="refund">Refund</option>
              <option value="bill_payment">Bill Payment</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary-text mb-1 block">
              From Date
            </label>
            <Input
              type="date"
              value={filters.from || ""}
              onChange={(e) => handleChange("from", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-secondary-text mb-1 block">
              To Date
            </label>
            <Input
              type="date"
              value={filters.to || ""}
              onChange={(e) => handleChange("to", e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-secondary-text mb-1 block">
              Category
            </label>
            <Input
              placeholder="e.g. Food"
              value={filters.category || ""}
              onChange={(e) => handleChange("category", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
