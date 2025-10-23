"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/shared/navigation/Sidebar';
import Topbar from '@/components/shared/navigation/Topbar';
import SpendingLimits from '@/components/features/dashboard/SpendingLimits';
import SummaryStats from '@/components/features/dashboard/SummaryStats';
import CardList from '@/components/features/dashboard/CardList';
import LoadingSkeleton from '@/components/shared/feedback/LoadingSkeleton';
import EmptyState from '@/components/shared/feedback/EmptyState';
import { TrendingUp, Calendar, Activity, Target, BarChart3, PieChart, TrendingDown, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { 
  getSampleCreditCards, 
  getSampleDashboardSummary,
} from "@/lib/sampleData";
import SpendingTrends from '@/components/analytics/SpendingTrends';
import CategoryBreakdown from '@/components/analytics/CategoryBreakdown';
import BudgetComparison from '@/components/analytics/BudgetComparison';
import SpendingHeatmap from '@/components/analytics/SpendingHeatmap';
import '../globals.css'

interface Card {
  id: string;
  bank_name: string;
  card_last_4: string;
  card_holder_name: string;
  card_type: string;
}

interface DashboardSummary {
  totalRewardPoints: number;
  totalCreditLimit: number;
  totalAvailableCredit: number;
  upcomingDueDates: Array<{
    card_id: string;
    due_amount: number;
    due_date: string;
  }>;
}

const DashboardPage: React.FC = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const router = useRouter();

  // Simulate data loading
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Load sample data
      const cardsData = getSampleCreditCards();
      const summaryData = getSampleDashboardSummary();
      
      setCards(cardsData);
      setDashboardSummary(summaryData);
      setIsLoading(false);
    };

    loadData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Content Area */}
        <motion.div
          className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 overflow-y-auto bg-primary-bg"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Enhanced Topbar - Make sticky on mobile */}
          <motion.div variants={itemVariants} className="sticky top-0 z-30 bg-primary-bg/95 backdrop-blur-sm -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-0 md:relative md:bg-transparent md:backdrop-blur-none">
            <Topbar />
          </motion.div>

          {/* Dashboard Header with Quick Stats */}
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-6 md:h-8 bg-gradient-to-b from-accent-mint to-accent-purple rounded-full"></div>
                  <div>
                    <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                      Good morning, Aditya
                    </h2>
                    <p className="text-white/60 text-lg">
                      Here&apos;s your financial overview for today
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="glass-button px-6 py-3 rounded-xl text-white font-medium flex items-center space-x-2 hover:bg-white/20 transition-all duration-300"
                  onClick={() => router.push('/transactions')}
                >
                  <Activity className="w-5 h-5" />
                  <span>View All</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-accent-mint to-accent-purple px-6 py-3 rounded-xl text-black font-medium flex items-center space-x-2 hover:shadow-lg hover:shadow-accent-mint/25 transition-all duration-300"
                  onClick={() => router.push('/settings')}
                >
                  <Target className="w-5 h-5" />
                  <span>Set Limits</span>
                </motion.button>
              </div>
            </div>

            {/* Summary Stats */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(4)].map((_, i) => (
                  <LoadingSkeleton key={i} type="card" className="h-24 md:h-32" />
                ))}
              </div>
            ) : (
              <SummaryStats
                totalEarnings={dashboardSummary?.totalRewardPoints || 0}
                totalSpendings={
                  (dashboardSummary?.totalCreditLimit || 0) -
                  (dashboardSummary?.totalAvailableCredit || 0)
                }
                spendingGoal={(dashboardSummary?.totalCreditLimit || 0) * 0.3}
              />
            )}
          </motion.div>

          {/* Credit Cards Section */}
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Your Cards</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-accent-mint hover:text-accent-mint/80 font-medium transition-colors duration-200"
                onClick={() => router.push('/cards')}
              >
                View All Cards
              </motion.button>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <LoadingSkeleton key={i} type="credit-card" className="h-48" />
                ))}
              </div>
            ) : (
              <CardList 
                cards={cards}
                onCardClick={(cardId: string) => {
                  setSelectedCardId(cardId);
                  router.push(`/card-detail/${cardId}`);
                }}
              />
            )}
          </motion.div>

          {/* Spending Limits */}
          <motion.div variants={itemVariants}>
            {isLoading ? (
              <LoadingSkeleton type="card" className="h-64" />
            ) : (
              <SpendingLimits 
                dailyUsed={50000}
                dailyTransactionLimit={250000}
              />
            )}
          </motion.div>

          {/* Analytics Grid */}
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <h3 className="text-xl md:text-2xl font-bold text-white">Analytics & Insights</h3>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-accent-mint" />
                <span className="text-white/60 text-xs md:text-sm">Last 30 days</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
              {/* Spending Trends */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                {isLoading ? (
                  <LoadingSkeleton type="chart" className="h-80" />
                ) : (
                  <SpendingTrends />
                )}
              </motion.div>

              {/* Category Breakdown */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {isLoading ? (
                  <LoadingSkeleton type="chart" className="h-80" />
                ) : (
                  <CategoryBreakdown />
                )}
              </motion.div>

              {/* Budget Comparison */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                {isLoading ? (
                  <LoadingSkeleton type="chart" className="h-80" />
                ) : (
                  <BudgetComparison />
                )}
              </motion.div>

              {/* Spending Heatmap */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                {isLoading ? (
                  <LoadingSkeleton type="chart" className="h-80" />
                ) : (
                  <SpendingHeatmap />
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Recent Activity Section */}
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <h3 className="text-xl md:text-2xl font-bold text-white">Recent Activity</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-accent-mint hover:text-accent-mint/80 font-medium transition-colors duration-200 text-sm md:text-base self-start sm:self-auto"
                onClick={() => router.push('/transactions')}
              >
                View All Transactions
              </motion.button>
            </div>
            
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <LoadingSkeleton key={i} type="list" className="h-16" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No Recent Activity"
                description="Your recent transactions and activities will appear here once you start using your cards."
                size="sm"
                className="py-8"
              />
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;