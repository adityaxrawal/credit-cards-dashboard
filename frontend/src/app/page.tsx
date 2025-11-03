"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout";
import {
  InventoryDetailsCard,
  KPICards,
  CardsPreview,
  TransactionsPreview,
} from "@/components/dashboard";
import type { CreditCard, Transaction, KPIData } from "@/types";

// Mock data for development
const mockKPIData: KPIData = {
  totalBalance: 35200,
  cardCount: 3,
  totalEarnings: 20894.3,
  totalSpendings: 7346.5,
  spendingGoal: 8548.2,
};

const mockCards: CreditCard[] = [
  {
    id: "1",
    card_name: "Shipping Card",
    bank_name: "Chase Bank",
    card_number_last4: "3040",
    bill_date: 15,
    due_date: 5,
    credit_limit: 10000,
    current_balance: 2500,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "2",
    card_name: "Transfer Card",
    bank_name: "Wells Fargo",
    card_number_last4: "4080",
    bill_date: 20,
    due_date: 10,
    credit_limit: 15000,
    current_balance: 3200,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

const mockTransactions: Transaction[] = [
  {
    id: "1",
    amount: -125.5,
    transaction_date: "2024-01-15",
    merchant: "Amazon",
    category: "Shopping",
    card_id: "1",
    description: "Online purchase",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: "2024-01-15",
    updated_at: "2024-01-15",
    card: mockCards[0],
  },
  {
    id: "2",
    amount: -45.0,
    transaction_date: "2024-01-14",
    merchant: "Starbucks",
    category: "Food & Dining",
    card_id: "2",
    description: "Coffee",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: "2024-01-14",
    updated_at: "2024-01-14",
    card: mockCards[1],
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = React.useState<
    CreditCard | undefined
  >(mockCards[0]);
  const [activeTab, setActiveTab] = React.useState<
    "all" | "revenues" | "expense"
  >("all");

  const handleCardClick = (card: CreditCard) => {
    setSelectedCard(card);
    router.push(`/cards/${card.id}`);
  };

  const handleAddCard = () => {
    router.push("/cards?add=true");
  };

  const handleTransactionClick = (transaction: Transaction) => {
    console.log("Transaction clicked:", transaction);
  };

  const handleDetailsClick = () => {
    router.push("/cards");
  };

  const spendingLimit = {
    id: "1",
    monthly_limit: 2000,
    alert_threshold: 80,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    currentSpending: 400,
  };

  return (
    <AppLayout
      title="Welcome Dashboard"
      selectedCard={selectedCard}
      spendingLimit={spendingLimit}
    >
      <div className="space-y-8">
        {/* Inventory Details Card */}
        <InventoryDetailsCard
          totalBalance={mockKPIData.totalBalance}
          cardCount={mockKPIData.cardCount}
          onDetailsClick={handleDetailsClick}
        />

        {/* KPI Cards */}
        <KPICards data={mockKPIData} />

        {/* Cards Preview */}
        <CardsPreview
          cards={mockCards}
          onCardClick={handleCardClick}
          onAddCard={handleAddCard}
        />

        {/* Transactions Preview */}
        <TransactionsPreview
          transactions={mockTransactions}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTransactionClick={handleTransactionClick}
        />
      </div>
    </AppLayout>
  );
}
