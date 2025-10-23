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
  AlertCircle,
  List,
  GitBranch,
  Plus,
  Square,
  CheckSquare
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { getSampleTransactions } from '@/lib/sampleData';
import type { Transaction } from '@/lib/sampleData';
import TransactionFilters, { type FilterState } from './TransactionFilters';
import ManualTransactionForm, { type ManualTransactionData } from './ManualTransactionForm';
import BulkTransactionActions, { type BulkEditData } from './BulkTransactionActions';
import EmptyState from '@/components/shared/feedback/EmptyState';

interface MergedTransactionsComponentProps {
  className?: string;
  limit?: number;
}

const MergedTransactionsComponent: React.FC<MergedTransactionsComponentProps> = ({ 
  className = '', 
  limit 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categories: [],
    status: [],
    dateRange: { start: '', end: '' },
    amountRange: { min: null, max: null },
    cards: [],
    transactionType: []
  });

  const transactions = getSampleTransactions() || [];
  
  // Enhanced filtering logic
  const filteredTransactions = transactions
    .filter((transaction: Transaction) => {
      // Basic search
      const matchesSearch = !filters.search || 
        transaction.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        transaction.merchant.toLowerCase().includes(filters.search.toLowerCase());
      
      // Category filter
      const matchesCategory = filters.categories.length === 0 || 
        filters.categories.includes(transaction.category);
      
      // Status filter
      const matchesStatus = filters.status.length === 0 || 
        filters.status.includes(transaction.status);
      
      // Date range filter
      const transactionDate = new Date(transaction.transaction_date);
      const matchesDateRange = (!filters.dateRange.start || transactionDate >= new Date(filters.dateRange.start)) &&
        (!filters.dateRange.end || transactionDate <= new Date(filters.dateRange.end));
      
      // Amount range filter
      const amount = Math.abs(transaction.amount);
      const matchesAmountRange = (filters.amountRange.min === null || amount >= filters.amountRange.min) &&
        (filters.amountRange.max === null || amount <= filters.amountRange.max);
      
      // Transaction type filter
      const transactionType = transaction.amount > 0 ? 'credit' : 'debit';
      const matchesTransactionType = filters.transactionType.length === 0 || 
        filters.transactionType.includes(transactionType);
      
      return matchesSearch && matchesCategory && matchesStatus && 
             matchesDateRange && matchesAmountRange && matchesTransactionType;
    })
    .slice(0, limit || 50);

  // Get unique categories for filter
  const categories = Array.from(new Set(transactions.map((t: Transaction) => t.category)));
  
  // Mock cards data
  const cards = [
    { id: '1', name: 'HDFC Regalia', last4: '1234' },
    { id: '2', name: 'SBI SimplyCLICK', last4: '5678' },
    { id: '3', name: 'ICICI Amazon Pay', last4: '9012' }
  ];

  // Selection handlers
  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleSelectAll = () => {
    setSelectedTransactions(filteredTransactions.map(t => t.id));
  };

  const handleDeselectAll = () => {
    setSelectedTransactions([]);
  };

  // Manual transaction handler
  const handleManualTransaction = async (data: ManualTransactionData) => {
    // In a real app, this would make an API call
    console.log('Adding manual transaction:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  // Bulk action handler
  const handleBulkAction = async (action: string, data?: BulkEditData) => {
    console.log('Bulk action:', action, 'on transactions:', selectedTransactions, 'with data:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSelectedTransactions([]);
  };

  // Export handler
  const handleExport = (format: 'csv' | 'pdf') => {
    console.log('Exporting transactions as:', format);
    // In a real app, this would generate and download the file
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      categories: [],
      status: [],
      dateRange: { start: '', end: '' },
      amountRange: { min: null, max: null },
      cards: [],
      transactionType: []
    });
  };

  // Category icons mapping
  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string }> = {
      'Food & Dining': { icon: Coffee, color: 'bg-orange-500' },
      'Shopping': { icon: ShoppingBag, color: 'bg-purple-500' },
      'Transportation': { icon: Car, color: 'bg-blue-500' },
      'Entertainment': { icon: Gamepad2, color: 'bg-pink-500' },
      'Bills & Utilities': { icon: Home, color: 'bg-green-500' },
      'Gas': { icon: Car, color: 'bg-yellow-500' },
      'Groceries': { icon: ShoppingBag, color: 'bg-emerald-500' },
      'Online': { icon: CreditCard, color: 'bg-indigo-500' }
    };
    return iconMap[category] || { icon: MoreHorizontal, color: 'bg-gray-500' };
  };

  // Status configuration
  const getStatusConfig = (status: string) => {
    const statusMap: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string }> = {
      'completed': { icon: CheckCircle, color: 'text-green-400' },
      'pending': { icon: Clock, color: 'text-yellow-400' },
      'failed': { icon: AlertCircle, color: 'text-red-400' }
    };
    return statusMap[status] || { icon: CheckCircle, color: 'text-green-400' };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  // Format date for display
  const formatTransactionDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM dd, yyyy');
  };

  // Format date for list view
  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'MMM dd');
  };

  // Group transactions by date for timeline view
  const groupedTransactions = filteredTransactions.reduce((groups: Record<string, Transaction[]>, transaction: Transaction) => {
    const dateKey = formatTransactionDate(transaction.transaction_date);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className={`glass-card p-6 ${className}`}>
      {/* Header with enhanced controls */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white">
              Transactions ({filteredTransactions.length})
            </h2>
            
            {/* Bulk Actions */}
            {selectedTransactions.length > 0 && (
              <BulkTransactionActions
                selectedTransactions={selectedTransactions}
                totalTransactions={filteredTransactions.length}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onBulkAction={handleBulkAction}
              />
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Manual Transaction Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowManualForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </motion.button>
            
            {/* View Mode Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'timeline' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                <span>Timeline</span>
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <TransactionFilters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          cards={cards}
          onExport={handleExport}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Manual Transaction Form Modal */}
      <AnimatePresence>
        {showManualForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowManualForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ManualTransactionForm
                isOpen={true}
                onClose={() => setShowManualForm(false)}
                onSubmit={handleManualTransaction}
                categories={categories}
                cards={cards}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {filteredTransactions.map((transaction, index) => {
                const categoryConfig = getCategoryIcon(transaction.category);
                const CategoryIcon = categoryConfig.icon;
              const statusConfig = getStatusConfig(transaction.status);
              const StatusIcon = statusConfig.icon;
              const isCredit = transaction.amount < 0; // Negative amounts are credits/income

              return (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gray-700/50 rounded-lg group-hover:bg-gray-700/70 transition-colors duration-200">
                        <CategoryIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-gray-100 transition-colors duration-200">
                          {transaction.description}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-400">
                            {transaction.merchant} • {formatDate(transaction.transaction_date)}
                          </p>
                          <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        isCredit ? 'text-green-400' : 'text-white'
                      }`}>
                        {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        {transaction.category}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {Object.entries(groupedTransactions).map(([date, dayTransactions], dateIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIndex * 0.1 }}
              >
                {/* Date Header */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
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
                    const categoryConfig = getCategoryIcon(transaction.category);
                const CategoryIcon = categoryConfig.icon;
                    const statusConfig = getStatusConfig(transaction.status);
                    const StatusIcon = statusConfig.icon;
                    const isCredit = transaction.amount < 0;

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
                                  isCredit ? 'text-green-400' : 'text-white'
                                }`}>
                                  {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-gray-400 text-sm truncate">
                                {transaction.merchant} • {transaction.category}
                              </p>
                              <div className="flex items-center space-x-1">
                                <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredTransactions.map((transaction: Transaction, index: number) => {
            const isSelected = selectedTransactions.includes(transaction.id);
            
            return (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Selection Checkbox */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSelectTransaction(transaction.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </motion.button>

                    {/* Transaction Icon */}
                    <div className={`p-2 rounded-lg ${getCategoryIcon(transaction.category).color}`}>
                      {React.createElement(getCategoryIcon(transaction.category).icon, {
                        className: `w-5 h-5 text-white`
                      })}
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                          {transaction.description}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusConfig(transaction.status).color}`}>
                          {transaction.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{transaction.merchant}</span>
                        <span>•</span>
                        <span>{transaction.category}</span>
                        <span>•</span>
                        <span>{formatDate(transaction.transaction_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount and Actions */}
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`font-semibold ${transaction.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                        {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Card ending in ****
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No transactions found</div>
            <div className="text-sm text-gray-500">
              Try adjusting your filters or search terms
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <EmptyState
          icon={Search}
          title="No Transactions Found"
          description="Try adjusting your search or filter criteria to find transactions."
        />
      )}

      {/* Load More Button */}
      {!limit && filteredTransactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center pt-6"
        >
          <button className="px-6 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-white rounded-lg transition-colors font-medium">
            Load More Transactions
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default MergedTransactionsComponent;