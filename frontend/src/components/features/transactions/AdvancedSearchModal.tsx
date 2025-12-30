"use client";

import React, { useState } from "react";
import { Search, X, Filter, Calendar, DollarSign, Tag, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters) => void;
  categories: string[];
  instruments: { id: string; name: string }[];
}

export interface SearchFilters {
  query?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  category?: string;
  instrumentId?: string;
  direction?: "debit" | "credit" | "";
}

export function AdvancedSearchModal({
  isOpen,
  onClose,
  onSearch,
  categories,
  instruments,
}: AdvancedSearchModalProps) {
  const [filters, setFilters] = useState<SearchFilters>({});

  if (!isOpen) return null;

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card-bg rounded-xl shadow-xl border border-muted-text/10 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-muted-text/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary-text">
              Advanced Search
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-hover-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-text" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Text Search */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Search Text
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
              <input
                type="text"
                placeholder="Merchant, description, or reference..."
                value={filters.query || ""}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.fromDate || ""}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.toDate || ""}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                Min Amount
              </label>
              <input
                type="number"
                placeholder="₹0"
                value={filters.minAmount || ""}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                Max Amount
              </label>
              <input
                type="number"
                placeholder="₹∞"
                value={filters.maxAmount || ""}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Category
            </label>
            <select
              value={filters.category || ""}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Instrument */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Card / Account
            </label>
            <select
              value={filters.instrumentId || ""}
              onChange={(e) => setFilters({ ...filters, instrumentId: e.target.value })}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Instruments</option>
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Direction
            </label>
            <div className="flex gap-2">
              {[
                { value: "", label: "All" },
                { value: "debit", label: "Debit" },
                { value: "credit", label: "Credit" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters({ ...filters, direction: opt.value as any })}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg border transition-colors",
                    filters.direction === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-text/10 text-secondary-text hover:border-primary/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-muted-text/10">
          <button
            onClick={handleClear}
            className="text-secondary-text hover:text-primary-text transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-secondary-text hover:text-primary-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
