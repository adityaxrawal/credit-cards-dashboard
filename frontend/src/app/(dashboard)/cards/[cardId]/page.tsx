"use client";

import React, { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Trash2, Plus, Filter, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, ProgressBar, Modal, Input, Badge, CardVisual } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  SpendingTrendChart,
  CategoryBreakdownChart,
  WeeklySpendingChart,
} from "@/components/analytics";
import { formatCurrency, cn, getCardGradient, calculateUtilization } from "@/lib/utils";
import { cardApi, type Card, type CardFormData } from "@/lib/api/cards";
import { transactionApi, type Transaction, type TransactionFormData } from "@/lib/api/transactions";

const tabs = [
  { key: "transactions", label: "Transactions" },
  { key: "insights", label: "Insights" },
];

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();
  const cardId = params.cardId as string;

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "transactions"
  );
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);

  // Fetch Card Details
  const { data: card, isLoading: isCardLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => cardApi.getCard(cardId),
  });

  // Fetch Transactions
  const { data: transactionData, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ["transactions", cardId],
    queryFn: () => transactionApi.getTransactions({ cardId }),
  });

  // Fetch Statistics
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["card-stats", cardId],
    queryFn: () => cardApi.getCardStatistics(cardId),
  });

  // Delete Card Mutation
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => cardApi.deleteCard(id),
    onSuccess: () => {
      success("Card deleted successfully");
      router.push("/cards");
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to delete card");
    },
  });

  // Update Card Mutation
  const updateCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CardFormData> }) =>
      cardApi.updateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      success("Card updated successfully");
      setShowEditCard(false);
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to update card");
    },
  });

  // Add Transaction Mutation
  const addTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData) => transactionApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card", cardId] }); // Balance might change
      queryClient.invalidateQueries({ queryKey: ["card-stats", cardId] });
      success("Transaction added successfully");
      setShowAddTransaction(false);
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to add transaction");
    },
  });

  if (isCardLoading) {
    return (
      <AppLayout title="Card Details" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading card details...</div>
        </div>
      </AppLayout>
    );
  }

  if (!card) {
    return (
      <AppLayout title="Card Not Found" showRightSidebar={false}>
        <div className="text-center py-12">
          <p className="text-secondary-text mb-4">Card not found</p>
          <Button onClick={() => router.push("/cards")}>Back to Cards</Button>
        </div>
      </AppLayout>
    );
  }

  const creditLimit = card.credit_limit || 0;
  const availableCredit = creditLimit - card.current_outstanding;
  const utilization = calculateUtilization(card.current_outstanding, creditLimit);
  const gradient = getCardGradient(card.card_name || card.bank_name || "default");

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${card.card_name}?`)) {
      deleteCardMutation.mutate(card.id);
    }
  };

  return (
    <AppLayout title={card.card_name} showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary-text">
                {card.card_name}
              </h1>
              <p className="text-secondary-text">{card.bank_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditCard(true)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="error" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Card Visual and Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Visual */}
            <div className="flex justify-center lg:justify-start">
               <CardVisual
                  cardName={card.card_name}
                  cardNumber={card.last_four_digits}
                  gradient={gradient}
                  className="w-full max-w-md aspect-[1.586/1]"
                />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Current Balance</p>
                <p className="text-2xl font-bold text-primary-text">
                  {formatCurrency(card.current_outstanding)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Credit Limit</p>
                <p className="text-2xl font-bold text-primary-text">
                  {formatCurrency(creditLimit)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Available Credit</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(availableCredit)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Utilization</p>
                <ProgressBar
                  value={card.current_outstanding}
                  max={creditLimit}
                  showPercentage={true}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-muted-text/20">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.key
                    ? "border-primary-green text-primary-green"
                    : "border-transparent text-secondary-text hover:text-primary-text hover:border-muted-text"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === "transactions" && (
            <TransactionsTab
              transactions={transactionData?.transactions || []}
              isLoading={isTransactionsLoading}
              onAddTransaction={() => setShowAddTransaction(true)}
            />
          )}
          {activeTab === "insights" && (
            <InsightsTab
              stats={stats}
              isLoading={isStatsLoading}
            />
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        cardId={cardId}
        onSubmit={(data) => addTransactionMutation.mutate(data)}
        isSubmitting={addTransactionMutation.isPending}
      />

      {/* Edit Card Modal */}
      <EditCardModal
        isOpen={showEditCard}
        onClose={() => setShowEditCard(false)}
        card={card}
        onSubmit={(data) => updateCardMutation.mutate({ id: card.id, data })}
        isSubmitting={updateCardMutation.isPending}
      />
    </AppLayout>
  );
}

// Transactions Tab Component
interface TransactionsTabProps {
  transactions: Transaction[];
  isLoading: boolean;
  onAddTransaction: () => void;
}

function TransactionsTab({
  transactions,
  isLoading,
  onAddTransaction,
}: TransactionsTabProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading transactions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary-text">
          Transactions
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="secondary" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Filter by Date
          </Button>
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            More Filters
          </Button>
          <Button size="sm" onClick={onAddTransaction}>
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="bg-card-bg rounded-lg overflow-hidden">
        {transactions.length === 0 ? (
            <div className="text-center py-12 text-secondary-text">
                No transactions found. Add one to get started.
            </div>
        ) : (
        <table className="w-full">
          <thead className="bg-hover-bg">
            <tr>
              <th className="text-left p-4 font-medium text-secondary-text">Date</th>
              <th className="text-left p-4 font-medium text-secondary-text">Description</th>
              <th className="text-left p-4 font-medium text-secondary-text">Category</th>
              <th className="text-left p-4 font-medium text-secondary-text">Amount</th>
              <th className="text-left p-4 font-medium text-secondary-text">Cycle</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr
                key={item.id}
                className="border-t border-muted-text/20 hover:bg-hover-bg/50"
              >
                <td className="p-4 text-primary-text">
                  {new Date(item.transaction_date).toLocaleDateString()}
                </td>
                <td className="p-4 text-primary-text">
                    <div className="font-medium">{item.merchant_name}</div>
                    <div className="text-xs text-secondary-text">{item.description}</div>
                </td>
                <td className="p-4">
                  <Badge label={item.merchant_category || "Uncategorized"} variant="default" />
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "font-medium",
                      item.transaction_type === "credit" ? "text-success" : "text-primary-text"
                    )}
                  >
                    {item.transaction_type === "credit" ? "+" : ""}
                    {formatCurrency(item.amount)}
                  </span>
                </td>
                <td className="p-4 text-primary-text">
                  {item.billing_cycle}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

// Insights Tab Component
interface InsightsTabProps {
  stats?: any; // Replace with proper type
  isLoading: boolean;
}

function InsightsTab({
  stats,
  isLoading,
}: InsightsTabProps) {
    if (isLoading) {
        return <div className="text-center py-8">Loading insights...</div>;
    }

    if (!stats) {
        return <div className="text-center py-8">No data available for insights.</div>;
    }

    // Transform stats for charts
    // Assuming stats matches CardStatistics interface
    const categoryData = stats.category_breakdown?.map((c: any) => ({
        category: c.category,
        amount: c.total,
        percentage: (c.total / stats.total_spent) * 100
    })) || [];

    // Mock trend data if not available in stats (API might need update)
    const spendingTrend = [
        { month: "Current", spending: stats.current_month_spent || 0 }
    ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-text">Card Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts would go here - using placeholders if data structure doesn't match exactly */}
        <CategoryBreakdownChart data={categoryData} height={250} />
        
        {/* Key Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Key Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Total Spent</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency(stats.total_spent || 0)}
              </span>
            </div>
             <div className="flex justify-between items-center">
              <span className="text-secondary-text">This Month</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency(stats.current_month_spent || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Average Transaction</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency(stats.average_transaction || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Total Transactions</span>
              <span className="font-semibold text-primary-text">
                {stats.total_transactions || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Transaction Modal Component
interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;
}

function AddTransactionModal({
  isOpen,
  onClose,
  cardId,
  onSubmit,
  isSubmitting,
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    card_id: cardId,
    amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    merchant_name: "",
    merchant_category: "",
    transaction_type: "debit",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          value={formData.amount.toString()}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
          required
        />
        <Input
          label="Date"
          type="date"
          value={formData.transaction_date}
          onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
          required
        />
        <Input
          label="Merchant"
          value={formData.merchant_name}
          onChange={(e) =>
            setFormData({ ...formData, merchant_name: e.target.value })
          }
          required
        />
        <Input
          label="Category"
          value={formData.merchant_category}
          onChange={(e) =>
            setFormData({ ...formData, merchant_category: e.target.value })
          }
          placeholder="e.g. Food, Travel"
          required
        />
        <Input
          label="Description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Card Modal Component
interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card;
  onSubmit: (data: Partial<CardFormData>) => void;
  isSubmitting: boolean;
}

function EditCardModal({ isOpen, onClose, card, onSubmit, isSubmitting }: EditCardModalProps) {
  const [formData, setFormData] = useState({
    card_name: card.card_name,
    bank_name: card.bank_name,
    credit_limit: (card.credit_limit || 0).toString(),
    bill_date: card.bill_date.toString(),
    due_date: card.due_date.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
        card_name: formData.card_name,
        bank_name: formData.bank_name,
        credit_limit: parseFloat(formData.credit_limit),
        bill_date: parseInt(formData.bill_date),
        due_date: parseInt(formData.due_date),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Card Name"
          value={formData.card_name}
          onChange={(e) =>
            setFormData({ ...formData, card_name: e.target.value })
          }
          required
        />
        <Input
          label="Bank Name"
          value={formData.bank_name}
          onChange={(e) =>
            setFormData({ ...formData, bank_name: e.target.value })
          }
        />
        <Input
          label="Credit Limit"
          type="number"
          value={formData.credit_limit}
          onChange={(e) =>
            setFormData({ ...formData, credit_limit: e.target.value })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bill Date"
            type="number"
            min="1"
            max="31"
            value={formData.bill_date}
            onChange={(e) =>
              setFormData({ ...formData, bill_date: e.target.value })
            }
          />
          <Input
            label="Due Date"
            type="number"
            min="1"
            max="31"
            value={formData.due_date}
            onChange={(e) =>
              setFormData({ ...formData, due_date: e.target.value })
            }
          />
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
