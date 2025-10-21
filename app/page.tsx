"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import InventoryDetails from "@/components/dashboard/InventoryDetails";
import CardList from "@/components/dashboard/CardList";
import SummaryStats from "@/components/dashboard/SummaryStats";
import Transactions from "@/components/dashboard/Transactions";
import DetailsCard from "@/components/dashboard/DetailsCard";
import SpendingSummary from "@/components/dashboard/SpendingSummary";
import SpendingChart from "@/components/dashboard/SpendingChart";
import TransactionTimeline from "@/components/dashboard/TransactionTimeline";
import CardPerks from "@/components/dashboard/CardPerks";
import EmptyState from "@/components/ui/EmptyState";
import { 
  getSampleCreditCards, 
  getSampleTransactions, 
  getSampleDashboardSummary,
  calculateTotalCreditUtilization,
  getRecentTransactions,
  type CreditCard,
  type Transaction as SampleTransaction
} from "@/lib/sampleData";
import './globals.css'

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedCardId, setSelectedCardId] = useState<string>("card_001");

  // Get sample data
  const creditCards = getSampleCreditCards();
  const dashboardSummary = getSampleDashboardSummary();
  const recentTransactions = getRecentTransactions(5);
  const selectedCard = creditCards.find(card => card.id === selectedCardId) || creditCards[0];

  // Transform sample data for existing components
  interface Card {
    id: string;
    bank_name: string;
    card_last_4: string;
    card_holder_name: string;
    card_type: string;
  }

  interface Transaction {
    id: string;
    description: string;
    category: string;
    date: string;
    amount: number;
    type: 'credit' | 'debit';
  }

  interface CardDetails {
    id: string;
    bank_name: string;
    card_number: string;
    card_holder_name: string;
    expiry_date: string;
    cvv: string;
    level: string;
  }

  // Transform credit cards for CardList component
  const cards: Card[] = creditCards.map(card => ({
    id: card.id,
    bank_name: card.bank_name,
    card_last_4: card.card_last_4,
    card_holder_name: card.card_holder_name,
    card_type: card.card_type,
  }));

  // Transform transactions for Transactions component
  const transactions: Transaction[] = recentTransactions.map(txn => ({
    id: txn.id,
    description: txn.description,
    category: txn.category,
    date: new Date(txn.transaction_date).toISOString().split('T')[0],
    amount: txn.amount,
    type: 'debit' as const, // All sample transactions are expenses
  }));

  // Transform selected card for DetailsCard component
  const selectedCardDetails: CardDetails = {
    id: selectedCard.id,
    bank_name: selectedCard.bank_name,
    card_number: `${selectedCard.card_last_4.slice(0, 4)} **** **** ${selectedCard.card_last_4}`,
    card_holder_name: selectedCard.card_holder_name,
    expiry_date: "03/28", // Mock expiry date
    cvv: "***", // Hidden CVV
    level: "Premium", // Mock level
  };

  // Calculate current spending for selected card
  const currentSpending = selectedCard.credit_limit - selectedCard.available_credit;

  return (
      <div className="min-h-screen bg-gradient-to-br from-cred-dark to-cred-secondary flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Container */}
        <div className="flex-1 flex flex-col xl:flex-row min-h-0">
          {/* Left Column - Main Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto"
          >
            {/* Topbar */}
            <Topbar />

            {/* Inventory Details */}
            <InventoryDetails 
              balance={dashboardSummary.totalAvailableCredit}
              cardCount={cards.length}
              onDetailsClick={() => console.log("Details clicked")}
            />

            {/* Cards Section */}
            <CardList 
              cards={cards}
              onAddCard={() => console.log("Add card clicked")}
              onCardClick={(cardId: string) => {
                setSelectedCardId(cardId);
                console.log("Card clicked:", cardId);
              }}
            />

            {/* Summary Stats */}
            <SummaryStats 
              totalEarnings={dashboardSummary.totalRewardPoints}
              totalSpendings={dashboardSummary.totalCreditLimit - dashboardSummary.totalAvailableCredit}
              spendingGoal={dashboardSummary.totalCreditLimit * 0.3} // 30% of total limit as goal
            />

            {/* Spending Summary */}
            <SpendingSummary />

            {/* Spending Chart */}
            <SpendingChart />

            {/* Transaction Timeline */}
            <TransactionTimeline limit={10} />

            {/* Card Perks */}
            <CardPerks cardId={selectedCardId} />

            {/* Legacy Transactions (keeping for compatibility) */}
            <Transactions transactions={transactions} />
          </motion.div>

          {/* Right Column - Details Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full xl:w-80 2xl:w-96 p-4 sm:p-6 lg:p-8 xl:border-l xl:border-white/5"
          >
            <DetailsCard 
              card={selectedCardDetails}
              currentSpending={currentSpending}
              spendingLimit={selectedCard.credit_limit}
            />
          </motion.div>
        </div>
      </div>
  );
};

export default HomePage;
