"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/shared/navigation/Sidebar';
import Topbar from '@/components/shared/navigation/Topbar';
import SpendingLimits from '@/components/features/dashboard/SpendingLimits';
import SummaryStats from '@/components/features/dashboard/SummaryStats';
import CardList from '@/components/features/dashboard/CardList';
import { TrendingUp, Calendar, Activity, Target } from 'lucide-react';
import { 
  getSampleCreditCards, 
  getSampleDashboardSummary,
} from "@/lib/sampleData";
import '../globals.css'

const DashboardPage: React.FC = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Get sample data
  const cards = getSampleCreditCards();
  const dashboardSummary = getSampleDashboardSummary();

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
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto bg-primary-bg"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Enhanced Topbar */}
          <motion.div variants={itemVariants}>
            <Topbar />
          </motion.div>

          {/* Dashboard Header with Quick Stats */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-8 bg-gradient-to-b from-accent-mint to-accent-purple rounded-full"></div>
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
              
              {/* Quick Action Cards */}
              <div className="flex flex-wrap gap-3">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all duration-300 cursor-pointer"
                >
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="text-white text-sm font-medium">+12.5% this month</span>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all duration-300 cursor-pointer"
                >
                  <Calendar size={16} className="text-blue-400" />
                  <span className="text-white text-sm font-medium">Dec 2024</span>
                </motion.div>
              </div>
            </div>

            {/* Quick Insights Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div 
                whileHover={{ y: -2 }}
                className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">Active Cards</p>
                    <p className="text-white text-2xl font-bold">4</p>
                  </div>
                  <Activity className="text-green-400" size={24} />
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border border-blue-500/20 rounded-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm font-medium">This Month</p>
                    <p className="text-white text-2xl font-bold">₹45,230</p>
                  </div>
                  <Calendar className="text-blue-400" size={24} />
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-600/10 border border-purple-500/20 rounded-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-sm font-medium">Savings Goal</p>
                    <p className="text-white text-2xl font-bold">78%</p>
                  </div>
                  <Target className="text-purple-400" size={24} />
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                className="p-4 bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20 rounded-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 text-sm font-medium">Cashback</p>
                    <p className="text-white text-2xl font-bold">₹2,340</p>
                  </div>
                  <TrendingUp className="text-orange-400" size={24} />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left Column - Summary Stats & Spending Limits */}
            <div className="xl:col-span-8 space-y-8">
              {/* Summary Statistics */}
              <motion.div variants={itemVariants}>
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">Financial Overview</h3>
                  <p className="text-white/60">Your spending and earnings summary</p>
                </div>
                <SummaryStats
                  totalEarnings={dashboardSummary.totalRewardPoints}
                  totalSpendings={
                    dashboardSummary.totalCreditLimit -
                    dashboardSummary.totalAvailableCredit
                  }
                  spendingGoal={dashboardSummary.totalCreditLimit * 0.3}
                />
              </motion.div>

              {/* Spending Limits */}
              <motion.div variants={itemVariants}>
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">Spending Controls</h3>
                  <p className="text-white/60">Monitor and manage your spending limits</p>
                </div>
                <SpendingLimits dailyUsed={50000} dailyTransactionLimit={250000} />
              </motion.div>
            </div>

            {/* Right Column - Card Management */}
            <div className="xl:col-span-4">
              <motion.div variants={itemVariants} className="sticky top-8">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">Your Cards</h3>
                  <p className="text-white/60">Manage your credit cards</p>
                </div>
                <CardList
                  cards={cards}
                  onCardClick={(cardId: string) => {
                    setSelectedCardId(cardId);
                    router.push(`/card-detail/${cardId}`);
                  }}
                />
              </motion.div>
            </div>
          </div>

          {/* Bottom Section - Additional Insights */}
          <motion.div variants={itemVariants} className="mt-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Activity Preview */}
              <div className="p-6 glass-card rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Recent Activity</h4>
                  <button className="text-accent-mint hover:text-accent-mint/80 text-sm font-medium transition-colors">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent-mint to-accent-purple rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">₹</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">Transaction {item}</p>
                          <p className="text-white/60 text-xs">2 hours ago</p>
                        </div>
                      </div>
                      <span className="text-white font-medium">₹{(item * 1250).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-6 glass-card rounded-2xl border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pay Bills', icon: '💳', color: 'from-blue-500 to-cyan-500' },
                    { label: 'Transfer', icon: '💸', color: 'from-green-500 to-emerald-500' },
                    { label: 'Invest', icon: '📈', color: 'from-purple-500 to-pink-500' },
                    { label: 'Rewards', icon: '🎁', color: 'from-orange-500 to-red-500' }
                  ].map((action, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-4 bg-gradient-to-br ${action.color} rounded-xl text-white font-medium text-sm transition-all duration-300 hover:shadow-lg`}
                    >
                      <div className="text-2xl mb-2">{action.icon}</div>
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;