"use client";

import React, { useState } from 'react';
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

  const transactions = getSampleTransactions();
  
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Transaction Timeline</h3>
          <p className="text-gray-400 text-sm">
            Recent activity across all your cards
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Calendar className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
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
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
                <h4 className="text-white font-semibold">{date}</h4>
                <div className="flex-1 h-px bg-gray-700/50"></div>
                <span className="text-gray-400 text-sm">
                  {dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Transactions for this date */}
              <div className="ml-6 space-y-3">
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
                        <div className="absolute left-6 top-16 w-px h-8 bg-gray-700/30"></div>
                      )}

                      {/* Transaction Card */}
                      <div className="flex items-center space-x-4 p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group">
                        {/* Category Icon */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center group-hover:bg-gray-700/70 transition-colors">
                            <CategoryIcon className="w-5 h-5 text-gray-300" />
                          </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-white font-medium truncate">
                              {transaction.description}
                            </h5>
                            <div className="flex items-center space-x-2">
                              <span className={`text-lg font-bold ${
                                isDebit ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {isDebit ? '-' : '+'}₹{Math.abs(transaction.amount).toLocaleString()}
                              </span>
                              {isDebit ? (
                                <ArrowUpRight className="w-4 h-4 text-red-400" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4 text-green-400" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-400 text-sm">{transaction.merchant}</span>
                              <span className="text-gray-500 text-xs">•</span>
                              <span className="text-gray-400 text-sm">{transaction.category}</span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${statusConfig.bgColor}`}>
                                <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
                                <span className={`text-xs font-medium ${statusConfig.color}`}>
                                  {transaction.status}
                                </span>
                              </div>
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

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-white font-medium mb-2">No transactions found</h4>
            <p className="text-gray-400 text-sm">
              Try adjusting your search or filter criteria
            </p>
          </motion.div>
        )}

        {/* Load More Button */}
        {!limit && filteredTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pt-4"
          >
            <button className="px-6 py-2 bg-gray-800/50 hover:bg-gray-800/70 text-white rounded-lg transition-colors">
              Load More Transactions
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TransactionTimeline;