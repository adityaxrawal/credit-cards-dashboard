"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter,
  Search,
  Calendar,
  DollarSign,
  X,
  ChevronDown,
  Download,
  SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

interface FilterState {
  search: string;
  categories: string[];
  status: string[];
  dateRange: {
    start: string;
    end: string;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  cards: string[];
  transactionType: string[];
}

interface TransactionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: string[];
  cards: Array<{ id: string; name: string; last4: string }>;
  onExport: (format: 'csv' | 'pdf') => void;
  onClearFilters: () => void;
  className?: string;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onFiltersChange,
  categories,
  cards,
  onExport,
  onClearFilters,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAmountRange, setShowAmountRange] = useState(false);

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    updateFilters({ categories: newCategories });
  };

  const toggleStatus = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilters({ status: newStatus });
  };

  const toggleCard = (cardId: string) => {
    const newCards = filters.cards.includes(cardId)
      ? filters.cards.filter(c => c !== cardId)
      : [...filters.cards, cardId];
    updateFilters({ cards: newCards });
  };

  const toggleTransactionType = (type: string) => {
    const newTypes = filters.transactionType.includes(type)
      ? filters.transactionType.filter(t => t !== type)
      : [...filters.transactionType, type];
    updateFilters({ transactionType: newTypes });
  };

  const hasActiveFilters = () => {
    return filters.search ||
           filters.categories.length > 0 ||
           filters.status.length > 0 ||
           filters.cards.length > 0 ||
           filters.transactionType.length > 0 ||
           filters.dateRange.start ||
           filters.dateRange.end ||
           filters.amountRange.min !== null ||
           filters.amountRange.max !== null;
  };

  const statusOptions = [
    { value: 'completed', label: 'Completed', color: 'bg-green-500' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
    { value: 'failed', label: 'Failed', color: 'bg-red-500' }
  ];

  const transactionTypes = [
    { value: 'debit', label: 'Expenses', color: 'bg-red-500' },
    { value: 'credit', label: 'Income', color: 'bg-green-500' }
  ];

  return (
    <div className={`glass-card rounded-xl p-4 border border-gray-700/50 ${className}`}>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search transactions, merchants, descriptions..."
          value={filters.search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Filter Toggle and Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg text-gray-300 hover:text-white transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">Advanced Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </motion.button>
          
          {hasActiveFilters() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onClearFilters}
              className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs hover:bg-red-500/30 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear All
            </motion.button>
          )}
        </div>

        {/* Export Options */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onExport('csv')}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            CSV
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onExport('pdf')}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </motion.button>
        </div>
      </div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 border-t border-gray-700/50 pt-4"
          >
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => updateFilters({ 
                      dateRange: { ...filters.dateRange, start: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <span className="text-gray-400 self-center">to</span>
                <div className="flex-1">
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => updateFilters({ 
                      dateRange: { ...filters.dateRange, end: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount Range</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Min amount"
                    value={filters.amountRange.min || ''}
                    onChange={(e) => updateFilters({ 
                      amountRange: { 
                        ...filters.amountRange, 
                        min: e.target.value ? parseFloat(e.target.value) : null 
                      }
                    })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <span className="text-gray-400 self-center">to</span>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Max amount"
                    value={filters.amountRange.max || ''}
                    onChange={(e) => updateFilters({ 
                      amountRange: { 
                        ...filters.amountRange, 
                        max: e.target.value ? parseFloat(e.target.value) : null 
                      }
                    })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <motion.button
                    key={category}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      filters.categories.includes(category)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    {category}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(status => (
                  <motion.button
                    key={status.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleStatus(status.value)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      filters.status.includes(status.value)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                    {status.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Transaction Type</label>
              <div className="flex flex-wrap gap-2">
                {transactionTypes.map(type => (
                  <motion.button
                    key={type.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleTransactionType(type.value)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      filters.transactionType.includes(type.value)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${type.color}`}></div>
                    {type.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Cards */}
            {cards.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Credit Cards</label>
                <div className="flex flex-wrap gap-2">
                  {cards.map(card => (
                    <motion.button
                      key={card.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleCard(card.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        filters.cards.includes(card.id)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      {card.name} ••••{card.last4}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filters Summary */}
      {hasActiveFilters() && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 pt-4 border-t border-gray-700/50"
        >
          <div className="flex flex-wrap gap-2">
            {filters.categories.map(category => (
              <span key={category} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                {category}
                <button onClick={() => toggleCategory(category)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.status.map(status => (
              <span key={status} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                {status}
                <button onClick={() => toggleStatus(status)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.dateRange.start && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                From: {format(new Date(filters.dateRange.start), 'MMM dd, yyyy')}
                <button onClick={() => updateFilters({ dateRange: { ...filters.dateRange, start: '' } })}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.dateRange.end && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                To: {format(new Date(filters.dateRange.end), 'MMM dd, yyyy')}
                <button onClick={() => updateFilters({ dateRange: { ...filters.dateRange, end: '' } })}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TransactionFilters;
export type { FilterState };