"use client";

import React from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import SpendingChart from "@/components/features/dashboard/SpendingChart";
import SpendingSummary from "@/components/features/dashboard/SpendingSummary";
import "../globals.css";

const StatementsPage: React.FC = () => {
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

          {/* Statements Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Spending Summary */}
            <div className="lg:col-span-1">
              <SpendingSummary />
            </div>

            {/* Spending Chart */}
            <div className="lg:col-span-1">
              <SpendingChart />
            </div>
          </div>

          {/* Statement History */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Statement History</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((month) => (
                <div key={month} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Statement - {new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    <p className="text-white/60 text-sm">Generated on {new Date(2024, month, 1).toLocaleDateString()}</p>
                  </div>
                  <button className="px-4 py-2 bg-gradient-to-r from-cred-purple to-cred-pink rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StatementsPage;