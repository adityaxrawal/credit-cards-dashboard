"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, EyeOff, Eye, TrendingUp, CreditCard as CreditCardIcon, Clock, Gift, FileText } from "lucide-react";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import CreditCard from "@/components/shared/data-display/CreditCard";
import CardDetailsComponent from "@/components/features/cards/CardDetailsComponent";
import TabNavigationComponent from "@/components/features/cards/TabNavigationComponent";
import SpendingOverviewComponent from "@/components/features/cards/SpendingOverviewComponent";
import RecentActivityComponent from "@/components/features/cards/RecentActivityComponent";
import TransactionsComponent from "@/components/features/cards/TransactionsComponent";
import TimelineComponent from "@/components/features/cards/TimelineComponent";
import StatementsComponent from "@/components/features/cards/StatementsComponent";
import PerksComponent from "@/components/features/cards/PerksComponent";
import { 
  getSampleCreditCards, 
  getSampleTransactions,
  getSampleCardPerks,
  getSampleStatements,
  type CreditCard as CreditCardType,
  type Transaction,
  type CardPerk,
  type Statement
} from "@/lib/sampleData";
import '../../globals.css';

interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
}

interface CardSpendingData {
  categories: SpendingCategory[];
  totalSpent: number;
  monthlyLimit: number;
}

const CardDetailPage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCardNumber, setShowCardNumber] = useState(false);
  const router = useRouter();
  const params = useParams();
  const cardId = params.id as string;

  // Get card data
  const cards = getSampleCreditCards();
  const card = cards.find(c => c.id === cardId);
  const transactions = getSampleTransactions(cardId);
  const perks = getSampleCardPerks(cardId);
  const statements = getSampleStatements(cardId);

  // Generate sample spending data for the card
  const generateSpendingData = (cardTransactions: Transaction[]): CardSpendingData => {
    const categoryTotals: Record<string, number> = {};
    let totalSpent = 0;

    cardTransactions.forEach(transaction => {
      if (transaction.amount < 0) { // Only count debits
        const amount = Math.abs(transaction.amount);
        categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + amount;
        totalSpent += amount;
      }
    });

    const categories: SpendingCategory[] = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      categories,
      totalSpent,
      monthlyLimit: card?.credit_limit ? card.credit_limit * 0.3 : 50000
    };
  };

  const spendingData = generateSpendingData(transactions);

  if (!card) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Card Not Found</h1>
          <button
            onClick={() => router.push('/cards')}
            className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
          >
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  const handleBackClick = () => {
    router.push('/cards');
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-primary-bg"
        >
          {/* Topbar */}
          <Topbar />

          {/* Back Button */}
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Cards</span>
          </button>

          {/* Card Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div>
              <CreditCard
                card={card}
                variant="default"
                showRewards={true}
                showCreditLimit={true}
              />
            </div>

            {/* Card Details Component */}
            <CardDetailsComponent 
              card={card}
              formatCurrency={formatCurrency}
            />
          </div>

          {/* Tab Navigation Component */}
          <TabNavigationComponent 
            tabs={[
              { id: "overview", label: "Overview", icon: TrendingUp },
              { id: "transactions", label: "Transactions", icon: CreditCardIcon },
              { id: "timeline", label: "Timeline", icon: Clock },
              { id: "perks", label: "Perks & Benefits", icon: Gift },
              { id: "statements", label: "Statements", icon: FileText },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Tab Content */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <RecentActivityComponent 
                  transactions={transactions}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              </div>
            )}

            {activeTab === "transactions" && (
              <TransactionsComponent 
                cardId={cardId}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}

            {activeTab === "timeline" && (
              <TimelineComponent 
                transactions={transactions}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}

            {activeTab === "statements" && (
              <StatementsComponent 
                statements={statements}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}

            {activeTab === "perks" && (
              <PerksComponent />
            )}
        </motion.div>
      </div>
    </div>
  );
};

export default CardDetailPage;