'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import CreditCardComponent from '@/components/shared/data-display/CreditCard';
import TransactionList from './TransactionList';
import SpendingChart from './SpendingChart';
import QuickActions from './QuickActions';
import StatCard from './StatCard';
import { sampleData } from '@/data/mockData';

/**
 * Main dashboard page component that displays user's financial overview
 * 
 * Features:
 * - Financial statistics cards (balance, spending, credit, next payment)
 * - Credit card display with selection functionality
 * - Recent transactions list
 * - Spending chart visualization
 * - Quick action buttons
 * 
 * @component
 * @returns {JSX.Element} The rendered dashboard page
 * @example
 * ```tsx
 * <DashboardPage />
 * ```
 */
export function DashboardPage() {
  const [selectedCard, setSelectedCard] = useState(sampleData.creditCards[0]);

  // Transform current transactions to match TransactionList interface
  const transformedTransactions = sampleData.currentTransactions.map(tx => ({
    id: tx.id,
    merchant: tx.merchant,
    amount: tx.amount,
    date: tx.transaction_date,
    category: tx.category,
    type: 'debit' as const, // Assuming all are debit transactions for now
    status: tx.status as 'completed' | 'pending' | 'failed'
  }));

  const stats = [
    {
      title: 'Total Balance',
      value: '$12,450.00',
      change: '+2.5%',
      icon: DollarSign,
      trend: 'up' as const,
    },
    {
      title: 'Monthly Spending',
      value: '$3,240.00',
      change: '+12.3%',
      icon: TrendingUp,
      trend: 'up' as const,
    },
    {
      title: 'Available Credit',
      value: '$8,760.00',
      change: '-5.2%',
      icon: CreditCard,
      trend: 'down' as const,
    },
    {
      title: 'Next Payment',
      value: 'Dec 15',
      change: '5 days',
      icon: Calendar,
      trend: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome back! Here&apos;s your financial overview.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {stats.map((stat, index) => (
          <StatCard key={stat.title} {...stat} index={index} />
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Credit Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Your Cards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sampleData.creditCards.map((card, index) => (
                <CreditCardComponent
                  key={card.id}
                  card={card}
                  onClick={() => setSelectedCard(card)}
                />
              ))}
            </div>
          </motion.div>

          {/* Spending Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <SpendingChart />
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <QuickActions />
          </motion.div>

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <TransactionList
              transactions={transformedTransactions.slice(0, 5)}
              title="Recent Transactions"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}