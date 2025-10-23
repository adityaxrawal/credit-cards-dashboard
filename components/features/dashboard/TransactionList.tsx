'use client';

import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/shared/ui';
import { formatCurrency } from '@/lib/utils';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  type: 'debit' | 'credit';
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionListProps {
  transactions: Transaction[];
  title?: string;
  showAll?: boolean;
}

const TransactionList = React.memo<TransactionListProps>(({
  transactions,
  title = 'Transactions',
  showAll = false,
}) => {
  const getTransactionIcon = useCallback((type: string) => {
    return type === 'credit' ? ArrowDownLeft : ArrowUpRight;
  }, []);

  const getTransactionColor = useCallback((type: string) => {
    return type === 'credit' 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }, []);

  const memoizedTransactions = useMemo(() => transactions, [transactions]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {!showAll && (
          <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
            View All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {memoizedTransactions.map((transaction, index) => {
          const Icon = getTransactionIcon(transaction.type);
          
          return (
            <motion.div
              key={transaction.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="flex items-center space-x-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  transaction.type === 'credit' 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-red-100 dark:bg-red-900/20'
                }`}>
                  <Icon className={`h-4 w-4 ${getTransactionColor(transaction.type)}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {transaction.merchant}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {transaction.date}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                  {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                </span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
        </div>
      )}
    </div>
  );
});

TransactionList.displayName = 'TransactionList';

export default TransactionList;