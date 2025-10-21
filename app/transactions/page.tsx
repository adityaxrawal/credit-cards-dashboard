"use client";

import React from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import MergedTransactionsComponent from '@/components/features/transactions/MergedTransactionsComponent';
import { getSampleTransactions, getRecentTransactions } from "@/lib/sampleData";
import "../globals.css";

const TransactionsPage: React.FC = () => {
  const allTransactions = getSampleTransactions();
  
  // Transform transactions for Transactions component
  const transformedTransactions = allTransactions.slice(0, 20).map(t => ({
    id: t.id,
    description: t.description,
    category: t.category,
    date: t.transaction_date,
    amount: t.amount,
    type: t.amount > 0 ? 'credit' as const : 'debit' as const
  }));

  return (
    <div className="min-h-screen bg-primary-bg flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-primary-bg"
        >
          {/* Topbar */}
          <Topbar />

          {/* Transactions Grid */}
          <div className="grid grid-cols-1 gap-6">
            <MergedTransactionsComponent />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TransactionsPage;