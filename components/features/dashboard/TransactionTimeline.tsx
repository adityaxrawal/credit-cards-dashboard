"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  ShoppingBag,
  Car,
  Coffee,
  Gamepad2,
  Home,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { getSampleTransactions } from '@/lib/sampleData';
import type { Transaction } from '@/lib/sampleData';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';

interface TransactionTimelineProps {
  className?: string;
  limit?: number;
}

const TransactionTimeline: React.FC<TransactionTimelineProps> = ({ 
  className = '', 
  limit 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('');
  const [selectedAmountRange, setSelectedAmountRange] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const transactions = getSampleTransactions() || [];
  
  // Filter transactions
  const filteredTransactions = transactions
    .filter((transaction: Transaction) => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          transaction.merchant.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || transaction.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || transaction.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .slice(0, limit);

  // Get unique categories for filter
  const categories = Array.from(new Set(transactions.map((t: Transaction) => t.category)));

  // Category icons mapping
  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'Food & Dining': Coffee,
      'Shopping': ShoppingBag,
      'Transportation': Car,
      'Entertainment': Gamepad2,
      'Bills & Utilities': Home,
      'Gas': Car,
      'Groceries': ShoppingBag,
      'Online': CreditCard
    };
    return iconMap[category] || MoreHorizontal;
  };

  // Status colors and icons
  const getStatusConfig = (status: string) => {
    const statusMap = {
      'completed': { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: CheckCircle },
      'pending': { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: Clock },
      'failed': { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: AlertCircle }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.completed;
  };

  // Format date for display
  const formatTransactionDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM dd, yyyy');
  };

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups: Record<string, Transaction[]>, transaction: Transaction) => {
    const dateKey = formatTransactionDate(transaction.transaction_date);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Transaction Timeline</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-full sm:w-auto"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/70 transition-colors text-sm"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Bills & Utilities">Bills & Utilities</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount Range</label>
                <select
                  value={selectedAmountRange}
                  onChange={(e) => setSelectedAmountRange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Amounts</option>
                  <option value="0-50">$0 - $50</option>
                  <option value="50-100">$50 - $100</option>
                  <option value="100-500">$100 - $500</option>
                  <option value="500+">$500+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="space-y-4 sm:space-y-6">
        {isLoading ? (
          <div className="space-y-4 sm:space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <LoadingSkeleton type="avatar" className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" />
                  <LoadingSkeleton type="text" className="h-5 sm:h-6 w-24 sm:w-32" />
                  <div className="flex-1">
                    <LoadingSkeleton type="text" className="h-px w-full" />
                  </div>
                  <LoadingSkeleton type="text" className="h-3 sm:h-4 w-16 sm:w-20" />
                </div>
                <div className="ml-4 sm:ml-6 space-y-2 sm:space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <LoadingSkeleton key={j} type="list" className="h-16 sm:h-20" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {Object.entries(groupedTransactions).map(([date, dayTransactions], dateIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: dateIndex * 0.1 }}
              >
                {/* Date Header */}
                <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                  </div>
                  <h4 className="text-white font-semibold text-sm sm:text-base">{date}</h4>
                  <div className="flex-1 h-px bg-gray-700/50"></div>
                  <span className="text-gray-400 text-xs sm:text-sm">
                    {dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Transactions for this date */}
                <div className="ml-4 sm:ml-6 space-y-2 sm:space-y-3">
                  {dayTransactions.map((transaction, index) => {
                    const CategoryIcon = getCategoryIcon(transaction.category);
                    const statusConfig = getStatusConfig(transaction.status);
                    const StatusIcon = statusConfig.icon;
                    const isDebit = transaction.amount > 0; // All transactions in sample data are expenses (positive amounts)

                    return (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (dateIndex * 0.1) + (index * 0.05) }}
                        className="relative"
                      >
                        {/* Timeline connector */}
                        {index < dayTransactions.length - 1 && (
                          <div className="absolute left-4 sm:left-6 top-12 sm:top-16 w-px h-6 sm:h-8 bg-gray-700/30"></div>
                        )}

                        {/* Transaction Card */}
                        <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 p-3 sm:p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group">
                          {/* Category Icon */}
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-700/50 rounded-lg flex items-center justify-center group-hover:bg-gray-700/70 transition-colors">
                              <CategoryIcon className="w-3 h-3 sm:w-5 sm:h-5 text-gray-300" />
                            </div>
                          </div>

                          {/* Transaction Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 sm:mb-1">
                              <h5 className="text-white font-medium truncate text-sm sm:text-base">
                                {transaction.description}
                              </h5>
                              <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                                <span className={`text-base sm:text-lg font-bold ${
                                  isDebit ? 'text-red-400' : 'text-green-400'
                                }`}>
                                  {isDebit ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-400">
                                <span className="truncate">{transaction.merchant}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="truncate">{transaction.category}</span>
                              </div>
                              <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                                <StatusIcon className={`w-2 h-2 sm:w-3 sm:h-3 ${statusConfig.color}`} />
                                <span className={`text-xs font-medium ${statusConfig.color}`}>
                                  {transaction.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Empty State */}
        {!isLoading && filteredTransactions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 sm:py-12"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h4 className="text-white font-medium mb-2 text-sm sm:text-base">No transactions found</h4>
            <p className="text-gray-400 text-xs sm:text-sm">
              Try adjusting your search or filter criteria
            </p>
          </motion.div>
        )}

        {/* Load More Button */}
        {!isLoading && !limit && filteredTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pt-3 sm:pt-4"
          >
            <button className="px-4 sm:px-6 py-2 bg-gray-800/50 hover:bg-gray-800/70 text-white rounded-lg transition-colors text-sm sm:text-base">
              Load More Transactions
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TransactionTimeline;