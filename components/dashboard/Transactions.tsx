"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MoreHorizontal, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
}

interface TransactionsProps {
  transactions: Transaction[];
}

const Transactions: React.FC<TransactionsProps> = ({ transactions }) => {
  const [activeFilter, setActiveFilter] = useState('All');
  
  const filters = ['All', 'Revenues', 'Expense'];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Shopping': '🛍️',
      'Salary': '💰',
      'Entertainment': '🎬',
      'Transport': '🚗',
      'Food': '🍔',
      'Bills': '📄',
      'Healthcare': '🏥',
      'Education': '📚',
    };
    return icons[category] || '💳';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card rounded-2xl p-4 lg:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <h2 className="text-base lg:text-lg font-semibold text-white">Transactions</h2>
        
        <div className="flex items-center space-x-1 lg:space-x-2">
          <button className="flex items-center space-x-1 lg:space-x-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-white/5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <Calendar size={14} className="lg:w-4 lg:h-4" />
            <span className="text-xs lg:text-sm hidden sm:inline">Calendar</span>
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <MoreHorizontal size={18} className="lg:w-5 lg:h-5" />
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <Filter size={18} className="lg:w-5 lg:h-5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-1 mb-4 lg:mb-6 bg-white/5 rounded-xl p-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`
              flex-1 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200
              ${activeFilter === filter
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
            `}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-2 lg:space-y-3">
        {transactions.map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center justify-between p-3 lg:p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-200 group"
          >
            {/* Left Section */}
            <div className="flex items-center space-x-3 lg:space-x-4 flex-1 min-w-0">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white/10 flex items-center justify-center text-lg lg:text-xl shrink-0">
                {getCategoryIcon(transaction.category)}
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-white group-hover:text-white/90 text-sm lg:text-base truncate">
                  {transaction.description}
                </h4>
                <p className="text-xs lg:text-sm text-white/60 truncate">
                  {transaction.category} • {formatDate(transaction.date)}
                </p>
              </div>
            </div>

            {/* Right Section */}
            <div className="text-right shrink-0">
              <p className={`font-semibold text-sm lg:text-base ${
                transaction.type === 'credit' 
                  ? 'text-cred-green' 
                  : 'text-white'
              }`}>
                {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
              </p>
              <p className="text-xs text-white/40">
                {transaction.type === 'credit' ? 'Income' : 'Expense'}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View All Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-3 lg:mt-4 py-2.5 lg:py-3 bg-white/5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 text-xs lg:text-sm font-medium"
      >
        View All Transactions
      </motion.button>
    </motion.div>
  );
};

export default Transactions;