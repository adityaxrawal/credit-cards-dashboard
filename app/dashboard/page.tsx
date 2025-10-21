"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import SpendingLimits from "@/components/features/dashboard/SpendingLimits";
import CardList from "@/components/features/dashboard/CardList";
import SummaryStats from "@/components/features/dashboard/SummaryStats";
import { 
  getSampleCreditCards, 
  getSampleDashboardSummary,
} from "@/lib/sampleData";
import '../globals.css'

const DashboardPage: React.FC = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get sample data
  const cards = getSampleCreditCards();
  const dashboardSummary = getSampleDashboardSummary();

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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-primary-bg"
        >
          {/* Topbar */}
          <Topbar />

          {/* Spending Limits */}
          <SpendingLimits dailyUsed={50000} dailyTransactionLimit={250000} />

          {/* Summary Stats */}
          <SummaryStats
            totalEarnings={dashboardSummary.totalRewardPoints}
            totalSpendings={
              dashboardSummary.totalCreditLimit -
              dashboardSummary.totalAvailableCredit
            }
            spendingGoal={dashboardSummary.totalCreditLimit * 0.3}
          />

          {/* Cards Section */}
          <CardList
            cards={cards}
            onCardClick={(cardId: string) => setSelectedCardId(cardId)}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;